/**
 * Escape plain text for safe inclusion in LaTeX documents.
 */
const escapeLatex = (text) => {
  if (text == null) return '';
  return String(text)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}~^])/g, (ch) => {
      const map = {
        '&': '\\&',
        '%': '\\%',
        '$': '\\$',
        '#': '\\#',
        '_': '\\_',
        '{': '\\{',
        '}': '\\}',
        '~': '\\textasciitilde{}',
        '^': '\\textasciicircum{}',
      };
      return map[ch] || ch;
    });
};

/** Convert newlines to LaTeX paragraph breaks. */
const latexParagraph = (text) =>
  escapeLatex(text).replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n\n').replace(/\n/g, '\\\\\n');

const sanitizeFilename = (name) =>
  (name || 'export')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'export';

module.exports = { escapeLatex, latexParagraph, sanitizeFilename };
