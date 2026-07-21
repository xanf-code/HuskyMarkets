"use client";

import { useEffect, useState } from "react";
import { placeBet } from "@/actions/bets";
import { useSignInPrompt } from "@/components/auth/SignInPromptProvider";
import { Button } from "@/components/ui/Button";
import { HcAmount } from "@/components/ui/HcAmount";
import { HuskyCoinIcon } from "@/components/icons/HuskyCoinIcon";
import { InlineError } from "@/components/ui/InlineError";
import { useToast } from "@/components/ui/Toast";
import { FirstBetCelebration } from "@/components/market/FirstBetCelebration";
import { CAP_PER_MARKET } from "@/lib/constants";
import type { Database } from "@/lib/database.types";
import { formatHC, formatPercent } from "@/lib/format";
import {
  hasCompletedFirstBet,
  hasSeenOddsTip,
  isFirstRunPending,
  markFirstBetDone,
  markOddsTipSeen,
} from "@/lib/onboarding-flags";
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
  /** Guest browsing: controls stay enabled but every interaction prompts sign-in. */
  guest?: boolean;
  /** Reports a successful fill so live consumers (hero price, chart, stats) update optimistically. */
  onFill?: (fill: { outcomes: OutcomeState[] }) => void;
  /** Deep-link from market cards (`?outcome=`). Must match an outcome id. */
  initialOutcomeId?: string;
}

function resolveInitialOutcome(
  outcomes: OutcomeState[],
  initialOutcomeId?: string,
): string | undefined {
  if (
    initialOutcomeId &&
    outcomes.some((outcome) => outcome.id === initialOutcomeId)
  ) {
    return initialOutcomeId;
  }
  return outcomes[0]?.id;
}

