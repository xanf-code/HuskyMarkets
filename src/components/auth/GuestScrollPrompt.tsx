"use client";

import { useEffect, useRef } from "react";
import { useSignInPrompt } from "./SignInPromptProvider";

const SESSION_KEY = "hm-guest-prompted";

/**
 * Homepage funnel for guests: scrolling near the bottom opens the sign-in
 * dialog once per session (sessionStorage flag; private-mode storage failures
 * just fall back to once per page view).
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
          // Storage unavailable (private mode) — the prompt still fires once
          // for this page view.
        }
        promptSignIn();
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [promptSignIn]);

  return <div ref={sentinelRef} aria-hidden="true" className="h-px" />;
}
