import { timeAgo } from "@/lib/format";
import type { ActionLogRow } from "@/lib/queries/admin";

export function ActionLog({ rows }: { rows: ActionLogRow[] }) {
  if (rows.length === 0) {
    return <p className="num text-sm text-text-muted">&gt; no mod actions yet_</p>;
  }

  return (
    <ul className="flex flex-col gap-px border border-hairline bg-hairline">
      {rows.map((r) => (
        <li key={r.id} className="bg-page px-4 py-3 sm:px-5">
          <p className="text-sm text-text">
            <span className="font-semibold">{r.moderatorName}</span>{" "}
            <span className="num text-red-bright">{r.action}</span>
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
          <p className="num mt-1 text-xs text-text-muted">{timeAgo(r.createdAt)}</p>
        </li>
      ))}
    </ul>
  );
}
