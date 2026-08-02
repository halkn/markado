/**
 * Markdown opened from an unknown repository is not trusted, so raw HTML is
 * filtered against an allowlist instead of being passed through.
 *
 * Every surviving tag is rebuilt from its parsed name and attributes. Echoing
 * the original text back would let whatever this scanner failed to understand
 * decide what the browser sees, and re-escaping the values on the way out is
 * also what makes entity obfuscation (`java&#115;cript:`) inert.
 */

const ALLOWED_ELEMENTS = new Set([
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "caption",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "details",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "input",
  "ins",
  "kbd",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "time",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
  "var",
]);

const VOID_ELEMENTS = new Set(["br", "col", "hr", "img", "input"]);

/**
 * `<input>` is here only because GFM task lists are rendered as raw HTML
 * checkboxes. Any other input type is a login box drawn by a document nobody
 * vouched for, so the element is dropped unless it is the checkbox we expect.
 */
const RESTRICTED_ELEMENTS = new Map<string, (attributes: Attribute[]) => boolean>([
  [
    "input",
    (attributes) =>
      attributes.some(
        ({ name, value }) => name.toLowerCase() === "type" && value.toLowerCase() === "checkbox",
      ),
  ],
]);

/**
 * Elements whose body is not markup the reader should see. When the closing tag
 * is in the same raw HTML token the whole span is dropped; when it is not — an
 * inline `<script>` splits into two tokens with a text token between them —
 * only the tags go, and the body is escaped into visible text. Either way
 * nothing executes.
 */
const DROPPED_WITH_CONTENT = new Set([
  "embed",
  "iframe",
  "math",
  "noembed",
  "noframes",
  "noscript",
  "object",
  "script",
  "style",
  "svg",
  "template",
  "textarea",
  "title",
  "xmp",
]);

const GLOBAL_ATTRIBUTES = new Set(["class", "dir", "id", "lang", "title"]);

const ELEMENT_ATTRIBUTES = new Map<string, Set<string>>([
  ["a", new Set(["href", "name", "rel", "target"])],
  ["blockquote", new Set(["cite"])],
  ["col", new Set(["span"])],
  ["colgroup", new Set(["span"])],
  ["del", new Set(["datetime"])],
  ["details", new Set(["open"])],
  ["img", new Set(["alt", "height", "loading", "src", "width"])],
  ["input", new Set(["checked", "disabled", "type"])],
  ["ins", new Set(["datetime"])],
  ["ol", new Set(["start", "type"])],
  ["q", new Set(["cite"])],
  ["time", new Set(["datetime"])],
  ["td", new Set(["align", "colspan", "rowspan"])],
  ["th", new Set(["align", "colspan", "rowspan", "scope"])],
]);

const URL_ATTRIBUTES = new Set(["cite", "href", "src"]);

const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/** SVG is deliberately absent: it carries scripts and is not a raster image. */
const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]*$/i;

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const TAG_NAME = /^[a-z][a-z0-9-]*/i;

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

export function sanitizeRawHtml(fragment: string): string {
  let output = "";
  let index = 0;

  while (index < fragment.length) {
    const start = fragment.indexOf("<", index);
    if (start === -1) {
      output += escapeHtml(fragment.slice(index));
      break;
    }

    output += escapeHtml(fragment.slice(index, start));
    index = consumeTag(fragment, start, (html) => {
      output += html;
    });
  }

  return output;
}

/** Returns the index just past whatever begins at `start`, emitting what survives. */
function consumeTag(fragment: string, start: number, emit: (html: string) => void): number {
  if (fragment.startsWith("<!--", start)) {
    return skipPast(fragment, start, "-->");
  }
  if (fragment.startsWith("<!", start) || fragment.startsWith("<?", start)) {
    return skipPast(fragment, start, ">");
  }

  const close = readCloseTag(fragment, start);
  if (close) {
    if (ALLOWED_ELEMENTS.has(close.name) && !VOID_ELEMENTS.has(close.name)) {
      emit(`</${close.name}>`);
    }
    return close.end;
  }

  const open = readOpenTag(fragment, start);
  if (!open) {
    emit("&lt;");
    return start + 1;
  }

  if (DROPPED_WITH_CONTENT.has(open.name)) {
    return skipElementBody(fragment, open.name, open.end);
  }
  if (!ALLOWED_ELEMENTS.has(open.name)) {
    return open.end;
  }
  if (RESTRICTED_ELEMENTS.get(open.name)?.(open.attributes) === false) {
    return open.end;
  }

  emit(renderOpenTag(open.name, open.attributes));
  return open.end;
}

function skipPast(fragment: string, start: number, terminator: string): number {
  const end = fragment.indexOf(terminator, start + 1);
  return end === -1 ? fragment.length : end + terminator.length;
}

function skipElementBody(fragment: string, name: string, afterOpenTag: number): number {
  const closing = new RegExp(`</${name}\\s*>`, "i");
  const match = closing.exec(fragment.slice(afterOpenTag));
  return match ? afterOpenTag + match.index + match[0].length : afterOpenTag;
}

type Attribute = { name: string; value: string };

type OpenTag = { name: string; attributes: Attribute[]; end: number };

