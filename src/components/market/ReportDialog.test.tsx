import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportDialog } from "./ReportDialog";

const submitReport = vi.fn();

vi.mock("@/actions/reports", () => ({
  submitReport: (...args: unknown[]) => submitReport(...args),
}));

describe("ReportDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submitReport.mockResolvedValue({ ok: true });
  });

  it("opens the dialog and submits a report", async () => {
    render(<ReportDialog marketId="6f9619ff-8b86-4d01-b42d-00cf4fc964ff" />);

    fireEvent.click(screen.getByRole("button", { name: /report market/i }));
    fireEvent.change(screen.getByLabelText(/why is this market/i), {
      target: { value: "Targets a named student by first and last name." },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit report/i }));

    await waitFor(() => {
      expect(submitReport).toHaveBeenCalledWith({
        marketId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
        reason: "Targets a named student by first and last name.",
      });
    });
    expect(await screen.findByText(/report filed/i)).toBeInTheDocument();
  });
});
