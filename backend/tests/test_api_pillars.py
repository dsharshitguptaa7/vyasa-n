def test_list_pillars(client):
    response = client.get("/api/pillars")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["count"] >= 4
    pillars = body["data"]["pillars"]
    slugs = [p["slug"] for p in pillars]
    assert "nivaran" in slugs
    assert "pillar-1" in slugs


def test_get_single_pillar(client):
    response = client.get("/api/pillars/nivaran")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["name"] == "NIVARAN"
    assert body["data"]["slug"] == "nivaran"


def test_get_nonexistent_pillar(client):
    response = client.get("/api/pillars/non-existent-subsystem")
    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False
    assert "not found" in body["message"].lower()
