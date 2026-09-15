import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { describe, expect, it } from "vitest";
import { appendPausedAssistantTurn } from "./client";

describe("appendPausedAssistantTurn", () => {
  it("resends paused server-tool content without a client tool result", () => {
    const messages: MessageParam[] = [
      { role: "user", content: "Research this market." },
    ];
    const pausedContent = [
      {
        type: "server_tool_use",
        id: "srvtoolu_123",
        name: "web_search",
        input: { query: "latest market news" },
      },
    ] as unknown as MessageParam["content"];

    appendPausedAssistantTurn(messages, pausedContent);

    expect(messages).toEqual([
      { role: "user", content: "Research this market." },
      { role: "assistant", content: pausedContent },
    ]);
  });
});
