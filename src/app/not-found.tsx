import Link from "next/link";
import { buttonStyles } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 py-10 sm:py-16">
      <p className="text-sm font-semibold text-red">404</p>
      <h1 className="text-balance text-2xl font-semibold text-text sm:text-3xl">
        Page not found
      </h1>
      <p className="text-pretty text-sm text-text-muted sm:text-base">
        That market or page isn&apos;t here — it may have been removed, or the
        link is off.
      </p>
      <Link href="/" className={buttonStyles({ variant: "primary" })}>
        Back to markets
      </Link>
    </div>
  );
}
