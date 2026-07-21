import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in · HuskyMarkets",
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-8 sm:py-16">
      <div>
        <h1 className="text-balance text-3xl font-semibold text-text sm:text-4xl">
          Sign in
        </h1>
        <p className="mt-2 text-pretty text-sm text-text-muted">
          Northeastern email — we&apos;ll send a one-tap link.
        </p>
      </div>
      {/* useSearchParams (the ?next= return path) requires a Suspense boundary. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