export function OrderPanel(props: OrderPanelProps) {
  const toast = useToast();
  const { promptSignIn } = useSignInPrompt();
  const guest = props.guest ?? false;
  const [outcomes, setOutcomes] = useState(props.outcomes);
  const [staked, setStaked] = useState(
    props.position.reduce((sum, p) => sum + p.stake, 0),
  );
  const [balance, setBalance] = useState(props.balance);
  const [outcomeId, setOutcomeId] = useState<string | undefined>(() =>
    resolveInitialOutcome(props.outcomes, props.initialOutcomeId),
  );
  const [amountInput, setAmountInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pastClose, setPastClose] = useState(false);
  const [showOddsTip, setShowOddsTip] = useState(false);
  const [celebrateFirstBet, setCelebrateFirstBet] = useState(false);

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

  useEffect(() => {
    if (guest) return;
    setShowOddsTip(!hasSeenOddsTip());
  }, [guest]);

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

  function dismissOddsTip() {
    markOddsTipSeen();
    setShowOddsTip(false);
  }

  async function submit() {
    if (guest) {
      promptSignIn();
      return;
    }
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
      `Locked in · ${formatHC(amount)} on ${selected.label} · ${formatPercent(priceNow)} · est. ${formatHC(estimate)}`,
    );

    if (!hasCompletedFirstBet()) {
      const celebrate = isFirstRunPending();
      markFirstBetDone();
      dismissOddsTip();
      if (celebrate) setCelebrateFirstBet(true);
    }
  }

  const submitLabel = open
    ? pending
      ? "Placing…"
      : `Buy ${selected?.label ?? "—"} · ${formatPercent(selected?.implied ?? 0)}`
    : "Market closed";

  return (
    <section
      aria-label="Place a prediction"
      className="card-surface flex flex-col gap-4 p-4 sm:p-5"
    >
      <div className="flex items-center justify-between border-b border-hairline">
        <h2 className="pb-3 text-sm font-semibold text-text">Buy</h2>
        <HuskyCoinIcon size={18} className="mb-2" />
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        {props.question ? (
          <p className="line-clamp-2 text-xs text-text-muted">{props.question}</p>
        ) : null}
        <p className="truncate text-2xl leading-tight font-bold text-text">
          {selected?.label ?? "—"}
        </p>
      </div>

      <div className="flex flex-col gap-1" role="group" aria-label="Outcomes">
        {outcomes.map((outcome) => {
          const selectedOutcome = outcome.id === selected?.id;
          return (
            <button
              key={outcome.id}
              type="button"
              aria-pressed={selectedOutcome}
              aria-label={`${outcome.label} ${formatPercent(outcome.implied)}`}
              onClick={() =>
                guest ? promptSignIn() : setOutcomeId(outcome.id)
              }
              disabled={!open}
              className={`num flex min-h-11 w-full items-center justify-between gap-3 cursor-pointer rounded-md border px-3 py-2.5 text-sm font-medium transition-all duration-150 ease-standard focus-visible:outline-red disabled:cursor-not-allowed disabled:opacity-40 ${
                selectedOutcome
                  ? "border-red bg-red/10 text-text"
                  : "border-hairline bg-muted text-text hover:border-border-strong hover:bg-card active:bg-card"
              }`}
            >
              <span
                className={`flex min-w-0 items-center gap-2 ${selectedOutcome ? "font-semibold" : ""}`}
              >
                {selectedOutcome && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red" />
                )}
                <span className="truncate" aria-hidden="true">
                  {outcome.label}
                </span>
              </span>
              <span className="num shrink-0 text-text-muted" aria-hidden="true">
                {formatPercent(outcome.implied)}
              </span>
            </button>
          );
        })}
      </div>

      <label className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-card px-4 py-3 transition-colors duration-200 ease-standard focus-within:border-red">
        <span className="flex shrink-0 items-center gap-1.5">
          <HuskyCoinIcon size={18} />
          <span className="text-sm font-semibold text-text">Amount</span>
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={maxStake}
          value={amountInput}
          onChange={(event) => setAmountInput(event.target.value)}
          readOnly={guest}
          onFocus={(event) => {
            if (guest) {
              event.currentTarget.blur();
              promptSignIn();
            }
          }}
          disabled={!open}
          aria-label="Amount (HuskyCoin)"
          placeholder="0"
          className="num w-full min-w-0 flex-1 border-none bg-transparent text-right text-3xl font-semibold text-text [appearance:textfield] placeholder:text-text-tertiary focus:outline-none disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((quick) => (
          <button
            key={quick}
            type="button"
            onClick={() =>
              guest
                ? promptSignIn()
                : setAmountInput(String(Math.min(quick, maxStake)))
            }
            disabled={!open || (!guest && maxStake === 0)}
            className="num inline-flex min-h-11 cursor-pointer items-center rounded-pill border border-hairline bg-muted px-4 text-sm text-text-muted transition-colors duration-200 ease-standard hover:border-border-strong hover:text-text active:border-border-strong active:text-text focus-visible:outline-red disabled:cursor-not-allowed disabled:opacity-50"
          >
            {quick}
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            guest ? promptSignIn() : setAmountInput(String(maxStake))
          }
          disabled={!open || (!guest && maxStake === 0)}
          className="num inline-flex min-h-11 cursor-pointer items-center rounded-pill border border-hairline bg-muted px-4 text-sm text-text-muted transition-colors duration-200 ease-standard hover:border-border-strong hover:text-text active:border-border-strong active:text-text focus-visible:outline-red disabled:cursor-not-allowed disabled:opacity-50"
        >
          Max
        </button>
      </div>

      <dl className="flex flex-col gap-2.5 border-t border-hairline pt-4 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-text-muted">Chance</dt>
          <dd className="num font-semibold whitespace-nowrap text-text">
            {formatPercent(selected?.implied ?? 0)} chance
          </dd>
        </div>
        {showOddsTip ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
            <p className="min-w-0 flex-1 text-xs text-pretty text-text-muted">
              Higher % means the board thinks that outcome is likelier. Your
              stake buys a share of the winning pool.
            </p>
            <button
              type="button"
              onClick={dismissOddsTip}
              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center px-1 text-xs font-semibold text-red hover:text-red-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
            >
              Got it
            </button>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-text-muted">Balance</dt>
          <dd className="whitespace-nowrap text-text">
            {guest ? "—" : <HcAmount amount={balance} size={14} />}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-text-muted">Stake cap left</dt>
          <dd className="whitespace-nowrap text-text">
            {guest ? "—" : <HcAmount amount={capRemaining} size={14} />}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
          <dt className="shrink-0 font-semibold text-text">Est. payout</dt>
          <dd className="text-2xl font-bold whitespace-nowrap text-text">
            {valid ? <HcAmount amount={estimate} size={20} /> : "—"}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-text-tertiary">
        Final payout depends on the pools at close · Closes{" "}
        {CLOSE_DATE.format(new Date(props.closeAt))}
      </p>

      {error ? <InlineError>{error}</InlineError> : null}

      <Button
        onClick={submit}
        disabled={!open || (!guest && !valid)}
        loading={pending}
        className="w-full max-w-full"
      >
        {submitLabel}
      </Button>

      <FirstBetCelebration
        open={celebrateFirstBet}
        onClose={() => setCelebrateFirstBet(false)}
      />
    </section>
  );
}
