"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { completeOnboarding, rerollAnonHandle } from "@/actions/profile";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Appearance } from "@/lib/appearance";
import { applyAppearance } from "@/lib/use-appearance";

type DisplayMode = "real" | "anon";

interface OnboardingFormProps {
  initialHandle: string;
}

export function OnboardingForm({ initialHandle }: OnboardingFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<DisplayMode>("anon");
  const [handle, setHandle] = useState(initialHandle);
  const [realName, setRealName] = useState("");
  const [appearance, setAppearance] = useState<Appearance>("light");
  const [error, setError] = useState<string | null>(null);
  const [rerolling, setRerolling] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function onChooseAppearance(next: Appearance) {
    setAppearance(next);
    // Live preview: the pick only persists once the form is submitted
    // (below), but the whole page should reflect it immediately.
    applyAppearance(next);
  }

  async function onReroll() {
    setRerolling(true);
    const result = await rerollAnonHandle();
    setRerolling(false);
    if (result.ok) {
      setHandle(result.handle);
    } else {
      setError(result.error);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const name = realName.trim();
    if (mode === "real" && !name) {
      setError("Enter your name to use real-name mode.");
      return;
    }

    setSubmitting(true);
    const result = await completeOnboarding(
      mode === "real"
        ? { displayMode: "real", realName: name, appearance }
        : { displayMode: "anon", appearance },
    );
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/");
    router.refresh();
  }

  const optionBase =
    "flex flex-col gap-1 rounded-lg border bg-card p-4 transition-colors duration-200 ease-standard sm:p-5";

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-semibold text-text">
          How should you appear to other traders?
        </legend>

        <div
          className={`${optionBase} ${
            mode === "anon" ? "border-red" : "border-hairline hover:border-border-strong"
          }`}
        >
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="display-mode"
              value="anon"
              checked={mode === "anon"}
              onChange={() => setMode("anon")}
              className="h-4 w-4 accent-red"
            />
            <span className="font-semibold text-text">Anonymous</span>
          </label>
          <p className="text-sm text-text-muted">
            Trade under a generated handle. You can switch later.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 pl-7">
            <span className="num rounded-md bg-muted px-3 py-1.5 text-sm font-semibold text-red">
              {handle}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={rerolling}
              onClick={onReroll}
            >
              {rerolling ? "Rerolling…" : "Reroll"}
            </Button>
          </div>
        </div>

        <div
          className={`${optionBase} ${
            mode === "real" ? "border-red" : "border-hairline hover:border-border-strong"
          }`}
        >
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="display-mode"
              value="real"
              checked={mode === "real"}
              onChange={() => setMode("real")}
              className="h-4 w-4 accent-red"
            />
            <span className="font-semibold text-text">Real name</span>
          </label>
          <p className="text-sm text-text-muted">
            Show your actual name on markets and the leaderboard.
          </p>
          {mode === "real" ? (
            <div className="mt-2 pl-7">
              <Input
                id="real-name"
                label="Your name"
                autoComplete="name"
                value={realName}
                onChange={(event) => setRealName(event.target.value)}
                placeholder="Dana Husky"
              />
            </div>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-semibold text-text">
          Pick your theme
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border bg-card p-4 font-semibold text-text transition-colors duration-200 ease-standard ${
                appearance === option.value
                  ? "border-red"
                  : "border-hairline hover:border-border-strong"
              }`}
            >
              <input
                type="radio"
                name="appearance"
                value={option.value}
                checked={appearance === option.value}
                onChange={() => onChooseAppearance(option.value)}
                className="h-4 w-4 accent-red"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="text-sm text-market-no">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto"
      >
        {submitting ? "Saving…" : "Start trading"}
      </Button>
    </form>
  );
}
