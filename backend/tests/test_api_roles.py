def test_list_roles(client):
    res = client.get("/api/roles")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["count"] >= 3
    role_names = [r["name"] for r in body["data"]["roles"]]
    assert "administrator" in role_names
    assert "authority" in role_names
    assert "applicant" in role_names


def test_get_role_by_name(client):
    res = client.get("/api/roles/administrator")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["name"] == "administrator"
    assert len(body["data"]["permissions"]) >= 10


def test_get_nonexistent_role(client):
    res = client.get("/api/roles/non_existent_role")
    assert res.status_code == 404
    assert res.json()["success"] is False
