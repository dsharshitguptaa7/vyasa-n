# OPERATIONAL WATCHDOG & SYSTEM TELEMETRY AUDIT

**Domain:** Performance Telemetry, Database Pool Vitality & Health Monitoring  
**Subsystem Code:** `watchdog` (`app.watchdog`)  
**Current Audit Date:** November 7, 2026  
**Implementation Classification:** **IMPLEMENTED (CORE OPERATIONAL)**  

---

## 1. Subsystem Overview & Operational Role

The Operational Watchdog subsystem provides low-overhead, real-time health inspection and resource utilization telemetry for the VYASA-N backend. It gives system operators and DevOps engineers instant visibility into database connection pool contention, memory vitality, and application responsiveness without leaking sensitive credentials or impacting request latency.

---

## 2. Telemetry Endpoints & Metrics Exposed

### 1. Database Connection Pool Health
- **Endpoint:** `GET /api/watchdog/metrics`
- **Security Requirement:** Strictly restricted to `super_admin` (`require_super_admin_user`).
- **Implementation File:** [`backend/app/watchdog/telemetry.py`](file:///c:/Projects/VYASA/backend/app/watchdog/telemetry.py)
- **Metrics Collected:**
  - `pool_size`: Configured baseline connection pool capacity (Default: 5).
  - `checked_out_connections`: Number of connections currently loaned to active HTTP worker threads.
  - `overflow_connections`: Current dynamic connections established beyond the pool size (Max: 10).
  - `pool_timeout_seconds`: Maximum wait duration before an acquisition times out (30s).
  - `pool_recycle_seconds`: Frequency of automatic stale connection recycling (1800s).

### 2. Liveness & Readiness Probes
- **Liveness Probe:** `GET /api/health`
  - Responds in < 5ms. Emits service identity (`vyasa-core-backend`), environment mode, and current timestamp in Asia/Kolkata (IST).
- **Readiness Probe:** `GET /api/health/db`
  - Tests socket connectivity to Neon PostgreSQL via `SELECT 1`. Returns `healthy: true` or HTTP 503 if the database pool is exhausted or network connectivity is severed.

---

## 3. Discovered Vulnerabilities & Known Limitations

1. **Prometheus / OpenTelemetry Metrics Exporter (Monitoring - Medium):**
   - Telemetry is currently exposed via custom JSON endpoints rather than standard Prometheus metrics (`/metrics`). Integrating a Prometheus ASGI middleware would allow automated scraping by Grafana/Prometheus monitors.
2. **Automated Alerting Triggers (DevOps - Medium):**
   - There are currently no automated webhooks or PagerDuty alerts triggered when the database pool reaches 90% saturation.
