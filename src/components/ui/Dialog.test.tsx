import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("renders nothing when closed", () => {
    render(
      <Dialog open={false} onClose={() => {}} title="Report market">
        <p>dialog body</p>
      </Dialog>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the title and children when open", () => {
    render(
      <Dialog open={true} onClose={() => {}} title="Report market">
        <p>dialog body</p>
      </Dialog>,
    );

    expect(
      screen.getByRole("dialog", { name: "Report market" }),
    ).toBeInTheDocument();
    expect(screen.getByText("dialog body")).toBeInTheDocument();
  });

  it("closes via the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open={true} onClose={onClose} title="Report market">
        <p>dialog body</p>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open={true} onClose={onClose} title="Report market">
        <p>dialog body</p>
      </Dialog>,
    );

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("locks body scroll while open and restores on close", () => {
    const { rerender } = render(
      <Dialog open={true} onClose={() => {}} title="Report market">
        <p>dialog body</p>
      </Dialog>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Dialog open={false} onClose={() => {}} title="Report market">
        <p>dialog body</p>
      </Dialog>,
    );

    expect(document.body.style.overflow).toBe("");
  });
});
