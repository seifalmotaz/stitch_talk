import { describe, expect, it } from "vitest";
import { chatRequestSchema } from "@/server/chat/contract";
import { encodeSseEvent } from "@/server/chat/sse";
import { deriveThreadTitle } from "@/server/dal/format";
import { parseBriefPayload } from "@/server/dal/briefs";

describe("backend parsing helpers", () => {
  it("derives a compact title from the first line", () => {
    expect(deriveThreadTitle("Warm, editorial healthcare app\nMore detail")).toBe(
      "Warm, editorial healthcare app",
    );
    expect(deriveThreadTitle("x".repeat(90))).toHaveLength(68);
  });

  it("parses fenced brief JSON", () => {
    expect(
      parseBriefPayload('```json\n{"prompt":"Build warmly","gaps":["Audience"]}\n```'),
    ).toEqual({ prompt: "Build warmly", gaps: ["Audience"] });
  });

  it("rejects an empty brief", () => {
    expect(parseBriefPayload('{"prompt":""}')).toBeNull();
  });

  it("validates the server-owned chat request contract", () => {
    const valid = chatRequestSchema.parse({
      threadId: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      content: "A warmer direction",
    });
    expect(valid.attachmentIds).toEqual([]);
    expect(() =>
      chatRequestSchema.parse({
        threadId: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        content: "",
      }),
    ).toThrow();
  });

  it("JSON-encodes multiline SSE payloads", () => {
    expect(encodeSseEvent("delta", { delta: "one\ntwo" })).toBe(
      'event: delta\ndata: {"delta":"one\\ntwo"}\n\n',
    );
  });
});
