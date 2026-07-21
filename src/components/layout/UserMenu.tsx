"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutsideClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function signOut() {
    if (pending) return;
    setPending(true);
    setOpen(false);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setPending(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="User menu"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border-strong bg-card text-text-muted transition-colors duration-200 ease-standard hover:bg-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.5 1.5 0 0 0 .41 1.412A8.957 8.957 0 0 0 10 18c2.167 0 4.154-.78 5.625-2.095a1.5 1.5 0 0 0 .41-1.412A9 9 0 0 0 3.464 14.493Z" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-40 rounded-md border border-border-strong bg-card shadow-lg"
        >
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center px-4 py-2.5 text-sm font-medium text-text transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:bg-muted rounded-t-md"
          >
            Profile
          </Link>
          <div className="border-t border-hairline" />
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            disabled={pending}
            className="flex w-full items-center px-4 py-2.5 text-sm font-medium text-text-muted transition-colors duration-150 hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:bg-muted rounded-b-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
