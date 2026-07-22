import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { ShareActions } from "./ShareActions";

describe("ShareActions", () => {
  it("copies the share link and confirms with a toast", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ShareActions path="/share/bet/b1" title="Called it" />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: /copy link/i }));

    expect(await screen.findByText(/link copied/i)).toBeInTheDocument();
  });
});
