"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { isNeuEmail, safeReturnPath } from "@/lib/auth";
import { dismissKeyboard } from "@/lib/dismiss-keyboard";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/InlineError";
import { Input } from "@/components/ui/Input";

/** Map raw auth/network failures to actionable copy. */
function friendlyLoginError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many sign-in attempts. Wait a minute and try again.";
  }
  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("failed to fetch")
  ) {
    return "Couldn't reach the sign-in service. Check your connection and try again.";
  }
  return raw;
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dismissKeyboard();
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
    try {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: value,
        options: { emailRedirectTo },
      });

      if (otpError) {
        setError(friendlyLoginError(otpError.message));
        return;
      }
      setSentTo(value);
    } catch {
      setError(
        "Couldn't reach the sign-in service. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <div className="card-surface p-6">
        <p className="text-xl font-semibold text-text">Check your email</p>
        <p className="mt-2 text-pretty text-sm text-text-muted">
          Sign-in link sent to{" "}
          <span className="break-all font-semibold text-text">{sentTo}</span>.
          Open it on this device.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Input
        id="login-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        label="Northeastern email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@northeastern.edu"
        maxLength={254}
        error={
          error?.includes("@northeastern.edu") ? error : undefined
        }
      />
      {error && !error.includes("@northeastern.edu") ? (
        <InlineError>{error}</InlineError>
      ) : null}
      <Button type="submit" loading={loading} className="w-full sm:w-auto">
        {loading ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
