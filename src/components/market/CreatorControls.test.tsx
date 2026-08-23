import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { CreatorControls } from "./CreatorControls";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/actions/markets", () => ({
  deleteOwnMarket: vi.fn(),
  lockOwnMarket: vi.fn(),
}));

function renderControls(
  status: "open" | "closed" | "resolved" | "voided" | "pending" | "rejected",
  hasBets = false,
) {
  return render(
    <ToastProvider>
      <CreatorControls marketId="market-1" status={status} hasBets={hasBets} />
    </ToastProvider>,
  );
}

describe("CreatorControls", () => {
  it("offers withdrawal, but not editing, while review is pending", () => {
    renderControls("pending");

    expect(screen.getByText(/awaiting staff review/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /withdraw submission/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /edit pool/i }),
    ).not.toBeInTheDocument();
  });

  it("does not advertise edit or delete controls for rejected markets", () => {
    renderControls("rejected");

    expect(screen.getByText(/no longer under review/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /edit pool/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete|withdraw/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps edit and delete controls for an open market without bets", () => {
    renderControls("open");

    expect(screen.getByRole("link", { name: /edit pool/i })).toHaveAttribute(
      "href",
      "/market/market-1/edit",
    );
    expect(
      screen.getByRole("button", { name: /delete pool/i }),
    ).toBeInTheDocument();
  });

  it("does not advertise edit controls after settlement", () => {
    renderControls("resolved");

    expect(
      screen.queryByRole("link", { name: /edit pool/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete|withdraw/i }),
    ).not.toBeInTheDocument();
  });
});
