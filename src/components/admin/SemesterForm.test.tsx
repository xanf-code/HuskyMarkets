import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SemesterRow } from "@/lib/queries/admin";
import { SemesterForm } from "./SemesterForm";

const { closeSemester, reopenSemester, upsertSemester, refresh } = vi.hoisted(
  () => ({
    closeSemester: vi.fn(),
    reopenSemester: vi.fn(),
    upsertSemester: vi.fn(),
    refresh: vi.fn(),
  }),
);

vi.mock("@/actions/admin", () => ({
  closeSemester,
  reopenSemester,
  upsertSemester,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const openSemester: SemesterRow = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  name: "Fall 2026",
  startsAt: "2026-09-01T00:00:00.000Z",
  endsAt: "2026-12-15T00:00:00.000Z",
  isClosed: false,
};

const closedSemester: SemesterRow = {
  ...openSemester,
  id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  name: "Spring 2026",
  isClosed: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  closeSemester.mockResolvedValue({ ok: true });
  reopenSemester.mockResolvedValue({ ok: true });
  upsertSemester.mockResolvedValue({ ok: true });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("SemesterForm", () => {
  it("shows Close for open semesters and Re-open for frozen ones", () => {
    render(<SemesterForm semesters={[openSemester, closedSemester]} />);

    expect(
      screen.getByRole("button", { name: "Close semester" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Re-open semester" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Hall of Fame frozen/)).toBeInTheDocument();
  });

  it("skips close when confirm is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<SemesterForm semesters={[openSemester]} />);

    await user.click(screen.getByRole("button", { name: "Close semester" }));

    expect(closeSemester).not.toHaveBeenCalled();
  });

  it("closes after confirm and shows success feedback", async () => {
    const user = userEvent.setup();
    render(<SemesterForm semesters={[openSemester]} />);

    await user.click(screen.getByRole("button", { name: "Close semester" }));

    await waitFor(() => {
      expect(closeSemester).toHaveBeenCalledWith({
        semesterId: openSemester.id,
      });
    });
    expect(screen.getByText("Froze top 10 for Fall 2026.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("re-opens after confirm and shows success feedback", async () => {
    const user = userEvent.setup();
    render(<SemesterForm semesters={[closedSemester]} />);

    await user.click(screen.getByRole("button", { name: "Re-open semester" }));

    await waitFor(() => {
      expect(reopenSemester).toHaveBeenCalledWith({
        semesterId: closedSemester.id,
      });
    });
    expect(screen.getByText("Re-opened Spring 2026.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("disables actions while a close is in flight", async () => {
    let resolveClose: (value: { ok: true }) => void = () => {};
    closeSemester.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveClose = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<SemesterForm semesters={[openSemester, closedSemester]} />);

    await user.click(screen.getByRole("button", { name: "Close semester" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Close semester" })).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "Re-open semester" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create semester" })).toBeDisabled();

    resolveClose({ ok: true });
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("surfaces close errors", async () => {
    closeSemester.mockResolvedValue({ ok: false, error: "Only admins can do that." });
    const user = userEvent.setup();
    render(<SemesterForm semesters={[openSemester]} />);

    await user.click(screen.getByRole("button", { name: "Close semester" }));

    expect(await screen.findByText("Only admins can do that.")).toBeInTheDocument();
  });
});
