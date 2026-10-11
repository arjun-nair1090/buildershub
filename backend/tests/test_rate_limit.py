from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.models import RateLimit
from app.services import rate_limit

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
