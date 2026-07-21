"use client";

import { useState, type FormEvent } from "react";
import { applyForModerator } from "@/actions/mod";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/InlineError";

export function ModApplicationForm() {
  const [statement, setStatement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await applyForModerator({ statement });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <p className="text-sm text-text-muted">
        Application submitted. An admin will review it.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label htmlFor="mod-statement" className="block">
        <span className="mb-2 block text-sm font-semibold text-text">
          Why should you moderate?
        </span>
        <textarea
          id="mod-statement"
          required
          rows={4}
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          className="w-full rounded-md border border-hairline bg-card px-4 py-3 text-base text-text placeholder:text-text-tertiary transition-colors duration-200 ease-standard focus:border-red focus:outline-none sm:px-5 sm:py-4"
          placeholder="Campus knowledge, fairness instincts, spare evenings…"
        />
      </label>
      {error ? <InlineError>{error}</InlineError> : null}
      <Button type="submit" loading={loading} className="w-full sm:w-auto">
        {loading ? "Submitting…" : "Apply to be a moderator"}
      </Button>
    </form>
  );
}
