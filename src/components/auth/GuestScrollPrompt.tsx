"use client";

import { useEffect, useRef } from "react";
import { useSignInPrompt } from "./SignInPromptProvider";

const SESSION_KEY = "hm-guest-prompted";

/**
 * Homepage funnel for guests: scrolling near the bottom opens the sign-in
 * dialog once per session (sessionStorage flag; private-mode storage failures
 * just fall back to once per page view).
 *
 * The observer is gated behind the first scroll event so the dialog does not
 * pop immediately on short pages where the sentinel is already in the viewport
 * at mount.
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

    // Attach the observer only after the first scroll so the dialog doesn't
    // fire immediately when the sentinel is already visible on a short page.
    function onScroll() {
      observer.observe(sentinel!);
    }
    window.addEventListener("scroll", onScroll, { once: true, passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [promptSignIn]);

  return <div ref={sentinelRef} aria-hidden="true" className="h-px" />;
}
