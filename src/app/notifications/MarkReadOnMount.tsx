"use client";

import { useEffect, useRef } from "react";
import { markNotificationsRead } from "@/actions/notifications";

interface MarkReadOnMountProps {
  /** Ids of the currently-unread rows to flip to read on mount. */
  ids: string[];
}

/**
 * Fire-and-forget: marks the visible unread notifications as read once, on
 * mount. Renders nothing. A ref guards against double-invocation (React
 * Strict Mode mounts effects twice in development).
 */
export function MarkReadOnMount({ ids }: MarkReadOnMountProps) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    if (ids.length === 0) return;
    done.current = true;
    void markNotificationsRead(ids);
  }, [ids]);

  return null;
}
