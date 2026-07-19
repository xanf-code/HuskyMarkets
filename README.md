# HuskyMarkets

A prediction market platform built with Next.js and Supabase.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Story S0-1: N-Outcome Parimutuel Generalization

Story S0-1 extends the payout math from binary markets (YES/NO) to support N-outcome markets.

### Changes

- **New function:** `impliedOutcome(outcomePool, totalPool)` — calculates implied probability for any outcome in an N-outcome market
- **Refactored:** `impliedYes()` now uses `impliedOutcome()` for consistency and clarity
- **Enhanced docs:** `estimatePayout()` and `positionValue()` now explicitly support N-outcome markets
- **Test coverage:** Added 6 comprehensive tests for `impliedOutcome()` covering 2–6 outcome markets, clamping, backward compatibility

### API Documentation

See [docs/api/payout.md](docs/api/payout.md) for the complete payout math API, including examples and SQL mirrors.

## Development

### Running Tests

```bash
npm test
```

### Project Structure

- `/src/lib` — Core business logic (payout math, formatting, constants)
- `/src/components` — React components (OrderPanel, UI elements)
- `/src/actions` — Server actions (placeBet, etc.)
- `/docs` — Architecture, requirements, and phase plans
- `/docs/api` — API documentation

## Building

```bash
npm run build
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
