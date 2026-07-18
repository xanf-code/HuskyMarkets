import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { BailoutButton } from "./BailoutButton";

const { claimBailout } = vi.hoisted(() => ({ claimBailout: vi.fn() }));

vi.mock("@/actions/bonus", () => ({ claimBailout }));

function renderButton() {
  return render(
    <ToastProvider>
      <BailoutButton />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BailoutButton", () => {
  it("claims the bailout and toasts +200 HC", async () => {
    claimBailout.mockResolvedValue({ ok: true, claimed: true });
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: /bailout/i }));

    expect(claimBailout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/\+200 HC/)).toBeInTheDocument();
  });

  it("explains when this week's bailout is already spent", async () => {
    claimBailout.mockResolvedValue({ ok: true, claimed: false });
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: /bailout/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/this week/i);
  });

  it("surfaces an action error", async () => {
    claimBailout.mockResolvedValue({ ok: false, error: "nope" });
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: /bailout/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("nope");
  });
});
