"use client";

import { useEffect, useState } from "react";
import { placeBet } from "@/actions/bets";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";
import { CAP_PER_MARKET } from "@/lib/constants";
import type { Database } from "@/lib/database.types";
import { formatCents, formatHC, formatPercent } from "@/lib/format";
import { estimatePayout, impliedYes } from "@/lib/payout";

type MarketStatus = Database["public"]["Enums"]["market_status"];
type Side = "yes" | "no";

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
  yesPool: number;
  noPool: number;
  /** Signed-in user's existing stake on this market, per side. */
  position: { yes: number; no: number };
  balance: number;
  /** Prefill from `?side=yes|no` deep link. */
  initialSide?: Side;
  /** Optional market question, rendered as a small context line above the outcome. */
  question?: string;
  /** Reports a successful fill so live consumers (hero price, chart, stats) update optimistically. */
  onFill?: (fill: { yesPool: number; noPool: number }) => void;
}

export function OrderPanel(props: OrderPanelProps) {
  const toast = useToast();
  const [pools, setPools] = useState({ yes: props.yesPool, no: props.noPool });
  const [staked, setStaked] = useState(props.position.yes + props.position.no);
  const [balance, setBalance] = useState(props.balance);
  const [side, setSide] = useState<Side>(props.initialSide ?? "yes");
  const [amountInput, setAmountInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pastClose, setPastClose] = useState(false);

  // Realtime/refresh reconciliation: whenever the parent hands down new pool
  // or balance values (realtime UPDATE, server revalidation), they win over
  // the panel's optimistic copies. Guarded setState during render is React's
  // sanctioned "adjust state when props change" pattern.
  const [syncedProps, setSyncedProps] = useState({
    yes: props.yesPool,
    no: props.noPool,
    balance: props.balance,
  });
  if (
    props.yesPool !== syncedProps.yes ||
    props.noPool !== syncedProps.no ||
    props.balance !== syncedProps.balance
  ) {
    setSyncedProps({
      yes: props.yesPool,
      no: props.noPool,
      balance: props.balance,
    });
    setPools({ yes: props.yesPool, no: props.noPool });
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
  const yesPrice = impliedYes(pools.yes, pools.no);
  const noPrice = 100 - yesPrice;
  const sidePrice = side === "yes" ? yesPrice : noPrice;
  const capRemaining = Math.max(CAP_PER_MARKET - staked, 0);
  const maxStake = Math.min(capRemaining, balance);

  const amount = /^\d+$/.test(amountInput) ? Number(amountInput) : 0;
  const valid = amount >= 1 && amount <= maxStake;
  const estimate = valid
    ? estimatePayout(amount, side === "yes" ? pools.yes : pools.no, pools.yes + pools.no)
    : 0;

  async function submit() {
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    const priceNow = sidePrice;
    const result = await placeBet({ marketId: props.marketId, side, amount });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPools({ yes: result.yesPool, no: result.noPool });
    setBalance(result.newBalance);
    props.onFill?.({ yesPool: result.yesPool, noPool: result.noPool });
    setStaked((current) => current + amount);
    setAmountInput("");
    toast.push(
      `Filled ${formatHC(amount)} on ${side === "yes" ? "Yes" : "No"} @ ${formatCents(priceNow)}`,
    );
  }

  const sideButton = (value: Side, label: string, price: number) => {
    const selected = side === value;
    const semantic =
      value === "yes"
        ? selected
          ? "border-market-yes bg-market-yes text-white"
          : "border-market-yes/40 bg-market-yes-bg text-market-yes hover:border-market-yes"
        : selected
          ? "border-market-no bg-market-no text-white"
          : "border-market-no/40 bg-market-no-bg text-market-no hover:border-market-no";

    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => setSide(value)}
        disabled={!open}
        className={`num flex-1 cursor-pointer rounded-pill border px-4 py-3.5 text-base font-semibold transition-all duration-200 ease-standard focus-visible:outline-red disabled:cursor-not-allowed disabled:opacity-40 ${semantic}`}
      >
        {label} {formatCents(price)}
      </button>
    );
  };

  const submitLabel = open
    ? pending
      ? "Placing…"
      : `Buy ${side === "yes" ? "Yes" : "No"} · ${formatCents(sidePrice)}`
    : "Market closed";

  return (
    <section
      aria-label="Place a bet"
      className="card-surface flex flex-col gap-4 p-4 sm:p-5"
    >
      <div className="flex items-center justify-between border-b border-hairline">
        <span className="-mb-px border-b-2 border-red px-1 pb-3 text-sm font-semibold text-text">
          Buy
        </span>
        <Chip className="num mb-2">HC</Chip>
      </div>

      <div className="flex flex-col gap-1">
        {props.question ? (
          <p className="text-xs text-text-muted">{props.question}</p>
        ) : null}
        <p className="text-2xl leading-tight font-bold text-text">
          {side === "yes" ? "Yes" : "No"}
        </p>
      </div>

      <div className="flex gap-2">
        {sideButton("yes", "Yes", yesPrice)}
        {sideButton("no", "No", noPrice)}
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
        <div className="flex items-baseline justify-between">
          <dt className="text-text-muted">Odds</dt>
          <dd className="num font-semibold text-text">
            {formatPercent(sidePrice)} chance
          </dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-text-muted">Balance</dt>
          <dd className="num text-text">{formatHC(balance)}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-text-muted">Cap remaining</dt>
          <dd className="num text-text">{formatHC(capRemaining)}</dd>
        </div>
        <div className="flex items-end justify-between">
          <dt className="flex flex-col gap-0.5">
            <span className="font-semibold text-text">Max payout</span>
            <span className="text-xs text-text-tertiary">
              Closes {CLOSE_DATE.format(new Date(props.closeAt))}
            </span>
          </dt>
          <dd className="num text-2xl font-bold text-text">
            {valid ? formatHC(estimate) : "—"}
          </dd>
        </div>
      </dl>

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
