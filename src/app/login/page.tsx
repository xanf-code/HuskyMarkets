import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in · HuskyMarkets",
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-8 sm:py-16">
      <div>
        <h1 className="text-3xl font-semibold text-text sm:text-4xl">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Magic-link sign-in for Northeastern students. No password needed.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
