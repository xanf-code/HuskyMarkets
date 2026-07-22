import Anthropic from "@anthropic-ai/sdk";
import type { ToolUnion } from "@anthropic-ai/sdk/resources/messages";

export const MODEL = "claude-sonnet-4-6" as const;

export type AiTool = ToolUnion;

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export function makeWebSearchTool(maxUses: number): AiTool {
  return { type: "web_search_20250305", name: "web_search", max_uses: maxUses } as unknown as AiTool;
}
