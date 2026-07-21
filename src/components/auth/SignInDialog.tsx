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
    <Dialog open={open} onClose={onClose} title="Sign in to bet">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-pretty text-text-muted">
          Northeastern students only — use your{" "}
          <span className="font-semibold text-text">@northeastern.edu</span>{" "}
          email.
        </p>
        <Link
          href={loginHref}
          onClick={onClose}
          className={`${buttonStyles({ size: "lg" })} w-full`}
        >
          Continue with Northeastern email
        </Link>
      </div>
    </Dialog>
  );
}
