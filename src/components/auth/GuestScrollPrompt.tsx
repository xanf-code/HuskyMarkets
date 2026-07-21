"use client";

import { useEffect, useRef } from "react";
import { useSignInPrompt } from "./SignInPromptProvider";

const SESSION_KEY = "hm-guest-prompted";

/**
 * Once-per-session sign-in prompt when the guest reaches the bottom of the
 * board. Sentinel only — header Sign in + gated actions cover the rest.
 */
export function GuestScrollPrompt() {
  const { promptSignIn } = useSignInPrompt();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

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
      observer.observe(sentinel!);
    }
    window.addEventListener("scroll", onScroll, { once: true, passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [promptSignIn]);

  return <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />;
}
