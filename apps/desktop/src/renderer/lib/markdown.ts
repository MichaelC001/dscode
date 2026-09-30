const URL_PREFIX_PATTERN = /^https?:\/\//i;
const URL_BOUNDARY_PATTERN = /[\s<>"`*\\，。；：！？、（）【】《》“”‘’]/u;
const TRAILING_URL_PUNCTUATION_PATTERN = /[.,;:!?]/;

/**
 * Turn bare HTTP(S) URLs into explicit Markdown autolinks before remark-gfm
 * sees them. Its literal-autolink parser can otherwise consume adjacent CJK
 * punctuation and Markdown delimiters, breaking emphasis and inline code.
 */
export function stabilizeMarkdownAutolinks(markdown: string): string {
  let fence: { marker: "`" | "~"; length: number } | undefined;
  let result = "";
  let offset = 0;

  while (offset < markdown.length) {
    const newline = markdown.indexOf("\n", offset);
    const end = newline === -1 ? markdown.length : newline + 1;
    const line = markdown.slice(offset, end);
    const body = line.endsWith("\n") ? line.slice(0, -1) : line;
    const fenceMatch = body.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);

    if (fence) {
      result += line;
      if (
        fenceMatch
        && fenceMatch[1]![0] === fence.marker
        && fenceMatch[1]!.length >= fence.length
        && fenceMatch[2]!.trim() === ""
      ) fence = undefined;
    } else if (fenceMatch) {
      const marker = fenceMatch[1]!;
      fence = { marker: marker[0] as "`" | "~", length: marker.length };
      result += line;
    } else {
      result += stabilizeMarkdownLine(body) + (line.endsWith("\n") ? "\n" : "");
    }

    offset = end;
  }

  return result;
}

function stabilizeMarkdownLine(line: string): string {
  let result = "";
  let offset = 0;

  while (offset < line.length) {
    if (line[offset] === "`") {
      const markerLength = countRun(line, offset, "`");
      const closingOffset = findMatchingBacktickRun(line, offset + markerLength, markerLength);
      if (closingOffset === -1) return result + line.slice(offset);
      const end = closingOffset + markerLength;
      result += line.slice(offset, end);
      offset = end;
      continue;
    }

    if (line[offset] === "<") {
      const closingOffset = line.indexOf(">", offset + 1);
      if (closingOffset !== -1) {
        result += line.slice(offset, closingOffset + 1);
        offset = closingOffset + 1;
        continue;
      }
    }

    const remainder = line.slice(offset);
    const prefix = remainder.match(URL_PREFIX_PATTERN)?.[0];
    if (!prefix) {
      result += line[offset];
      offset += 1;
      continue;
    }

    let urlEnd = offset + prefix.length;
    let parentheses = 0;
    while (urlEnd < line.length) {
      const character = line[urlEnd]!;
      if (URL_BOUNDARY_PATTERN.test(character) || character === "]" || character === "}") break;
      if (character === "(") parentheses += 1;
      if (character === ")") {
        if (parentheses === 0) break;
        parentheses -= 1;
      }
      urlEnd += 1;
    }
    while (
      urlEnd > offset + prefix.length
      && TRAILING_URL_PUNCTUATION_PATTERN.test(line[urlEnd - 1]!)
    ) urlEnd -= 1;

    const candidate = line.slice(offset, urlEnd);
    if (!isHttpUrl(candidate)) {
      result += line[offset];
      offset += 1;
      continue;
    }

    result += `<${candidate}>`;
    offset = urlEnd;
  }

  return result;
}

function countRun(value: string, offset: number, marker: string): number {
  let end = offset;
  while (value[end] === marker) end += 1;
  return end - offset;
}

function findMatchingBacktickRun(value: string, offset: number, length: number): number {
  let cursor = offset;
  while (cursor < value.length) {
    const next = value.indexOf("`", cursor);
    if (next === -1) return -1;
    const runLength = countRun(value, next, "`");
    if (runLength === length) return next;
    cursor = next + runLength;
  }
  return -1;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}
