"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createMarket } from "@/actions/markets";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { InlineError } from "@/components/ui/InlineError";
import {
  CATCH_ALL_LABEL,
  CATEGORIES,
  CONTENT_RULE,
  MAX_OUTCOMES,
  MIN_OUTCOMES,
} from "@/lib/constants";

interface CreateMarketFormProps {
  /** Configured outcome cap read from app_config; falls back to MAX_OUTCOMES. */
  maxOutcomes?: number;
}

/** Convert a datetime-local value (wall clock in local TZ) to ISO with offset. */
function localInputToIso(value: string): string {
  const d = new Date(value);
  return d.toISOString();
}

// One shared collision UX for form and RPC (Missing Consideration 10): the
// message below mirrors the server action's refinement verbatim.
const CATCH_ALL_COLLISION = `"${CATCH_ALL_LABEL}" is added by the catch-all toggle — remove the duplicate label.`;

interface FieldErrors {
  title?: string;
  closeAt?: string;
  resolveAt?: string;
  resolutionCriteria?: string;
  outcomes?: string;
}

function validateFields(
  title: string,
  closeAt: string,
  resolveAt: string,
  resolutionCriteria: string,
  labels: string[],
): FieldErrors {
  const errors: FieldErrors = {};

  if (title.trim().length < 10) {
    errors.title = "Titles need at least 10 characters.";
  } else if (title.trim().length > 120) {
    errors.title = "Titles are capped at 120 characters.";
  }

  if (!closeAt) {
    errors.closeAt = "Close date is required.";
  } else if (new Date(closeAt).getTime() <= Date.now()) {
    errors.closeAt = "Close time must be in the future.";
  }

  if (!resolveAt) {
    errors.resolveAt = "Resolve date is required.";
  } else if (closeAt && new Date(resolveAt) < new Date(closeAt)) {
    errors.resolveAt = "Resolve time must be at or after the close time.";
  }

  if (resolutionCriteria.trim().length < 20) {
    errors.resolutionCriteria =
      "Spell out the resolution criteria (at least 20 characters).";
  }

  const hasBlank = labels.some((l) => l.trim().length === 0);
  if (hasBlank) {
    errors.outcomes = "Outcome labels can't be blank.";
  } else {
    const lower = labels.map((l) => l.trim().toLowerCase());
    if (new Set(lower).size !== lower.length) {
      errors.outcomes = "Outcome labels must be unique.";
    }
  }

  return errors;
}

