import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { etDayKey } from "@/lib/time";
import { DailyBonusClaimer, DAILY_BONUS_STORAGE_KEY } from "./DailyBonusClaimer";

const { claimDailyBonus } = vi.hoisted(() => ({
  claimDailyBonus: vi.fn(),
}));

vi.mock("@/actions/bonus", () => ({ claimDailyBonus }));

function renderClaimer() {
  return render(
    <ToastProvider>
      <DailyBonusClaimer />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("DailyBonusClaimer", () => {
  it("claims once on mount and toasts +50 HC", async () => {
    claimDailyBonus.mockResolvedValue({ ok: true, claimed: true });

    renderClaimer();

    expect(await screen.findByText(/\+50 HC/)).toBeInTheDocument();
    expect(claimDailyBonus).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(DAILY_BONUS_STORAGE_KEY)).toBe(
      etDayKey(),
    );
  });

  it("skips the RPC entirely when today's ET day is already recorded locally", () => {
    window.localStorage.setItem(DAILY_BONUS_STORAGE_KEY, etDayKey());

    renderClaimer();

    expect(claimDailyBonus).not.toHaveBeenCalled();
  });

  it("stays silent but records the day when the server says already claimed", async () => {
    claimDailyBonus.mockResolvedValue({ ok: true, claimed: false });

    renderClaimer();

    await waitFor(() =>
      expect(window.localStorage.getItem(DAILY_BONUS_STORAGE_KEY)).toBe(
        etDayKey(),
      ),
    );
    expect(screen.queryByText(/\+50 HC/)).not.toBeInTheDocument();
  });

  it("leaves the guard unset on failure so a later visit retries", async () => {
    claimDailyBonus.mockResolvedValue({ ok: false, error: "boom" });

    renderClaimer();

    await waitFor(() => expect(claimDailyBonus).toHaveBeenCalled());
    expect(window.localStorage.getItem(DAILY_BONUS_STORAGE_KEY)).toBeNull();
    expect(screen.queryByText(/\+50 HC/)).not.toBeInTheDocument();
  });
});
