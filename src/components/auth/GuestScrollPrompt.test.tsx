import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuestScrollPrompt } from "./GuestScrollPrompt";

const { promptSignIn } = vi.hoisted(() => ({ promptSignIn: vi.fn() }));

vi.mock("@/components/auth/SignInPromptProvider", () => ({
  useSignInPrompt: () => ({ promptSignIn }),
}));

// IntersectionObserver mock — lets tests manually fire intersection callbacks.
let observerCallback: IntersectionObserverCallback | null = null;
let observedElement: Element | null = null;

const mockObserve = vi.fn((el: Element) => { observedElement = el; });
const mockDisconnect = vi.fn();
const mockUnobserve = vi.fn();

class MockIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) {
    observerCallback = cb;
  }
  observe = mockObserve;
  unobserve = mockUnobserve;
  disconnect = mockDisconnect;
}

vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

function triggerIntersection(isIntersecting: boolean) {
  if (!observerCallback || !observedElement) return;
  act(() => {
    observerCallback!(
      [{ isIntersecting, target: observedElement } as IntersectionObserverEntry],
      new MockIntersectionObserver(observerCallback!) as unknown as IntersectionObserver,
    );
  });
}

describe("GuestScrollPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    observerCallback = null;
    observedElement = null;
  });

  it("does not render a visible sign-in card", () => {
    render(<GuestScrollPrompt />);
    expect(
      screen.queryByRole("complementary", { name: /sign in to place bets/i }),
    ).not.toBeInTheDocument();
    // The old card text should not appear
    expect(screen.queryByText(/you're browsing as a guest/i)).not.toBeInTheDocument();
  });

  it("renders a sentinel element for scroll detection", () => {
    render(<GuestScrollPrompt />);
    expect(document.querySelector("[data-guest-sentinel]")).toBeInTheDocument();
  });

  it("attaches an IntersectionObserver to the sentinel on mount", () => {
    render(<GuestScrollPrompt />);
    expect(mockObserve).toHaveBeenCalledOnce();
  });

  it("shows the CTA modal when the sentinel enters the viewport", async () => {
    render(<GuestScrollPrompt />);

    triggerIntersection(true);

    expect(
      await screen.findByRole("dialog", { name: /join huskymarkets/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/sign in with your northeastern email/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /not now/i })).toBeInTheDocument();
  });

  it("does not open the modal when sentinel is not intersecting", () => {
    render(<GuestScrollPrompt />);

    triggerIntersection(false);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays hidden when the session flag is already set", () => {
    sessionStorage.setItem("hm-guest-prompted", "1");
    render(<GuestScrollPrompt />);

    triggerIntersection(true);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the sign-in prompt and dismisses on Sign in click", async () => {
    const user = userEvent.setup();
    render(<GuestScrollPrompt />);
    triggerIntersection(true);

    await user.click(await screen.findByRole("button", { name: /^sign in$/i }));

    expect(promptSignIn).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("hm-guest-prompted")).toBe("1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("dismisses without prompting on Not now", async () => {
    const user = userEvent.setup();
    render(<GuestScrollPrompt />);
    triggerIntersection(true);

    await user.click(await screen.findByRole("button", { name: /not now/i }));

    expect(promptSignIn).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("hm-guest-prompted")).toBe("1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disconnects the observer after modal is triggered once", async () => {
    render(<GuestScrollPrompt />);
    triggerIntersection(true);

    await screen.findByRole("dialog");

    expect(mockDisconnect).toHaveBeenCalledOnce();
  });

  it("still shows modal when sessionStorage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    render(<GuestScrollPrompt />);
    triggerIntersection(true);

    expect(
      await screen.findByRole("dialog", { name: /join huskymarkets/i }),
    ).toBeInTheDocument();
  });
});
