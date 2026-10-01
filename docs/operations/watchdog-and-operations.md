# VYASA Operations & Watchdog Guide
**Document Version:** 1.0.0-OPERATIONS  
**Parent System:** VYASA Ecosystem (Chhatrapati Shahu Ji Maharaj University, Kanpur)

---

## 1. Operational Overview
VYASA operations are streamlined through the single modular monolith architecture. System operators monitor the health, database connection pool, transaction latency, and service availability of the entire university platform through centralized telemetry probes.

---

## 2. Health & Watchdog Telemetry

### 2.1 Liveness Probe (`GET /api/health`)
- Verifies HTTP server availability, uptime, and basic database connection ping.
- Used by orchestrators (Kubernetes / Docker Swarm / Cloud health checks).

### 2.2 Deep Operational Telemetry (`GET /api/watchdog/metrics`)
- Inspects SQLAlchemy connection pool metrics:
  - `pool_size`: Configured connection pool size.
  - `checked_in`: Available idle connections in pool.
  - `checked_out`: Active connections executing queries.
  - `overflow`: Connections allocated beyond pool size.
  - `db_healthy`: Boolean ping indicator.

---

## 3. Incident Management & Escalation
1. **Database Pool Saturation:**
   - If `checked_out` equals `pool_size + overflow`, evaluate long-running transactions or unclosed sessions.
   - Adjust `DB_POOL_SIZE` and `DB_MAX_OVERFLOW` via environment variables.
2. **Authentication Burst Anomalies:**
   - Monitored through future Watchdog rate-limiting rules.
3. **Outbox Dead-Letter Review:**
   - Outbox table events stuck in `PENDING` state longer than 15 minutes trigger administrator alerts.
