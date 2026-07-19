"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { closeSemester, upsertSemester } from "@/actions/admin";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { SemesterRow } from "@/lib/queries/admin";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SemesterForm({ semesters }: { semesters: SemesterRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const result = await upsertSemester({
      name: String(form.get("name") ?? ""),
      startsAt: new Date(String(form.get("startsAt") ?? "")).toISOString(),
      endsAt: new Date(String(form.get("endsAt") ?? "")).toISOString(),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Semester saved.");
    event.currentTarget.reset();
    router.refresh();
  }

  async function onClose(semesterId: string, name: string) {
    setError(null);
    setMessage(null);
    const result = await closeSemester({ semesterId });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(`Froze top 10 for ${name}.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <p role="alert" className="text-sm text-market-no">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-text-muted">{message}</p> : null}

      <form
        onSubmit={onCreate}
        className="card-surface flex flex-col gap-4 p-4 sm:p-6"
      >
        <h2 className="text-xl font-semibold text-text">Add semester</h2>
        <Input id="name" name="name" label="Name" required placeholder="Fall 2026" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="startsAt" name="startsAt" label="Starts" type="datetime-local" required />
          <Input id="endsAt" name="endsAt" label="Ends" type="datetime-local" required />
        </div>
        <Button type="submit" className="w-full sm:w-auto">
          Create semester
        </Button>
      </form>

      {semesters.length === 0 ? (
        <p className="rounded-md bg-muted px-4 py-8 text-center text-sm text-text-muted">
          No semesters configured yet.
        </p>
      ) : (
        <ul className="card-surface divide-y divide-hairline overflow-hidden">
          {semesters.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 bg-card px-4 py-4 sm:px-5"
            >
              <div>
                <p className="font-semibold text-text">{s.name}</p>
                <p className="num mt-1 text-xs text-text-muted">
                  {toLocalInput(s.startsAt)} &ndash; {toLocalInput(s.endsAt)}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => onClose(s.id, s.name)}>
                Close semester
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
