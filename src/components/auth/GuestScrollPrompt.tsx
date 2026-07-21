"use client";

import { useEffect, useRef, useState } from "react";
import { useSignInPrompt } from "./SignInPromptProvider";

const SESSION_KEY = "hm-guest-prompted";

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
      className="card-surface p-4 sm:p-5 rounded-lg flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text">Place your first prediction.</p>
        <p className="text-sm text-text-muted mt-0.5">
          Sign in to bet HuskyCoin on campus events and see how you stack up on the leaderboard.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={promptSignIn}
          className="bg-red text-white text-sm font-medium px-4 py-2 rounded-md focus-visible:outline-red"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss sign-in prompt"
          className="text-text-muted hover:text-text text-sm px-2 py-2 rounded-md focus-visible:outline-red"
        >
          ×
        </button>
      </div>
    </div>
  );
}
