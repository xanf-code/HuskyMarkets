"use client";

import { useEffect, useRef, useState } from "react";
import { useSignInPrompt } from "./SignInPromptProvider";

const SESSION_KEY = "hm-guest-prompted";

/**
 * Elevated conversion CTA after browsing — card-surface + dismiss, distinct
 * from the quiet GuestHeroBanner orientation strip at the top.
 */
export function GuestScrollPrompt() {
  const { promptSignIn } = useSignInPrompt();
  const cardRef = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    let alreadyPrompted = false;
    try {
      alreadyPrompted = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      alreadyPrompted = false;
    }
    if (alreadyPrompted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        try {
          sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          // Storage unavailable (private mode) — the prompt still fires once.
        }
        promptSignIn();
      },
      { rootMargin: "200px" },
    );

    function onScroll() {
      observer.observe(card!);
    }
    window.addEventListener("scroll", onScroll, { once: true, passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [promptSignIn]);

  if (dismissed) return null;

  return (
    <div
      ref={cardRef}
      role="region"
      aria-label="Sign in prompt"
      className="card-surface flex flex-col items-start gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">
          Place your first prediction.
        </p>
        <p className="mt-1 text-sm text-text-muted">
          Sign in to bet HuskyCoin on campus events and see how you stack up on
          the leaderboard.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={promptSignIn}
          className="rounded-md bg-red px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-red-hover focus-visible:outline-red"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss sign-in prompt"
          className="rounded-md px-2 py-2 text-sm text-text-muted hover:text-text focus-visible:outline-red"
        >
          ×
        </button>
      </div>
    </div>
  );
}
