import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
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
          Northeastern email - we&apos;ll send a one-tap link.
        </p>
      </div>
      {/* useSearchParams (the ?next= return path) requires a Suspense boundary. */}
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-hidden="true">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-11 w-48 rounded-md" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
