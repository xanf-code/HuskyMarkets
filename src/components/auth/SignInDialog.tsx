"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonStyles } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

interface SignInDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SignInDialog({ open, onClose }: SignInDialogProps) {
  const pathname = usePathname();
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;

  return (
    <Dialog open={open} onClose={onClose} title="Sign in to keep going">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          HuskyMarkets is for Northeastern students. Sign in with your{" "}
          <span className="font-semibold text-text">@northeastern.edu</span>{" "}
          email to place predictions, track your portfolio, and climb the
          leaderboard.
        </p>
        <Link
          href={loginHref}
          onClick={onClose}
          className={`${buttonStyles({ size: "lg" })} w-full`}
        >
          Log in with Northeastern email
        </Link>
      </div>
    </Dialog>
  );
}
