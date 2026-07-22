"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface ShareActionsProps {
  /** Absolute path, e.g. `/share/bet/abc`. */
  path: string;
  /** Short title for the Web Share sheet. */
  title: string;
  /** Elevate Copy / Share to the primary CTA (share landing). */
  primary?: boolean;
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
export function ShareActions({
  path,
  title,
  primary = false,
  className = "",
}: ShareActionsProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // Detect after mount so SSR markup matches the first client paint.
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator.share === "function");
  }, []);

  async function copyLink() {
    const url = absoluteUrl(path);
    try {
      await navigator.clipboard.writeText(url);
      toast.push("Link copied - paste it anywhere");
    } catch {
      toast.push("Couldn't copy - try selecting the URL");
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

  const copyVariant = primary && !canNativeShare ? "primary" : "secondary";
  const shareVariant = primary ? "primary" : "secondary";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button
        type="button"
        variant={copyVariant}
        size="sm"
        onClick={copyLink}
      >
        Copy link
      </Button>
      {canNativeShare ? (
        <Button
          type="button"
          variant={shareVariant}
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
