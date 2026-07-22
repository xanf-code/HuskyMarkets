"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { dismissPromoBanner, isPromoBannerDismissed } from "@/lib/onboarding-flags";
import { useSignInPrompt } from "./SignInPromptProvider";

export function GuestPromoBanner() {
  const [visible, setVisible] = useState(false);
  const { promptSignIn } = useSignInPrompt();

  useEffect(() => {
    setVisible(!isPromoBannerDismissed());
  }, []);

  if (!visible) return null;

  function dismiss() {
    dismissPromoBanner();
    setVisible(false);
  }

  return (
    <div
      role="banner"
      className="relative border-b border-hairline bg-card"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:gap-6 sm:px-6">
        {/* Gift card image */}
        <div className="shrink-0">
          <Image
            src="/gift-card.png"
            alt="Northeastern Campus Store $150 Gift Card"
            width={72}
            height={45}
            className="h-auto w-auto rounded object-cover shadow-sm"
            priority
          />
        </div>

        {/* Text content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">
            Win a{" "}
            <span className="text-red">$150 Campus Store Gift Card</span>
          </p>
          <p className="text-xs text-text-muted leading-snug mt-0.5">
            Finish top on the{" "}
            <span className="font-medium text-text">Fall 2026 leaderboard.</span>{" "}
            Place your first prediction to get started.
          </p>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={promptSignIn}
          className="shrink-0 hidden sm:inline-flex items-center rounded-pill bg-red px-4 py-2 text-xs font-semibold text-white transition-colors duration-200 hover:bg-red-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
        >
          Join & compete
        </button>

        {/* Dismiss */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss promotion"
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      {/* Mobile CTA row */}
      <div className="sm:hidden border-t border-hairline bg-muted/50 px-4 py-2.5">
        <button
          type="button"
          onClick={promptSignIn}
          className="w-full inline-flex items-center justify-center rounded-pill bg-red px-4 py-2 text-xs font-semibold text-white transition-colors duration-200 hover:bg-red-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
        >
          Join &amp; compete for the gift card
        </button>
      </div>
    </div>
  );
}
