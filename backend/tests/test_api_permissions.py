def test_list_permissions(client):
    res = client.get("/api/permissions")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["count"] >= 12
    perm_names = [p["name"] for p in body["data"]["permissions"]]
    assert "users:read" in perm_names
    assert "governance:access" in perm_names
    assert "pillars:read" in perm_names
