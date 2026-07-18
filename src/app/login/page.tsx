import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in · HuskyMarkets",
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-8 sm:py-16">
      <div>
        <p className="eyebrow text-red-bright">HuskyMarkets</p>
        <h1 className="mt-3 font-serif text-3xl text-text sm:text-4xl">
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
