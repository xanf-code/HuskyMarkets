"use client";

import { useEffect, useState } from "react";
import { placeBet } from "@/actions/bets";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { CAP_PER_MARKET } from "@/lib/constants";
import type { Database } from "@/lib/database.types";
import { formatCents, formatHC } from "@/lib/format";
import { estimatePayout, impliedYes } from "@/lib/payout";

type MarketStatus = Database["public"]["Enums"]["market_status"];
type Side = "yes" | "no";

const QUICK_AMOUNTS = [25, 50, 100];

interface OrderPanelProps {
  marketId: string;
  status: MarketStatus;
  closeAt: string;
  yesPool: number;
  noPool: number;
  /** Signed-in user's existing stake on this market, per side. */
  position: { yes: number; no: number };
  balance: number;
}

export function OrderPanel(props: OrderPanelProps) {
  const toast = useToast();
  const [pools, setPools] = useState({ yes: props.yesPool, no: props.noPool });
  const [staked, setStaked] = useState(props.position.yes + props.position.no);
  const [balance, setBalance] = useState(props.balance);
  const [side, setSide] = useState<Side>("yes");
  const [amountInput, setAmountInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pastClose, setPastClose] = useState(false);

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
    const priceNow = side === "yes" ? yesPrice : 100 - yesPrice;
    const result = await placeBet({ marketId: props.marketId, side, amount });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPools({ yes: result.yesPool, no: result.noPool });
    setBalance(result.newBalance);
    setStaked((current) => current + amount);
    setAmountInput("");
    toast.push(
      `Filled: ${formatHC(amount)} on ${side.toUpperCase()} @ ${formatCents(priceNow)}`,
    );
  }

  const sideButton = (value: Side, label: string, price: number) => (
    <button
      type="button"
      aria-pressed={side === value}
      onClick={() => setSide(value)}
      disabled={!open}
      className={`num flex-1 cursor-pointer border px-4 py-4 text-lg font-medium transition-colors duration-200 ease-standard focus-visible:outline-red disabled:cursor-not-allowed disabled:opacity-50 ${
        side === value
          ? "border-red bg-red/10 text-red-bright"
          : "border-hairline text-text-muted hover:text-text"
      }`}
    >
      {label} {formatCents(price)}
    </button>
  );

  return (
    <section
      aria-label="Place a bet"
      className="flex flex-col gap-4 border border-hairline bg-ink p-4 sm:p-5"
    >
      <div className="flex gap-2">
        {sideButton("yes", "YES", yesPrice)}
        {sideButton("no", "NO", 100 - yesPrice)}
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-text">
          Stake (HC)
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={maxStake}
          value={amountInput}
          onChange={(event) => setAmountInput(event.target.value)}
          disabled={!open}
          aria-label="Stake (HC)"
          className="num w-full border border-hairline bg-transparent px-4 py-3 text-base text-text transition-colors duration-200 ease-standard focus:border-red focus:outline-none disabled:opacity-50"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((quick) => (
          <button
            key={quick}
            type="button"
            onClick={() => setAmountInput(String(Math.min(quick, maxStake)))}
            disabled={!open || maxStake === 0}
            className="num cursor-pointer border border-hairline px-3 py-2 text-sm text-text-muted transition-colors duration-200 ease-standard hover:text-text focus-visible:outline-red disabled:cursor-not-allowed disabled:opacity-50"
          >
            {quick}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAmountInput(String(maxStake))}
          disabled={!open || maxStake === 0}
          className="num cursor-pointer border border-hairline px-3 py-2 text-sm text-text-muted transition-colors duration-200 ease-standard hover:text-text focus-visible:outline-red disabled:cursor-not-allowed disabled:opacity-50"
        >
          Max
        </button>
      </div>

      {valid ? (
        <p className="num text-sm text-text">
          Bet {formatHC(amount)} on {side.toUpperCase()} → est.{" "}
          {formatHC(estimate)} if {side.toUpperCase()}
        </p>
      ) : null}

      <p className="num text-xs text-text-muted">
        Cap remaining: {formatHC(capRemaining)} · Balance: {formatHC(balance)}
      </p>

      {error ? (
        <p role="alert" className="text-sm text-red-bright">
          {error}
        </p>
      ) : null}

      <Button
        onClick={submit}
        disabled={!open || !valid || pending}
        className="w-full"
      >
        {open ? (pending ? "Placing…" : "Place bet") : "Market closed"}
      </Button>
    </section>
  );
}
