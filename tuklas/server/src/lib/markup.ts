/**
 * Announcement bodies use a small markup (**bold**, _italic_, ## headings, - and 1. lists, [text](url)).
 * The client renders it to React elements; emails get this plain-text version.
 */
export function toPlainText(body: string) {
  return body
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\W)_([^_]+)_(?=\W|$)/g, '$1$2')
    .replace(/^#{2,3}\s+/gm, '')
    .trim();
}
