# MELEO RC2-A10 - Staging Load & Performance Evidence

## Status

**Verdict: PASS**

RC2-A10 validates the MELEO staging deployment under a deliberately
bounded concurrent workload.

This test is an operational staging validation and is **not** intended
to represent maximum production capacity.

## Environment

- Application: MELEO
- Environment: Render staging
- Database: PostgreSQL
- Tested commit: `2410a4f`
- Test type: capped, non-destructive staging load validation
- Maximum tested concurrency: 8
- Booking fixture size: 120 disposable bookings

All disposable test fixtures were removed after execution.

## Results

| Phase | Requests | HTTP 5xx | Transport errors | Avg | p95 | p99 |
|---|---:|---:|---:|---:|---:|---:|
| health-c1 | 20 | 0 | 0 | 84.3 ms | 100.8 ms | 157.9 ms |
| health-c4 | 24 | 0 | 0 | 168.2 ms | 436.3 ms | 450.8 ms |
| health-c8 | 24 | 0 | 0 | 376.9 ms | 442.1 ms | 442.8 ms |
| config-c4 | 24 | 0 | 0 | 404.2 ms | 446.8 ms | 447.2 ms |
| plans-c4 | 24 | 0 | 0 | 172.2 ms | 426.0 ms | 426.4 ms |
| booking-list-c1 | 20 | 0 | 0 | 84.7 ms | 88.7 ms | 90.3 ms |
| booking-list-c4 | 24 | 0 | 0 | 111.3 ms | 187.7 ms | 196.4 ms |
| booking-list-c8 | 24 | 0 | 0 | 230.2 ms | 416.0 ms | 417.8 ms |
| mixed-c8 | 32 | 0 | 0 | 90.0 ms | 312.2 ms | 313.2 ms |

## Reliability

Across all measured phases:

- HTTP 5xx responses: **0**
- Transport errors: **0**
- Maximum tested concurrency: **8**
- Worst observed p95: **446.8 ms**
- Worst observed p99: **450.8 ms**
- Disposable fixture cleanup: **PASS**

No tested phase crossed the RC2-A10 failure or warning thresholds.

## Booking-list validation

The authenticated booking-list path was tested separately because
RC2-A7 replaced the previous N+1 query behavior with bounded batch
queries.

Observed results:

| Concurrency | Average | p95 | p99 |
|---:|---:|---:|---:|
| 1 | 84.7 ms | 88.7 ms | 90.3 ms |
| 4 | 111.3 ms | 187.7 ms | 196.4 ms |
| 8 | 230.2 ms | 416.0 ms | 417.8 ms |

The endpoint remained successful throughout the test with zero HTTP
5xx and zero transport failures.

This provides runtime staging evidence that the RC2-A7 booking-list
optimization behaves correctly under the bounded concurrency profile.

## Acceptance criteria

RC2-A10 defined the following thresholds:

- FAIL on any HTTP 5xx response.
- FAIL on any transport error.
- FAIL when phase error rate exceeds 2%.
- FAIL when worst p95 exceeds 5000 ms.
- PASS WITH WARNINGS when p95 exceeds 2500 ms or p99 exceeds 5000 ms.
- PASS otherwise.

Observed result:

**PASS**

## Scope limitation

These measurements were collected from the Render staging environment.

They prove application stability and acceptable response behavior for
the tested workload, but they must not be interpreted as a production
capacity benchmark or as evidence of a specific maximum number of
simultaneous MELEO users.

Production-scale capacity should be established separately using
production-equivalent infrastructure and a dedicated load-testing
environment.

## RC2 conclusion

RC2-A10 is complete.

Combined with RC2-A1 through RC2-A9, this completes the planned
MELEO v7.0 RC2 Production Hardening sequence.

**RC2-A1-A10: COMPLETE**