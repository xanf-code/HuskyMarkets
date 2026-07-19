"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { reviewModApplication, revokeModerator } from "@/actions/admin";
import { Button } from "@/components/ui/Button";
import { timeAgo } from "@/lib/format";
import type { ModApplicationRow, ModeratorRow } from "@/lib/queries/admin";

interface ModApplicationsProps {
  applications: ModApplicationRow[];
  moderators: ModeratorRow[];
}

export function ModApplications({
  applications,
  moderators,
}: ModApplicationsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function review(applicationId: string, decision: "approve" | "reject") {
    setError(null);
    const result = await reviewModApplication({ applicationId, decision });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function revoke(userId: string) {
    setError(null);
    const result = await revokeModerator({ userId });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <p role="alert" className="text-sm text-market-no">
          {error}
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-text">
          Pending applications
        </h2>
        {applications.length === 0 ? (
          <p className="rounded-md bg-muted px-4 py-8 text-center text-sm text-text-muted">
            No pending applications.
          </p>
        ) : (
          <ul className="card-surface divide-y divide-hairline overflow-hidden">
            {applications.map((a) => (
              <li key={a.id} className="bg-card p-4 sm:p-5">
                <p className="font-semibold text-text">{a.displayName}</p>
                <p className="mt-2 text-sm text-text-muted">{a.statement}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {timeAgo(a.createdAt)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => review(a.id, "approve")}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => review(a.id, "reject")}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-text">
          Current moderators
        </h2>
        {moderators.length === 0 ? (
          <p className="rounded-md bg-muted px-4 py-8 text-center text-sm text-text-muted">
            No moderators assigned yet.
          </p>
        ) : (
          <ul className="card-surface divide-y divide-hairline overflow-hidden">
            {moderators.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 bg-card px-4 py-3 sm:px-5"
              >
                <div>
                  <p className="font-semibold text-text">{m.displayName}</p>
                  <p className="text-xs text-text-muted">{m.email}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => revoke(m.id)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
