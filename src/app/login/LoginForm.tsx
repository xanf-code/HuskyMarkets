"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { isNeuEmail, safeReturnPath } from "@/lib/auth";
import { dismissKeyboard } from "@/lib/dismiss-keyboard";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/InlineError";
import { Input } from "@/components/ui/Input";

type Step = "email" | "verify";

function friendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("failed to fetch")
  ) {
    return "Couldn't reach the sign-in service. Check your connection and try again.";
  }
  if (
    lower.includes("token") ||
    lower.includes("invalid") ||
    lower.includes("expired") ||
    lower.includes("otp")
  ) {
    return "Invalid or expired code. Request a new one.";
  }
  return raw;
}

export function LoginForm() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeReturnPath(searchParams.get("next")) ?? "/";

  async function onSendCode(event: FormEvent<HTMLFormElement>) {
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

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: value,
      });
      if (otpError) {
        setError(friendlyError(otpError.message));
        return;
      }
      setStep("verify");
    } catch {
      setError(
        "Couldn't reach the sign-in service. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dismissKeyboard();
    setError(null);

    if (code.length !== 6) {
      setError("Enter all 6 digits.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (verifyError) {
        setError(friendlyError(verifyError.message));
        return;
      }
      router.push(next);
    } catch {
      setError(
        "Couldn't reach the sign-in service. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    setStep("email");
    setCode("");
    setError(null);
  }

  async function onResend() {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOtp({ email });
    } finally {
      setLoading(false);
    }
  }

  if (step === "verify") {
    return (
      <form onSubmit={onVerifyCode} noValidate className="space-y-5">
        <p className="text-sm text-text-muted">
          Code sent to{" "}
          <span className="break-all font-semibold text-text">{email}</span>.{" "}
          <button
            type="button"
            onClick={goBack}
            className="font-semibold text-red underline underline-offset-2"
          >
            Use a different email
          </button>
        </p>
        <Input
          id="login-code"
          name="code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          required
          label="6-digit code"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="000000"
          maxLength={6}
        />
        {error ? <InlineError>{error}</InlineError> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={loading} className="w-full sm:w-auto">
            {loading ? "Verifying…" : "Verify code"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={onResend}
            className="w-full sm:w-auto"
          >
            Resend code
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSendCode} noValidate className="space-y-5">
      <Input
        id="login-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        label="Northeastern email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@northeastern.edu"
        maxLength={254}
        error={error?.includes("@northeastern.edu") ? error : undefined}
      />
      {error && !error.includes("@northeastern.edu") ? (
        <InlineError>{error}</InlineError>
      ) : null}
      <Button type="submit" loading={loading} className="w-full sm:w-auto">
        {loading ? "Sending…" : "Send code"}
      </Button>
    </form>
  );
}