function readCloseTag(fragment: string, start: number): { name: string; end: number } | null {
  const match = /^<\/([a-z][a-z0-9-]*)\s*>/i.exec(fragment.slice(start));
  return match ? { name: match[1].toLowerCase(), end: start + match[0].length } : null;
}

function readOpenTag(fragment: string, start: number): OpenTag | null {
  const name = TAG_NAME.exec(fragment.slice(start + 1))?.[0];
  if (!name) {
    return null;
  }

  const attributes: Attribute[] = [];
  let index = start + 1 + name.length;

  while (index < fragment.length) {
    while (index < fragment.length && isSpace(fragment[index])) {
      index += 1;
    }
    if (fragment[index] === ">") {
      return { name: name.toLowerCase(), attributes, end: index + 1 };
    }
    if (fragment.startsWith("/>", index)) {
      return { name: name.toLowerCase(), attributes, end: index + 2 };
    }

    const attribute = readAttribute(fragment, index);
    if (!attribute) {
      index += 1;
      continue;
    }
    attributes.push(attribute);
    index = attribute.end;
  }

  // Unterminated: markdown-it would not have produced a raw HTML token for it,
  // so treat the `<` as text rather than guessing where the tag ended.
  return null;
}

function readAttribute(fragment: string, start: number): (Attribute & { end: number }) | null {
  const name = /^[^\s"'>/=]+/.exec(fragment.slice(start))?.[0];
  if (!name) {
    return null;
  }

  let index = start + name.length;
  while (index < fragment.length && isSpace(fragment[index])) {
    index += 1;
  }
  if (fragment[index] !== "=") {
    return { name, value: "", end: start + name.length };
  }

  index += 1;
  while (index < fragment.length && isSpace(fragment[index])) {
    index += 1;
  }

  const quote = fragment[index];
  if (quote === '"' || quote === "'") {
    const end = fragment.indexOf(quote, index + 1);
    if (end === -1) {
      return { name, value: fragment.slice(index + 1), end: fragment.length };
    }
    return { name, value: fragment.slice(index + 1, end), end: end + 1 };
  }

  const value = /^[^\s>]*/.exec(fragment.slice(index))?.[0] ?? "";
  return { name, value, end: index + value.length };
}

function isSpace(character: string | undefined): boolean {
  return character === " " || character === "\t" || character === "\n" || character === "\r";
}

function renderOpenTag(name: string, attributes: Attribute[]): string {
  const kept = new Map<string, string>();

  for (const attribute of attributes) {
    const attributeName = attribute.name.toLowerCase();
    if (!isAllowedAttribute(name, attributeName)) {
      continue;
    }

    if (!URL_ATTRIBUTES.has(attributeName)) {
      kept.set(attributeName, attribute.value);
      continue;
    }

    const url = safeUrl(attribute.value, {
      allowDataImage: name === "img" && attributeName === "src",
    });
    if (url !== null) {
      kept.set(attributeName, url);
    }
  }

  if (name === "a" && isExternalHref(kept.get("href"))) {
    // Generated here, never copied from the document: `data-*` is stripped on
    // the way in, so raw HTML cannot forge the marker the router reads.
    kept.set("data-mdiv-kind", "external");
    kept.set("target", "_blank");
    kept.set("rel", "noopener noreferrer");
  }

  const rendered = [...kept]
    .map(([attributeName, value]) => ` ${attributeName}="${escapeHtml(value)}"`)
    .join("");

  return `<${name}${rendered}>`;
}

function isAllowedAttribute(element: string, attribute: string): boolean {
  if (attribute.startsWith("data-") || attribute.startsWith("on")) {
    return false;
  }
  return (
    GLOBAL_ATTRIBUTES.has(attribute) || (ELEMENT_ATTRIBUTES.get(element)?.has(attribute) ?? false)
  );
}

function isExternalHref(href: string | undefined): boolean {
  return href !== undefined && SCHEME.test(normalizeUrl(href));
}

/**
 * Schemes are matched on a decoded, control-character-free copy because that is
 * what the browser resolves: `java&#115;cript:` and `java&#9;script:` both
 * reach the URL parser as `javascript:`.
 */
export function safeUrl(value: string, options: { allowDataImage?: boolean } = {}): string | null {
  const normalized = normalizeUrl(value);
  if (normalized === "") {
    return null;
  }
  if (normalized.startsWith("//")) {
    return null;
  }

  const scheme = SCHEME.exec(normalized)?.[0].toLowerCase();
  if (scheme === undefined) {
    return normalized;
  }
  if (SAFE_SCHEMES.has(scheme)) {
    return normalized;
  }
  if (options.allowDataImage && SAFE_DATA_IMAGE.test(normalized)) {
    return normalized;
  }
  return null;
}

// oxlint-disable-next-line no-control-regex
const URL_CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/g;

/** Browsers drop C0 controls anywhere in a URL, so the check has to as well. */
function normalizeUrl(value: string): string {
  return decodeEntities(value).replace(URL_CONTROL_CHARACTER, "").trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  colon: ":",
  gt: ">",
  lt: "<",
  newline: "\n",
  num: "#",
  quot: '"',
  semi: ";",
  sol: "/",
  tab: "\t",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);?/gi, (match, body: string) => {
    if (body.startsWith("#")) {
      const code =
        body.startsWith("#x") || body.startsWith("#X")
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}
