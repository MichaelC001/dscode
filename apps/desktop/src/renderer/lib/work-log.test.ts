import { describe, expect, it } from "vitest";
import type { ChatMessage, ToolActivity, TurnWorkEntry } from "./conversation";
import { groupWorkTimeline, recentWorkTimeline } from "./work-log";

describe("work log grouping", () => {
  it("groups adjacent tools from the same family and preserves surrounding steps", () => {
    const timeline = makeTimeline([
      { type: "thinking", id: "thinking-1", text: "Inspect" },
      tool("command-1", "exec_command"),
      tool("command-2", "bash"),
      tool("read-1", "read_file"),
      { type: "thinking", id: "thinking-2", text: "Verify" },
      tool("read-2", "read_file"),
      tool("read-3", "read_file"),
    ]);

    const grouped = groupWorkTimeline(timeline);

    expect(grouped.map((entry) => entry.type === "tool-group" ? `${entry.kind}:${entry.entries.length}` : entry.entry.item.type)).toEqual([
      "thinking",
      "command:2",
      "tool",
      "thinking",
      "read:2",
    ]);
  });

  it("does not combine same-kind tools across reasoning or text", () => {
    const timeline = makeTimeline([
      tool("command-1", "exec_command"),
      { type: "thinking", id: "thinking-1", text: "Check output" },
      tool("command-2", "exec_command"),
      { type: "text", id: "text-1", text: "Continuing" },
      tool("command-3", "exec_command"),
    ]);

    expect(groupWorkTimeline(timeline).map((entry) => entry.type)).toEqual(["item", "item", "item", "item", "item"]);
  });

  it("extends the recent slice to keep a tool group intact", () => {
    const timeline = makeTimeline([
      { type: "thinking", id: "thinking-1", text: "Start" },
      tool("read-1", "read_file"),
      tool("command-1", "exec_command"),
      tool("command-2", "exec_command"),
      tool("command-3", "exec_command"),
      tool("command-4", "exec_command"),
      tool("command-5", "exec_command"),
      { type: "thinking", id: "thinking-2", text: "Done" },
    ]);

    const visible = recentWorkTimeline(timeline, 4);

    expect(visible.map((entry) => entry.item.id)).toEqual([
      "tool-command-1",
      "tool-command-2",
      "tool-command-3",
      "tool-command-4",
      "tool-command-5",
      "thinking-2",
    ]);
  });
});

type InputWorkItem =
  | { type: "thinking"; id: string; text: string }
  | { type: "text"; id: string; text: string }
  | ToolActivity;

function tool(id: string, name: string): ToolActivity {
  return { id, name, title: name, status: "complete", args: { value: id } };
}

function makeTimeline(items: InputWorkItem[]): TurnWorkEntry[] {
  const tools = items.filter((item): item is ToolActivity => "name" in item);
  const message: ChatMessage = {
    id: "message-1",
    role: "assistant",
    text: "",
    images: [],
    tools,
    work: [],
  };

  return items.map((item) => {
    const workItem = "name" in item
      ? { type: "tool" as const, id: `tool-${item.id}`, toolId: item.id }
      : item;
    return { key: workItem.id, message, item: workItem };
  });
}
