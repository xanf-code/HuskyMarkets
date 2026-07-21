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
    <Dialog open={open} onClose={onClose} title="Got a take? Put HuskyCoin on it.">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-pretty text-text-muted">
          HuskyMarkets is for Northeastern students. Sign in with your{" "}
          <span className="font-semibold text-text">@northeastern.edu</span>{" "}
          email to stake HuskyCoin, track your book, and climb the board.
        </p>
        <Link
          href={loginHref}
          onClick={onClose}
          className={`${buttonStyles({ size: "lg" })} w-full`}
        >
          Sign in with Northeastern email
        </Link>
      </div>
    </Dialog>
  );
}
