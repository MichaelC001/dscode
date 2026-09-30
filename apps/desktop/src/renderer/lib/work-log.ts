import type { ChatMessage, ToolActivity, TurnWorkEntry, WorkItem } from "./conversation";

export type ToolKind = "command" | "edit" | "plan" | "read" | "search" | "write" | `tool:${string}`;

export interface ResolvedToolEntry extends TurnWorkEntry {
  item: Extract<WorkItem, { type: "tool" }>;
  tool: ToolActivity;
}

export type WorkLogDisplayEntry =
  | { type: "item"; entry: TurnWorkEntry }
  | { type: "tool-group"; key: string; kind: ToolKind; entries: ResolvedToolEntry[] };

const MIN_TOOL_GROUP_SIZE = 2;

export function toolKind(tool: Pick<ToolActivity, "name">): ToolKind {
  const name = tool.name.toLowerCase();
  if (name.includes("exec") || name.includes("bash") || name.includes("command")) return "command";
  if (name === "update_plan") return "plan";
  if (name.includes("read")) return "read";
  if (name.includes("write")) return "write";
  if (name.includes("edit") || name.includes("patch")) return "edit";
  if (name.includes("search")) return "search";
  return `tool:${name}`;
}

export function groupWorkTimeline(timeline: TurnWorkEntry[]): WorkLogDisplayEntry[] {
  const display: WorkLogDisplayEntry[] = [];
  let index = 0;

  while (index < timeline.length) {
    const first = resolveToolEntry(timeline[index]!);
    if (!first) {
      display.push({ type: "item", entry: timeline[index]! });
      index += 1;
      continue;
    }

    const kind = toolKind(first.tool);
    const entries = [first];
    let nextIndex = index + 1;
    while (nextIndex < timeline.length) {
      const next = resolveToolEntry(timeline[nextIndex]!);
      if (!next || toolKind(next.tool) !== kind) break;
      entries.push(next);
      nextIndex += 1;
    }

    if (entries.length >= MIN_TOOL_GROUP_SIZE) {
      display.push({ type: "tool-group", key: `tool-group:${first.key}`, kind, entries });
    } else {
      display.push({ type: "item", entry: first });
    }
    index = nextIndex;
  }

  return display;
}

/** Keeps a same-kind tool run intact when the recent-history boundary falls inside it. */
export function recentWorkTimeline(timeline: TurnWorkEntry[], itemCount: number): TurnWorkEntry[] {
  let startIndex = Math.max(0, timeline.length - itemCount);
  if (startIndex === 0) return timeline;

  const firstVisible = resolveToolEntry(timeline[startIndex]!);
  if (!firstVisible) return timeline.slice(startIndex);
  const kind = toolKind(firstVisible.tool);

  while (startIndex > 0) {
    const previous = resolveToolEntry(timeline[startIndex - 1]!);
    if (!previous || toolKind(previous.tool) !== kind) break;
    startIndex -= 1;
  }
  return timeline.slice(startIndex);
}

function resolveToolEntry(entry: TurnWorkEntry): ResolvedToolEntry | undefined {
  if (entry.item.type !== "tool") return undefined;
  const tool = findTool(entry.message, entry.item.toolId);
  return tool ? { ...entry, item: entry.item, tool } : undefined;
}

function findTool(message: ChatMessage, toolId: string): ToolActivity | undefined {
  return message.tools.find((candidate) => candidate.id === toolId);
}
