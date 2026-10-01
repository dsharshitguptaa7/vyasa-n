from app.services.seed_service import seed_all


def test_seed_idempotency(db_session):
    # Running seed on already seeded DB should not create duplicate records
    results = seed_all(db_session)
    assert results["roles"] >= 3
    assert results["permissions"] >= 12
    # Since pillars are already seeded, newly seeded pillars should be 0
    assert results["pillars_seeded"] == 0
