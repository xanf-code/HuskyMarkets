"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface ShareActionsProps {
  /** Absolute path, e.g. `/share/bet/abc`. */
  path: string;
  /** Short title for the Web Share sheet. */
  title: string;
  className?: string;
}

function absoluteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

/**
 * Copy link + optional native share for win cards. Prefer real share actions
 * over a dead nav-only "Share" link.
 */
export function ShareActions({ path, title, className = "" }: ShareActionsProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copyLink() {
    const url = absoluteUrl(path);
    try {
      await navigator.clipboard.writeText(url);
      toast.push("Link copied — paste it anywhere");
    } catch {
      toast.push("Couldn’t copy — try selecting the URL");
    }
  }

  async function nativeShare() {
    const url = absoluteUrl(path);
    setBusy(true);
    try {
      await navigator.share({ title, url, text: title });
    } catch (error) {
      // User cancel is fine; real failures fall back to copy.
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyLink();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button type="button" variant="secondary" size="sm" onClick={copyLink}>
        Copy link
      </Button>
      {canNativeShare ? (
        <Button
          type="button"
          size="sm"
          loading={busy}
          onClick={nativeShare}
        >
          Share
        </Button>
      ) : null}
    </div>
  );
}
