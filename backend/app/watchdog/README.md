# VYASA Watchdog Subsystem
**Domain:** System Health, Connection Telemetry & Anomaly Monitoring  
**Parent System:** VYASA Ecosystem (CSJMU)  
**Status:** Reserved Operational Boundary

## Purpose
The Watchdog provides proactive, low-overhead monitoring across the modular monolith application:
- PostgreSQL connection pool exhaustion and checkout latency
- Transaction throughput and slow query spikes
- Dead-letter outbox events and failed asynchronous dispatches
- Authentication anomaly bursts (e.g. repeated failed login attempts)
- Critical system alerting for university administrators

## Structure
- `router.py`: Telemetry query endpoints mounted under `/api/watchdog`.
- `telemetry.py`: Safe inspection of runtime pool and database health.
