import { describe, expect, it } from "vitest";
import { dismissKeyboard } from "./dismiss-keyboard";

describe("dismissKeyboard", () => {
  it("blurs the focused element", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);

    dismissKeyboard();

    expect(document.activeElement).not.toBe(input);
    input.remove();
  });

  it("is a no-op when nothing focusable is active", () => {
    (document.activeElement as HTMLElement | null)?.blur();
    expect(() => dismissKeyboard()).not.toThrow();
  });
});
