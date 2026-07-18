import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./Toast";

function Probe() {
  const { push } = useToast();
  return (
    <button type="button" onClick={() => push("+50 HC claimed")}>
      claim
    </button>
  );
}

function renderWithProvider() {
  return render(
    <ToastProvider>
      <Probe />
    </ToastProvider>,
  );
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a pushed message", () => {
    renderWithProvider();

    fireEvent.click(screen.getByRole("button", { name: "claim" }));

    expect(screen.getByText("+50 HC claimed")).toBeInTheDocument();
  });

  it("dismisses via the dismiss button", () => {
    renderWithProvider();

    fireEvent.click(screen.getByRole("button", { name: "claim" }));
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(screen.queryByText("+50 HC claimed")).not.toBeInTheDocument();
  });

  it("auto-dismisses after the toast duration", () => {
    renderWithProvider();

    fireEvent.click(screen.getByRole("button", { name: "claim" }));
    expect(screen.getByText("+50 HC claimed")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.queryByText("+50 HC claimed")).not.toBeInTheDocument();
  });
});
