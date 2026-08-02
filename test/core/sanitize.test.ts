import { describe, expect, test } from "bun:test";
import { safeUrl, sanitizeRawHtml } from "../../src/core/sanitize.ts";

describe("dangerous elements", () => {
  test("drops a script element and its body", () => {
    expect(sanitizeRawHtml("<p>ok</p><script>alert(1)</script>")).toBe("<p>ok</p>");
  });

  test("drops a style element and its body", () => {
    expect(sanitizeRawHtml("<style>body{display:none}</style>")).toBe("");
  });

  test("drops an iframe", () => {
    expect(sanitizeRawHtml('<iframe src="https://example.com"></iframe>')).toBe("");
  });

  test("drops object, embed and template", () => {
    const html = '<object data="x"></object><embed src="x"><template><b>x</b></template>';
    expect(sanitizeRawHtml(html)).toBe("");
  });

  test("drops svg together with its foreignObject", () => {
    const html = '<svg><foreignObject><a href="javascript:alert(1)">x</a></foreignObject></svg>';
    expect(sanitizeRawHtml(html)).toBe("");
  });

  test("escapes the body when the closing tag is in another token", () => {
    // markdown-it splits inline raw HTML into one token per tag, so the body
    // arrives separately. It has to end up as text, never as markup.
    expect(sanitizeRawHtml("<script>")).toBe("");
    expect(sanitizeRawHtml("alert(1)")).toBe("alert(1)");
    expect(sanitizeRawHtml("</script>")).toBe("");
  });

  test("drops comments, doctypes and processing instructions", () => {
    expect(sanitizeRawHtml("<!-- <script>alert(1)</script> -->after")).toBe("after");
    expect(sanitizeRawHtml("<!DOCTYPE html><p>x</p>")).toBe("<p>x</p>");
    expect(sanitizeRawHtml("<?php echo 1; ?>x")).toBe("x");
  });

  test("keeps an unrecognised tag out while showing its text", () => {
    expect(sanitizeRawHtml("<blink>hello</blink>")).toBe("hello");
  });
});

describe("attributes", () => {
  test("drops every event handler attribute", () => {
    expect(sanitizeRawHtml('<img src="a.png" onerror="alert(1)" alt="a">')).toBe(
      '<img src="a.png" alt="a">',
    );
    expect(sanitizeRawHtml("<p ONLOAD=alert(1)>x</p>")).toBe("<p>x</p>");
  });

  test("drops style and other attributes outside the allowlist", () => {
    expect(sanitizeRawHtml('<div style="position:fixed" class="note" srcset="x">x</div>')).toBe(
      '<div class="note">x</div>',
    );
  });

  test("drops data attributes so the router markers cannot be forged", () => {
    expect(
      sanitizeRawHtml('<a href="/read/x" data-mdiv-kind="page" data-mdiv-path="x">x</a>'),
    ).toBe('<a href="/read/x">x</a>');
  });

  test("keeps the documented per-element attributes", () => {
    expect(sanitizeRawHtml('<td colspan="2" align="left">x</td>')).toBe(
      '<td colspan="2" align="left">x</td>',
    );
    expect(sanitizeRawHtml('<ol start="3"><li>x</li></ol>')).toBe('<ol start="3"><li>x</li></ol>');
  });

  test("re-escapes attribute values instead of echoing them", () => {
    expect(sanitizeRawHtml("<p title='a\" onmouseover=\"alert(1)'>x</p>")).toBe(
      '<p title="a&quot; onmouseover=&quot;alert(1)">x</p>',
    );
  });

  test("reads unquoted and valueless attributes", () => {
    expect(sanitizeRawHtml("<details open><summary>x</summary></details>")).toBe(
      '<details open=""><summary>x</summary></details>',
    );
    expect(sanitizeRawHtml("<img src=a.png alt=hi>")).toBe('<img src="a.png" alt="hi">');
  });

  test("treats an unterminated tag as text", () => {
    expect(sanitizeRawHtml('<p class="x')).toBe("&lt;p class=&quot;x");
  });
});

describe("URL attributes", () => {
  test("drops javascript and vbscript hrefs", () => {
    expect(sanitizeRawHtml('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(sanitizeRawHtml('<a href="VBScript:msgbox(1)">x</a>')).toBe("<a>x</a>");
  });

  test("drops hrefs obfuscated with entities or control characters", () => {
    expect(sanitizeRawHtml('<a href="java&#115;cript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(sanitizeRawHtml('<a href="javascript&colon;alert(1)">x</a>')).toBe("<a>x</a>");
    expect(sanitizeRawHtml('<a href="java\tscript:alert(1)">x</a>')).toBe("<a>x</a>");
  });

  test("drops protocol-relative references", () => {
    expect(sanitizeRawHtml('<a href="//evil.example/x">x</a>')).toBe("<a>x</a>");
  });

  test("keeps relative and fragment references", () => {
    expect(sanitizeRawHtml('<a href="Guide/Install.md">x</a>')).toBe(
      '<a href="Guide/Install.md">x</a>',
    );
    expect(sanitizeRawHtml('<a href="#section">x</a>')).toBe('<a href="#section">x</a>');
  });

  test("marks external anchors and hardens the tab they open", () => {
    expect(sanitizeRawHtml('<a href="https://example.com">x</a>')).toBe(
      '<a href="https://example.com" data-mdiv-kind="external" target="_blank"' +
        ' rel="noopener noreferrer">x</a>',
    );
  });

  test("allows raster data images but not data SVG or data HTML", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(sanitizeRawHtml(`<img src="${png}">`)).toBe(`<img src="${png}">`);
    expect(sanitizeRawHtml('<img src="data:image/svg+xml;base64,PHN2Zz4=">')).toBe("<img>");
    expect(sanitizeRawHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>')).toBe(
      "<a>x</a>",
    );
  });

  test("never allows a data URL outside an image source", () => {
    expect(safeUrl("data:image/png;base64,iVBORw0KGgo=")).toBeNull();
    expect(safeUrl("data:image/png;base64,iVBORw0KGgo=", { allowDataImage: true })).toBe(
      "data:image/png;base64,iVBORw0KGgo=",
    );
  });

  test("allows mailto and rejects unknown schemes", () => {
    expect(safeUrl("mailto:a@example.com")).toBe("mailto:a@example.com");
    expect(safeUrl("blob:https://example.com/x")).toBeNull();
    expect(safeUrl("file:///etc/passwd")).toBeNull();
    expect(safeUrl("")).toBeNull();
  });
});

describe("allowed markup", () => {
  test("passes structural elements through", () => {
    const html = "<div><p><strong>a</strong> <em>b</em></p><ul><li>c</li></ul></div>";
    expect(sanitizeRawHtml(html)).toBe(html);
  });

  test("keeps text around tags escaped", () => {
    expect(sanitizeRawHtml("a < b & c")).toBe("a &lt; b &amp; c");
  });

  test("normalises self-closing void elements", () => {
    expect(sanitizeRawHtml("<br /><hr/>")).toBe("<br><hr>");
  });

  test("drops the closing tag of a void element", () => {
    expect(sanitizeRawHtml("<br></br>")).toBe("<br>");
  });
});
