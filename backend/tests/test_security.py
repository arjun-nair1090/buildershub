def test_api_responses_carry_security_headers(client):
    res = client.get("/api/health")
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert res.headers["referrer-policy"] == "no-referrer"
    assert res.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"


def test_errors_carry_them_too_and_docs_keep_their_scripts(client):
    assert client.get("/api/verify/NOPE0000").headers["x-content-type-options"] == "nosniff"
    docs = client.get("/docs")
    assert docs.status_code == 200 and "content-security-policy" not in docs.headers


def test_nul_bytes_are_refused_before_they_reach_the_database(client, auth):
    """Postgres can't store NUL in text, so a NUL anywhere in the input must be a 422, never a 500."""
    for path in ("/api/jewellery/%00", "/api/jewellery?search=%00", "/api/designs/a%00b", "/api/stores/%00/deactivate"):
        method = client.post if path.endswith("deactivate") else client.get
        res = method(path, headers=auth)
        assert res.status_code == 422, path
        assert res.json()["detail"] == "Text can't contain NUL characters."
    res = client.post("/api/auth/login", json={"email": "a\u0000@b.co", "password": "x"})
    assert res.status_code == 422
    assert res.headers["x-content-type-options"] == "nosniff"


def test_nul_check_leaves_ordinary_requests_alone(client, auth):
    # a backslash followed by u0000 is plain text, not a NUL
    assert client.get("/api/jewellery?search=a%5Cu0000", headers=auth).status_code == 200
    res = client.post("/api/auth/login", json={"email": "ghost@test.demo", "password": r"\u0000"})
    assert res.status_code == 401
