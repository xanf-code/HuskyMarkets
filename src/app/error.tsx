"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonStyles } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 py-10 sm:py-16">
      <p className="text-sm font-semibold text-red">Something went wrong</p>
      <h1 className="text-balance text-2xl font-semibold text-text sm:text-3xl">
        Couldn&apos;t load this page
      </h1>
      <p className="text-pretty text-sm text-text-muted sm:text-base">
        A temporary glitch hit the board. Try again — your stakes and balance
        are safe.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Link href="/" className={buttonStyles({ variant: "secondary" })}>
          Back to markets
        </Link>
      </div>
    </div>
  );
}