export function CreateMarketForm({ maxOutcomes = MAX_OUTCOMES }: CreateMarketFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [labels, setLabels] = useState<string[]>(["Yes", "No"]);
  const [catchAll, setCatchAll] = useState(false);

  // The catch-all is appended as the last outcome and counts toward the cap
  // (FR-3): (maxOutcomes - 1) creator labels + catch-all = maxOutcomes.
  const maxLabels = maxOutcomes - (catchAll ? 1 : 0);
  const canAdd = labels.length < maxLabels;
  const canRemove = labels.length > MIN_OUTCOMES;

  function setLabel(index: number, value: string) {
    setLabels((current) =>
      current.map((label, i) => (i === index ? value : label)),
    );
  }

  function addLabel() {
    if (!canAdd) return;
    setLabels((current) => [...current, ""]);
  }

  function removeLabel(index: number) {
    if (!canRemove) return;
    setLabels((current) => current.filter((_, i) => i !== index));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    const title = String(form.get("title") ?? "");
    const closeAt = String(form.get("closeAt") ?? "");
    const resolveAt = String(form.get("resolveAt") ?? "");
    const resolutionCriteria = String(form.get("resolutionCriteria") ?? "");

    const errs = validateFields(title, closeAt, resolveAt, resolutionCriteria, labels);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    const agree = form.get("agreeRules") === "on";
    if (!agree) {
      setError("You must agree to the market rules.");
      return;
    }

    // Catch-all/label collision is rejected inline, matching the RPC (A-1).
    if (
      catchAll &&
      labels.some(
        (label) =>
          label.trim().toLowerCase() === CATCH_ALL_LABEL.toLowerCase(),
      )
    ) {
      setError(CATCH_ALL_COLLISION);
      return;
    }

    setLoading(true);
    const result = await createMarket({
      title,
      description: String(form.get("description") ?? "") || undefined,
      category: String(form.get("category") ?? ""),
      closeAt: localInputToIso(closeAt),
      resolveAt: localInputToIso(resolveAt),
      resolutionCriteria,
      outcomes: labels,
      catchAll,
      agreeRules: true as const,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/market/${result.marketId}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <aside className="card-surface bg-red/5 px-4 py-4 text-sm text-text">
        <p className="text-sm font-semibold text-text">Content rule</p>
        <p className="mt-2 leading-relaxed">{CONTENT_RULE}</p>
      </aside>

      <Input
        id="title"
        name="title"
        label="Title"
        required
        minLength={10}
        maxLength={120}
        placeholder="Will the Green Line run on time Friday?"
        error={fieldErrors.title}
      />

      <label htmlFor="description" className="block">
        <span className="mb-2 block text-sm font-semibold text-text">
          Description <span className="text-text-muted">(optional)</span>
        </span>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          className="w-full min-w-0 rounded-md border border-hairline bg-card px-4 py-3 text-base text-text focus:border-red focus:outline-none sm:px-5 sm:py-4"
        />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-text">
          Outcomes
        </legend>
        <p className="text-xs text-text-muted">
          {MIN_OUTCOMES}–{maxOutcomes} outcomes, one label each. Traders buy
          the outcome they believe wins.
        </p>
        {labels.map((label, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <div className="min-w-0 flex-1">
              <Input
                id={`outcome-${index}`}
                name={`outcome-${index}`}
                label={`Outcome ${index + 1}`}
                required
                minLength={1}
                maxLength={40}
                value={label}
                onChange={(event) => setLabel(index, event.target.value)}
                placeholder={
                  index < 2 ? (index === 0 ? "Yes" : "No") : "Another outcome"
                }
                error={index === 0 ? fieldErrors.outcomes : undefined}
              />
            </div>
            <button
              type="button"
              aria-label={`Remove outcome ${index + 1}`}
              disabled={!canRemove}
              onClick={() => removeLabel(index)}
              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-md border border-hairline bg-muted px-3 text-sm text-text-muted transition-colors duration-200 ease-standard hover:border-border-strong hover:text-text focus-visible:outline-red disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              Remove
            </button>
          </div>
        ))}
        {catchAll ? (
          <Input
            id="catch-all"
            label="Catch-all outcome"
            value={CATCH_ALL_LABEL}
            readOnly
            aria-label="Catch-all outcome"
            className="bg-muted text-text-muted"
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={addLabel}
            disabled={!canAdd}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-hairline bg-muted px-3 py-2 text-sm font-semibold text-text transition-colors duration-200 ease-standard hover:border-border-strong focus-visible:outline-red disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add outcome
          </button>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text has-disabled:cursor-not-allowed has-disabled:opacity-40">
            <input
              type="checkbox"
              checked={catchAll}
              disabled={!catchAll && labels.length >= maxOutcomes}
              onChange={(event) => setCatchAll(event.target.checked)}
              className="size-4 accent-[var(--color-red)]"
            />
            <span>Add &quot;{CATCH_ALL_LABEL}&quot; catch-all</span>
          </label>
        </div>
      </fieldset>

      <Select
        id="category"
        name="category"
        label="Category"
        required
        defaultValue="campus"
        options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="closeAt"
          name="closeAt"
          label="Closes (local time)"
          type="datetime-local"
          required
          error={fieldErrors.closeAt}
        />
        <Input
          id="resolveAt"
          name="resolveAt"
          label="Resolves by (local time)"
          type="datetime-local"
          required
          error={fieldErrors.resolveAt}
        />
      </div>

      <label htmlFor="resolutionCriteria" className="block">
        <span className="mb-2 block text-sm font-semibold text-text">
          How will this resolve? What source decides it?
        </span>
        <textarea
          id="resolutionCriteria"
          name="resolutionCriteria"
          required
          minLength={20}
          maxLength={2000}
          rows={4}
          aria-describedby={fieldErrors.resolutionCriteria ? "resolutionCriteria-error" : undefined}
          aria-invalid={fieldErrors.resolutionCriteria ? true : undefined}
          className={`w-full min-w-0 rounded-md border ${fieldErrors.resolutionCriteria ? "border-red" : "border-hairline"} bg-card px-4 py-3 text-base text-text focus:border-red focus:outline-none sm:px-5 sm:py-4`}
          placeholder="Resolves to the outcome matching the official MBTA Tracker on-time report for Friday service."
        />
        {fieldErrors.resolutionCriteria ? (
          <InlineError id="resolutionCriteria-error" className="mt-1 text-xs">
            {fieldErrors.resolutionCriteria}
          </InlineError>
        ) : null}
      </label>

      <label className="flex cursor-pointer items-start gap-3 text-sm text-text">
        <input
          type="checkbox"
          name="agreeRules"
          className="mt-1 size-4 accent-[var(--color-red)]"
        />
        <span>
          I acknowledge the content rule above and confirm this market does not
          target named individual students or private individuals&apos; personal
          lives.
        </span>
      </label>

      {error ? <InlineError>{error}</InlineError> : null}

      <Button type="submit" loading={loading} className="w-full sm:w-auto">
        {loading ? "Creating…" : "Create market"}
      </Button>
    </form>
  );
}
