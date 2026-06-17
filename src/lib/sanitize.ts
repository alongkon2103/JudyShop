/**
 * Sanitize HTML coming out of the TipTap editor before we store it.
 *
 * The threat model: an admin user with a compromised browser, or one
 * who pastes hostile HTML, could otherwise persist `<script>` /
 * `<iframe>` / inline event handlers and have them executed in every
 * customer's browser when the product page renders the description.
 *
 * Rules:
 *   - Whitelist only the formatting tags the TipTap toolbar emits.
 *   - Strip ALL inline `style`, `class`, `data-*`, and `on*` event
 *     handlers — admins can format, never style. Site CSS owns colors.
 *   - Force `rel="noopener noreferrer"` and `target="_blank"` on all
 *     <a> tags so opened links can't tamper with the parent window.
 *   - Restrict <a href> to safe schemes (http, https, mailto).
 *
 * Used by:
 *   - createProductAction / updateProductAction (Product.descriptionEn/Th)
 */
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p", "br", "hr",
  "strong", "em", "u", "s",
  "h2", "h3",
  "ul", "ol", "li",
  "blockquote",
  "a",
];

const ALLOWED_ATTR = ["href", "target", "rel"];

const SAFE_HREF = /^(https?:|mailto:)/i;

/**
 * Sanitize a string of HTML so it's safe to embed back into the page
 * via `dangerouslySetInnerHTML`. Returns "" when given empty input.
 */
export function sanitizeRichText(input: string | null | undefined): string {
  if (!input) return "";
  // Strip *all* anchors whose href isn't a safe scheme. We do this in
  // a hook because DOMPurify's `ALLOWED_URI_REGEXP` is global and we
  // want anchors to keep working when the href IS safe.
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if (data.attrName === "href") {
      if (!SAFE_HREF.test(data.attrValue ?? "")) {
        data.keepAttr = false;
      }
    }
  });

  // Force every link to be a safe outbound link.
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });

  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Belt-and-braces — no inline scripts even if a tag slips through.
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "img", "video", "audio"],
    FORBID_ATTR: ["style", "class", "id"],
    // DOMPurify keeps `data-*` by default; opt out so admins can't
    // smuggle attribute-named state through.
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
  });

  // Clean up hooks so this module remains stateless across calls.
  DOMPurify.removeAllHooks();

  return clean.trim();
}

/**
 * Strip ALL HTML and return plain text — used when we need a short
 * preview (e.g. card listings) or to count "is this empty?"
 */
export function stripRichText(input: string | null | undefined): string {
  if (!input) return "";
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .replace(/\s+/g, " ")
    .trim();
}
