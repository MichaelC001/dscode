import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { stabilizeMarkdownAutolinks } from "./markdown";

describe("Markdown autolinks", () => {
  it("keeps emphasis and inline code next to a URL with CJK punctuation", () => {
    const source = "服务已运行：**http://127.0.0.1:8000**（`python3 server.py` 可重启）";
    const normalized = stabilizeMarkdownAutolinks(source);
    const html = renderToStaticMarkup(createElement(ReactMarkdown, {
      remarkPlugins: [remarkGfm],
      children: normalized,
    }));

    expect(normalized).toBe("服务已运行：**<http://127.0.0.1:8000>**（`python3 server.py` 可重启）");
    expect(html).toContain('<strong><a href="http://127.0.0.1:8000">http://127.0.0.1:8000</a></strong>');
    expect(html).toContain("<code>python3 server.py</code>");
  });

  it("stops a bare URL at CJK punctuation", () => {
    expect(stabilizeMarkdownAutolinks("访问 https://example.com/docs（备用地址）"))
      .toBe("访问 <https://example.com/docs>（备用地址）");
  });

  it("does not rewrite explicit links or code", () => {
    const source = [
      "<https://example.com>",
      "`https://inline.example.com`",
      "```text",
      "**https://fenced.example.com**",
      "```",
    ].join("\n");

    expect(stabilizeMarkdownAutolinks(source)).toBe(source);
  });
});
