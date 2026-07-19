"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createMarket } from "@/actions/markets";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CATEGORIES, CONTENT_RULE } from "@/lib/constants";

/** Convert a datetime-local value (wall clock in local TZ) to ISO with offset. */
function localInputToIso(value: string): string {
  const d = new Date(value);
  return d.toISOString();
}

export function CreateMarketForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    const agree = form.get("agreeRules") === "on";
    if (!agree) {
      setError("You must agree to the market rules.");
      return;
    }

    setLoading(true);
    const result = await createMarket({
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? "") || undefined,
      category: String(form.get("category") ?? ""),
      closeAt: localInputToIso(String(form.get("closeAt") ?? "")),
      resolveAt: localInputToIso(String(form.get("resolveAt") ?? "")),
      resolutionCriteria: String(form.get("resolutionCriteria") ?? ""),
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
      <aside className="card-surface border-l-4 border-l-red px-4 py-4 text-sm text-text">
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
          className="w-full rounded-md border border-hairline bg-card px-4 py-3 text-base text-text focus:border-red focus:outline-none sm:px-5 sm:py-4"
        />
      </label>

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
        />
        <Input
          id="resolveAt"
          name="resolveAt"
          label="Resolves by (local time)"
          type="datetime-local"
          required
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
          rows={4}
          className="w-full rounded-md border border-hairline bg-card px-4 py-3 text-base text-text focus:border-red focus:outline-none sm:px-5 sm:py-4"
          placeholder="Resolves YES if MBTA Tracker shows Green Line on-time rate ≥ 90% for Friday service day."
        />
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

      {error ? (
        <p role="alert" className="text-sm text-market-no">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? "Creating…" : "Create market"}
      </Button>
    </form>
  );
}
