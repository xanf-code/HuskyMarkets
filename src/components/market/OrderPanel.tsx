"use client";

import { useEffect, useState } from "react";
import { placeBet } from "@/actions/bets";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";
import { CAP_PER_MARKET } from "@/lib/constants";
import type { Database } from "@/lib/database.types";
import { formatCents, formatHC, formatPercent } from "@/lib/format";
import { totalPool, type OutcomeState } from "@/lib/outcomes";
import { estimatePayout } from "@/lib/payout";
import type { PositionEntry } from "@/lib/queries/markets";

type MarketStatus = Database["public"]["Enums"]["market_status"];

const QUICK_AMOUNTS = [25, 50, 100];

const CLOSE_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

interface OrderPanelProps {
  marketId: string;
  status: MarketStatus;
  closeAt: string;
  /** Every outcome of the market, in canonical sort_order. */
  outcomes: OutcomeState[];
  /** Signed-in user's existing stake on this market, per outcome. */
  position: PositionEntry[];
  balance: number;
  /** Optional market question, rendered as a small context line above the outcome. */
  question?: string;
  /** Reports a successful fill so live consumers (hero price, chart, stats) update optimistically. */
  onFill?: (fill: { outcomes: OutcomeState[] }) => void;
}

export function OrderPanel(props: OrderPanelProps) {
  const toast = useToast();
  const [outcomes, setOutcomes] = useState(props.outcomes);
  const [staked, setStaked] = useState(
    props.position.reduce((sum, p) => sum + p.stake, 0),
  );
  const [balance, setBalance] = useState(props.balance);
  const [outcomeId, setOutcomeId] = useState<string | undefined>(
    props.outcomes[0]?.id,
  );
  const [amountInput, setAmountInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pastClose, setPastClose] = useState(false);

  // Realtime/refresh reconciliation: whenever the parent hands down new pool
  // or balance values (realtime UPDATE, server revalidation), they win over
  // the panel's optimistic copies. Guarded setState during render is React's
  // sanctioned "adjust state when props change" pattern.
  const [syncedProps, setSyncedProps] = useState({
    outcomes: props.outcomes,
    balance: props.balance,
  });
  if (
    props.outcomes !== syncedProps.outcomes ||
    props.balance !== syncedProps.balance
  ) {
    setSyncedProps({ outcomes: props.outcomes, balance: props.balance });
    setOutcomes(props.outcomes);
    setBalance(props.balance);
  }

  // Clock reads live in an effect (render must stay pure); the panel locks
  // itself within half a minute of the close time passing.
  useEffect(() => {
    const check = () =>
      setPastClose(new Date(props.closeAt).getTime() <= Date.now());
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, [props.closeAt]);

  const open = props.status === "open" && !pastClose;
  const selected =
    outcomes.find((o) => o.id === outcomeId) ?? outcomes[0] ?? null;
  const total = totalPool(outcomes);
  const capRemaining = Math.max(CAP_PER_MARKET - staked, 0);
  const maxStake = Math.min(capRemaining, balance);

  const amount = /^\d+$/.test(amountInput) ? Number(amountInput) : 0;
  const valid = amount >= 1 && amount <= maxStake && selected !== null;
  const estimate =
    valid && selected ? estimatePayout(amount, selected.pool, total) : 0;

  async function submit() {
    if (!valid || pending || !selected) return;
    setPending(true);
    setError(null);
    const priceNow = selected.implied;
    const result = await placeBet({
      marketId: props.marketId,
      outcomeId: selected.id,
      amount,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOutcomes(result.outcomes);
    setBalance(result.newBalance);
    props.onFill?.({ outcomes: result.outcomes });
    setStaked((current) => current + amount);
    setAmountInput("");
    // Est. payout repeats at the moment of purchase, not just on the panel —
    // this is where the parimutuel expectation is actually set (FR-24).
    toast.push(
      `Placed ${formatHC(amount)} on ${selected.label} · odds ${formatCents(priceNow)} · est. ${formatHC(estimate)}`,
    );
  }

  const submitLabel = open
    ? pending
      ? "Placing…"
      : `Buy ${selected?.label ?? "—"} · ${formatCents(selected?.implied ?? 0)}`
    : "Market closed";

  return (
    <section
      aria-label="Place a bet"
      className="card-surface flex flex-col gap-4 p-4 sm:p-5"
    >
      <div className="flex items-center justify-between border-b border-hairline">
        <h2 className="pb-3 text-sm font-semibold text-text">Buy</h2>
        <Chip className="num mb-2">HC</Chip>
      </div>

      <div className="flex flex-col gap-1">
        {props.question ? (
          <p className="text-xs text-text-muted">{props.question}</p>
        ) : null}
        <p className="text-2xl leading-tight font-bold text-text">
          {selected?.label ?? "—"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Outcomes">
        {outcomes.map((outcome) => {
          const selectedOutcome = outcome.id === selected?.id;
          return (
            <button
              key={outcome.id}
              type="button"
              aria-pressed={selectedOutcome}
              onClick={() => setOutcomeId(outcome.id)}
              disabled={!open}
              className={`num flex-1 basis-2/5 cursor-pointer rounded-pill border px-4 py-3.5 text-base font-semibold transition-all duration-200 ease-standard focus-visible:outline-red disabled:cursor-not-allowed disabled:opacity-40 ${
                selectedOutcome
                  ? "border-red bg-red text-white"
                  : "border-hairline bg-muted text-text hover:border-border-strong"
              }`}
            >
              {outcome.label} {formatCents(outcome.implied)}
            </button>
          );
        })}
      </div>

      <label className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-card px-4 py-3 transition-colors duration-200 ease-standard focus-within:border-red">
        <span className="flex shrink-0 flex-col">
          <span className="text-sm font-semibold text-text">Amount</span>
          <span className="text-xs text-text-muted">HC</span>
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={maxStake}
          value={amountInput}
          onChange={(event) => setAmountInput(event.target.value)}
          disabled={!open}
          aria-label="Amount (HC)"
          placeholder="0"
          className="num w-full min-w-0 flex-1 border-none bg-transparent text-right text-3xl font-semibold text-text [appearance:textfield] placeholder:text-text-tertiary focus:outline-none disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((quick) => (
          <button
            key={quick}
            type="button"
            onClick={() => setAmountInput(String(Math.min(quick, maxStake)))}
            disabled={!open || maxStake === 0}
            className="num cursor-pointer rounded-pill border border-hairline bg-muted px-3 py-1.5 text-sm text-text-muted transition-colors duration-200 ease-standard hover:border-border-strong hover:text-text focus-visible:outline-red disabled:cursor-not-allowed disabled:opacity-50"
          >
            {quick}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAmountInput(String(maxStake))}
          disabled={!open || maxStake === 0}
          className="num cursor-pointer rounded-pill border border-hairline bg-muted px-3 py-1.5 text-sm text-text-muted transition-colors duration-200 ease-standard hover:border-border-strong hover:text-text focus-visible:outline-red disabled:cursor-not-allowed disabled:opacity-50"
        >
          Max
        </button>
      </div>

      <dl className="flex flex-col gap-2.5 border-t border-hairline pt-4 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-text-muted">Odds</dt>
          <dd className="num font-semibold whitespace-nowrap text-text">
            {formatPercent(selected?.implied ?? 0)} chance
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-text-muted">Balance</dt>
          <dd className="num whitespace-nowrap text-text">{formatHC(balance)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-text-muted">Cap remaining</dt>
          <dd className="num whitespace-nowrap text-text">{formatHC(capRemaining)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
          <dt className="shrink-0 font-semibold text-text">Est. payout</dt>
          <dd className="num text-2xl font-bold whitespace-nowrap text-text">
            {valid ? formatHC(estimate) : "—"}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-text-tertiary">
        Final payout depends on the pools at close · Closes{" "}
        {CLOSE_DATE.format(new Date(props.closeAt))}
      </p>

      {error ? (
        <p role="alert" className="text-sm text-market-no">
          {error}
        </p>
      ) : null}

      <Button
        onClick={submit}
        disabled={!open || !valid || pending}
        className="w-full"
      >
        {submitLabel}
      </Button>
    </section>
  );
}
