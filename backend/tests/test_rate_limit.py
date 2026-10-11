from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.models import RateLimit
from app.services import rate_limit
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD

T0 = datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc)
MIN = timedelta(minutes=1)


def at(seconds: int) -> datetime:
    return T0 + timedelta(seconds=seconds)


def test_hit_counts_blocks_and_starts_over(db):
    for i in range(3):
        assert rate_limit.hit(db, "t", "1.2.3.4", 3, MIN, at(i)).allowed
    blocked = rate_limit.hit(db, "t", "1.2.3.4", 3, MIN, at(20))
    assert not blocked.allowed and blocked.retry_after == 40
    assert rate_limit.hit(db, "t", "5.6.7.8", 3, MIN, at(20)).allowed  # another IP has its own count
    assert rate_limit.hit(db, "t", "1.2.3.4", 3, MIN, at(60)).allowed  # the window ended: start over


def test_peek_does_not_count(db):
    for _ in range(2):
        rate_limit.hit(db, "t", "x", 2, MIN, T0)
    waiting = rate_limit.peek(db, "t", "x", 2, MIN, at(30))
    assert not waiting.allowed and waiting.retry_after == 30
    assert rate_limit.peek(db, "t", "x", 2, MIN, at(60)).allowed
    assert rate_limit.peek(db, "t", "never-seen", 2, MIN, T0).allowed
    assert db.scalar(select(RateLimit.count)) == 2


def test_only_hashes_are_stored(db):
    rate_limit.hit(db, "login-email", "Admin@Test.Demo", 5, MIN, T0)
    rate_limit.hit(db, "login-ip", "203.0.113.7", 5, MIN, T0)
    keys = db.scalars(select(RateLimit.key)).all()
    assert len(keys) == 2
    assert all("admin" not in k.lower() and "203.0" not in k for k in keys)
    rate_limit.hit(db, "login-email", " admin@test.demo ", 5, MIN, T0)  # any case, stray spaces: same counter
    assert db.scalar(select(RateLimit.count).where(RateLimit.key.like("login-email:%"))) == 2


def test_clear_and_purge(db):
    rate_limit.hit(db, "t", "x", 1, MIN, T0)
    rate_limit.hit(db, "t", "y", 1, MIN, T0)
    rate_limit.clear(db, "t", "x")
    assert db.scalar(select(func.count()).select_from(RateLimit)) == 1
    rate_limit.purge(db, T0 + timedelta(hours=25))
    assert db.scalar(select(func.count()).select_from(RateLimit)) == 0


def test_a_counter_failure_lets_the_request_through(db, monkeypatch):
    def broken(*args, **kwargs):
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(db, "execute", broken)
    monkeypatch.setattr(db, "get", broken)
    assert rate_limit.hit(db, "t", "x", 1, MIN, T0).allowed
    assert rate_limit.peek(db, "t", "x", 1, MIN, T0).allowed
    rate_limit.clear(db, "t", "x")  # no exception
    rate_limit.purge(db, T0)


def test_client_ip_prefers_the_forwarded_address():
    class Req:
        def __init__(self, headers, host):
            self.headers = headers
            self.client = type("C", (), {"host": host})() if host else None

    assert rate_limit.client_ip(Req({"x-forwarded-for": "203.0.113.7, 10.0.0.1"}, "10.0.0.2")) == "203.0.113.7"
    assert rate_limit.client_ip(Req({}, "10.0.0.2")) == "10.0.0.2"
    assert rate_limit.client_ip(Req({}, None)) == "unknown"


def login(client, email=ADMIN_EMAIL, password="wrong-password", ip="198.51.100.1"):
    return client.post("/api/auth/login", json={"email": email, "password": password}, headers={"X-Forwarded-For": ip})


def test_login_locks_an_email_after_five_failures(client):
    for _ in range(5):
        assert login(client).status_code == 401
    res = login(client, password=ADMIN_PASSWORD)  # even the right password waits
    assert res.status_code == 429
    assert res.json()["detail"] == "Too many attempts. Try again in 15 minutes."
    assert 0 < int(res.headers["retry-after"]) <= 900
    assert login(client, email=ADMIN_EMAIL.upper(), password=ADMIN_PASSWORD).status_code == 429  # same email


def test_login_limits_failures_per_ip_across_emails(client):
    for i in range(20):
        assert login(client, email=f"user{i}@test.demo").status_code == 401
    assert login(client, password=ADMIN_PASSWORD).status_code == 429
    assert login(client, password=ADMIN_PASSWORD, ip="198.51.100.2").status_code == 200


def test_a_successful_login_clears_the_email_count(client):
    for _ in range(4):
        login(client)
    assert login(client, password=ADMIN_PASSWORD).status_code == 200
    for _ in range(4):
        assert login(client).status_code == 401  # would be failures 5 to 8 without the reset
    assert login(client, password=ADMIN_PASSWORD).status_code == 200


def test_verify_limits_lookups_per_ip(client, publish):
    token = publish()["verification_token"]
    for _ in range(60):
        assert client.get(f"/api/verify/{token}", headers={"X-Forwarded-For": "198.51.100.9"}).status_code == 200
    res = client.get(f"/api/verify/{token}", headers={"X-Forwarded-For": "198.51.100.9"})
    assert res.status_code == 429
    assert res.json()["detail"] == "Too many lookups. Try again in a minute."
    assert 1 <= int(res.headers["retry-after"]) <= 60
    assert client.get(f"/api/verify/{token}", headers={"X-Forwarded-For": "198.51.100.10"}).status_code == 200


# ---------- Fixes from review ----------

def test_login_counts_the_attempt_before_checking_the_password(client, db, monkeypatch):
    """A burst of parallel guesses must not all pass a read-only check before any failure is recorded."""
    from app.routers import auth as auth_router

    seen = []
    real = auth_router.verify_password

    def watching(password, hashed):
        db.expire_all()
        seen.append(db.scalar(select(RateLimit.count).where(RateLimit.key.like("login-email:%"))))
        return real(password, hashed)

    monkeypatch.setattr(auth_router, "verify_password", watching)
    login(client)
    assert seen == [1]  # already counted while the password was being checked


def test_successful_logins_dont_use_up_the_ip_allowance(client):
    for _ in range(25):
        assert login(client, password=ADMIN_PASSWORD).status_code == 200
    assert login(client).status_code == 401  # a plain failure, not "too many attempts"


def test_verify_also_forgets_day_old_counts(client, db, publish, monkeypatch):
    from app.routers import verify as verify_router

    token = publish()["verification_token"]
    rate_limit.hit(db, "verify-ip", "192.0.2.1", 60, MIN, datetime.now(timezone.utc) - timedelta(days=2))
    monkeypatch.setattr(verify_router.secrets, "randbelow", lambda n: 0)  # this lookup is the one that cleans up
    assert client.get(f"/api/verify/{token}").status_code == 200
    db.expire_all()
    day_ago = datetime.now(timezone.utc) - timedelta(days=1)
    assert db.scalar(select(func.count()).select_from(RateLimit).where(RateLimit.window_start < day_ago)) == 0


def test_client_ip_prefers_the_address_the_proxy_sets():
    class Req:
        headers = {"x-real-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1, 203.0.113.7"}
        client = None

    assert rate_limit.client_ip(Req()) == "203.0.113.7"  # a client-supplied first X-Forwarded-For entry is ignored
