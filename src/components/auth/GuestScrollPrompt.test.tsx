import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuestScrollPrompt } from "./GuestScrollPrompt";

const { promptSignIn } = vi.hoisted(() => ({ promptSignIn: vi.fn() }));

vi.mock("@/components/auth/SignInPromptProvider", () => ({
  useSignInPrompt: () => ({ promptSignIn }),
}));

let intersectionCallback: IntersectionObserverCallback;
const observe = vi.fn();
const disconnect = vi.fn();

class MockIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) {
    intersectionCallback = cb;
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

describe("GuestScrollPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("prompts sign-in when the bottom sentinel scrolls into view", () => {
    render(<GuestScrollPrompt />);

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

    intersect();

    expect(promptSignIn).toHaveBeenCalledTimes(1);
    getItem.mockRestore();
  });
});
