# Changelog

All notable changes to HuskyMarkets will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Story S0-1: N-Outcome Parimutuel Generalization

#### Added

- **`impliedOutcome(outcomePool, totalPool)`** — New function that calculates implied probability for any outcome in an N-outcome market, clamped to [1, 99] cents. Mirrors the SQL formula: `least(greatest(round(100.0*outcome/total)::int, 1), 99)`.
- **N-outcome market support** — `estimatePayout()` and `positionValue()` now explicitly documented as working with any N-outcome market (previously binary-only in documentation).
- **Payout API documentation** — New file `docs/api/payout.md` with comprehensive reference, examples, and SQL consistency notes for all payout functions.
- **Test suite for `impliedOutcome()`** — 6 new test cases covering:
  - Balanced 2-outcome and N-outcome markets
  - Proper rounding (e.g., 3-outcome [200,150,100])
  - Clamping to [1, 99]
  - Probability sum correctness across 2–6 outcome markets
  - Backward compatibility with `impliedYes()`

#### Changed

- **`impliedYes()`** — Refactored to use `impliedOutcome()` instead of inline math, improving code reuse and clarity while maintaining exact backward compatibility.
- **Documentation** — Added ledger invariant and N-outcome notes to payout module header.
- **README** — Updated with Story S0-1 summary and links to API documentation.

#### Fixed

- Test descriptions now generic (removed "YES" from `positionValue` test for clarity with N-outcome support).

### Implementation Notes

All changes maintain strict lockstep with SQL money math in `supabase/migrations/0006_market_engine.sql`. The database remains the source of truth.

**Ledger Invariant:**
```
Σ(user tx) + Σ(vig_burn) − Σ_{m ∈ resolved}(100 × outcome_count(m)) = Σ(grants)
```

See [docs/api/payout.md](docs/api/payout.md) for complete reference.
