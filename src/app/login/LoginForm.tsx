"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { isNeuEmail } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const value = email.trim();
    if (!isNeuEmail(value)) {
      setError(
        "HuskyMarkets is open to Northeastern students only — use your @northeastern.edu email.",
      );
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: value,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
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
      <div className="border border-hairline p-6">
        <p className="font-serif text-2xl text-text">Check your email</p>
        <p className="mt-2 text-sm text-text-muted">
          We sent a magic link to{" "}
          <span className="font-mono text-text">{sentTo}</span>. Open it on
          this device to sign in.
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
          className="w-full border border-hairline bg-transparent px-5 py-4 text-base text-text placeholder:text-text-muted/60 transition-colors duration-200 ease-standard focus:border-red focus:outline-none"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-bright">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        withArrow
        disabled={loading}
        className="w-full sm:w-auto"
      >
        {loading ? "Sending…" : "Send magic link"}
      </Button>
    </form>
  );
}
