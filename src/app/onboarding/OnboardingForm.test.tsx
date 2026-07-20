import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "./OnboardingForm";

const { completeOnboarding, rerollAnonHandle, push, refresh } = vi.hoisted(
  () => ({
    completeOnboarding: vi.fn(),
    rerollAnonHandle: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
  }),
);

vi.mock("@/actions/profile", () => ({ completeOnboarding, rerollAnonHandle }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  completeOnboarding.mockResolvedValue({ ok: true });
  document.documentElement.classList.remove("dark");
});

describe("OnboardingForm", () => {
  it("defaults to anonymous mode and shows the generated handle", () => {
    render(<OnboardingForm initialHandle="FrostyHusky07" />);

    expect(screen.getByRole("radio", { name: /anonymous/i })).toBeChecked();
    expect(screen.getByText("FrostyHusky07")).toBeInTheDocument();
  });

  it("rerolls the handle in place", async () => {
    rerollAnonHandle.mockResolvedValue({ ok: true, handle: "CosmicHusky42" });
    const user = userEvent.setup();
    render(<OnboardingForm initialHandle="FrostyHusky07" />);

    await user.click(screen.getByRole("button", { name: /reroll/i }));

    expect(await screen.findByText("CosmicHusky42")).toBeInTheDocument();
    expect(screen.queryByText("FrostyHusky07")).not.toBeInTheDocument();
  });

  it("submits the anonymous choice and navigates home", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm initialHandle="FrostyHusky07" />);

    await user.click(screen.getByRole("button", { name: /start trading/i }));

    expect(completeOnboarding).toHaveBeenCalledWith({
      displayMode: "anon",
      appearance: "light",
    });
    expect(push).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalled();
  });

  it("defaults to the light theme and previews dark instantly on selection", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm initialHandle="FrostyHusky07" />);

    expect(screen.getByRole("radio", { name: /light/i })).toBeChecked();
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await user.click(screen.getByRole("radio", { name: /^dark$/i }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await user.click(screen.getByRole("button", { name: /start trading/i }));

    expect(completeOnboarding).toHaveBeenCalledWith({
      displayMode: "anon",
      appearance: "dark",
    });
  });

  it("requires a name in real-name mode before calling the server", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm initialHandle="FrostyHusky07" />);

    await user.click(screen.getByRole("radio", { name: /real name/i }));
    await user.click(screen.getByRole("button", { name: /start trading/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  it("submits the real name when provided", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm initialHandle="FrostyHusky07" />);

    await user.click(screen.getByRole("radio", { name: /real name/i }));
    await user.type(screen.getByLabelText(/your name/i), "Dana Husky");
    await user.click(screen.getByRole("button", { name: /start trading/i }));

    expect(completeOnboarding).toHaveBeenCalledWith({
      displayMode: "real",
      realName: "Dana Husky",
      appearance: "light",
    });
    expect(push).toHaveBeenCalledWith("/");
  });

  it("surfaces a server error and stays put", async () => {
    completeOnboarding.mockResolvedValue({ ok: false, error: "boom" });
    const user = userEvent.setup();
    render(<OnboardingForm initialHandle="FrostyHusky07" />);

    await user.click(screen.getByRole("button", { name: /start trading/i }));

    expect(await screen.findByText("boom")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
