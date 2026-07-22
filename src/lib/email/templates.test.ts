import { describe, expect, it, vi } from "vitest";
import { buildResolutionEmail } from "./templates";

vi.mock("./unsubscribe-token", () => ({
  buildUnsubscribeToken: () => "test-token",
}));

// Unsubscribe token helper is a pure HMAC derivation — no network needed.
// The test just verifies the shape and content of the output, not the token value.

const USER_ID = "ad6ec69d-93c7-45ef-b35d-8fa094876b04";
const MARKET_ID = "7616378c-45ef-464f-bae3-c726a8578a25";

function build(type: string, payload: Record<string, unknown> = {}) {
  return buildResolutionEmail(
    { type, payload: { market_title: "Will Northeastern extend spring break?", ...payload }, market_id: MARKET_ID },
    USER_ID,
  );
}

describe("buildResolutionEmail — market_approved", () => {
  it("subject confirms approval", () => {
    const { subject } = build("market_approved");
    expect(subject).toMatch(/approved/i);
  });

  it("body copy mentions the market title", () => {
    const { html } = build("market_approved");
    expect(html).toContain("Will Northeastern extend spring break?");
  });

  it("body copy says it is now live", () => {
    const { html } = build("market_approved");
    expect(html.toLowerCase()).toMatch(/live|approved/);
  });

  it("includes a View Market button linking to the market", () => {
    const { html } = build("market_approved");
    expect(html).toContain(`/market/${MARKET_ID}`);
  });

  it("includes List-Unsubscribe headers", () => {
    const { headers } = build("market_approved");
    expect(headers["List-Unsubscribe"]).toMatch(/unsubscribe/);
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

describe("buildResolutionEmail — market_rejected", () => {
  it("subject signals rejection", () => {
    const { subject } = build("market_rejected");
    expect(subject).toMatch(/not approved|rejected/i);
  });

  it("body copy mentions the market title", () => {
    const { html } = build("market_rejected");
    expect(html).toContain("Will Northeastern extend spring break?");
  });

  it("includes List-Unsubscribe headers", () => {
    const { headers } = build("market_rejected");
    expect(headers["List-Unsubscribe"]).toMatch(/unsubscribe/);
  });
});

describe("buildResolutionEmail — existing types still work", () => {
  it("market_resolved won produces a congratulatory subject", () => {
    const { subject } = build("market_resolved", { result: "won", amount: 42 });
    expect(subject).toMatch(/won/i);
  });

  it("market_voided creator produces a voided subject", () => {
    const { subject } = build("market_voided", { role: "creator" });
    expect(subject).toMatch(/voided/i);
  });
});
