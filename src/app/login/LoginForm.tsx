"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { isNeuEmail, safeReturnPath } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const value = email.trim();
    if (!isNeuEmail(value)) {
      setError(
        "Use your @northeastern.edu email. HuskyMarkets is for Northeastern students only.",
      );
      return;
    }

    const next = safeReturnPath(searchParams.get("next"));
    const emailRedirectTo = next
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`
      : `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`;

    setLoading(true);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo },
    });
    setLoading(false);

    if (otpError) {
      setError(otpError.message);
      return;
    }
    setSentTo(value);
  }

  if (sentTo) {
    return (
      <div className="card-surface p-6">
        <p className="text-2xl font-semibold text-text">Link&apos;s on its way</p>
        <p className="mt-2 text-pretty text-sm text-text-muted">
          Sent a sign-in link to{" "}
          <span className="font-semibold text-text">{sentTo}</span>. Open it on
          this device — then you&apos;re on the board.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <label
          htmlFor="login-email"
          className="mb-2 block text-sm font-semibold text-text"
        >
          Northeastern email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@northeastern.edu"
          className="w-full rounded-md border border-hairline bg-card px-4 py-3 text-base text-text placeholder:text-text-tertiary transition-colors duration-200 ease-standard focus:border-red focus:outline-none sm:px-5"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-market-no">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={loading}
        className="w-full sm:w-auto"
      >
        {loading ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
