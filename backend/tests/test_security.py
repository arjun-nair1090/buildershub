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
