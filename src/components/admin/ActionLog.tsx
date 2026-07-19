import { timeAgo } from "@/lib/format";
import type { ActionLogRow } from "@/lib/queries/admin";

export function ActionLog({ rows }: { rows: ActionLogRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md bg-muted px-4 py-8 text-center text-sm text-text-muted">
        No moderator actions yet.
      </p>
    );
  }

  return (
    <ul className="card-surface divide-y divide-hairline overflow-hidden">
      {rows.map((r) => (
        <li key={r.id} className="bg-card px-4 py-3 sm:px-5">
          <p className="text-sm text-text">
            <span className="font-semibold">{r.moderatorName}</span>{" "}
            <span className="font-semibold text-red">{r.action}</span>
            {r.marketTitle ? (
              <>
                {" "}
                on <span className="font-semibold">{r.marketTitle}</span>
              </>
            ) : null}
          </p>
          {r.note ? (
            <p className="mt-1 text-sm text-text-muted">{r.note}</p>
          ) : null}
          <p className="mt-1 text-xs text-text-muted">{timeAgo(r.createdAt)}</p>
        </li>
      ))}
    </ul>
  );
}
