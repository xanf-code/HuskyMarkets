import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuestScrollPrompt } from "./GuestScrollPrompt";

const { promptSignIn } = vi.hoisted(() => ({ promptSignIn: vi.fn() }));

vi.mock("@/components/auth/SignInPromptProvider", () => ({
  useSignInPrompt: () => ({ promptSignIn }),
}));

let intersectionCallback: IntersectionObserverCallback;
let isObserving = false;
const observe = vi.fn(() => { isObserving = true; });
const disconnect = vi.fn(() => { isObserving = false; });

class MockIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) {
    // Capture the callback but only invoke it when the sentinel is actually
    // being observed — matching real IntersectionObserver behaviour.
    intersectionCallback = (entries, obs) => {
      if (isObserving) cb(entries, obs);
    };
  }
  observe = observe;
  disconnect = disconnect;
  unobserve = vi.fn();
  takeRecords = vi.fn();
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

function intersect() {
  act(() => {
    intersectionCallback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  });
}

function scroll() {
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

describe("GuestScrollPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    isObserving = false;
  });

  it("does not prompt if the sentinel intersects at mount before any scroll", () => {
    render(<GuestScrollPrompt />);

    // sentinel is already in the viewport at mount — no scroll yet
    intersect();

    expect(promptSignIn).not.toHaveBeenCalled();
  });

  it("prompts sign-in when the sentinel scrolls into view after a scroll event", () => {
    render(<GuestScrollPrompt />);

    scroll();
    intersect();

    expect(promptSignIn).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalled();
    expect(sessionStorage.getItem("hm-guest-prompted")).toBe("1");
  });

  it("does not prompt again once the session flag is set", () => {
    sessionStorage.setItem("hm-guest-prompted", "1");
    render(<GuestScrollPrompt />);

    expect(observe).not.toHaveBeenCalled();
    expect(promptSignIn).not.toHaveBeenCalled();
  });

  it("still prompts once when sessionStorage is unavailable (private mode)", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    render(<GuestScrollPrompt />);

    scroll();
    intersect();

    expect(promptSignIn).toHaveBeenCalledTimes(1);
    getItem.mockRestore();
  });
});
