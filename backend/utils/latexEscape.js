/**
 * Escape plain text for safe inclusion in LaTeX documents (pdflatex + utf8).
 *
 * LLM-generated questions often contain Unicode math symbols (√, ×, −, Greek
 * letters, etc.) copied from PDFs. pdflatex cannot render those unless they are
 * mapped to LaTeX or ASCII first.
 */

/** Unicode symbols commonly found in academic PDF text → pdflatex-safe text. */
const UNICODE_REPLACEMENTS = [
  ['√', 'sqrt'],
  ['×', 'x'],
  ['·', '*'],
  ['•', '*'],
  ['−', '-'],
  ['–', '-'],
  ['—', '--'],
  ['…', '...'],
  ['≤', '<='],
  ['≥', '>='],
  ['≠', '!='],
  ['≈', '~'],
  ['±', '+/-'],
  ['∞', 'infinity'],
  ['→', '->'],
  ['←', '<-'],
  ['⇒', '=>'],
  ['°', ' deg'],
  ['′', "'"],
  ['″', '"'],
  ['α', 'alpha'],
  ['β', 'beta'],
  ['γ', 'gamma'],
  ['δ', 'delta'],
  ['ε', 'epsilon'],
  ['θ', 'theta'],
  ['λ', 'lambda'],
  ['μ', 'mu'],
  ['π', 'pi'],
  ['σ', 'sigma'],
  ['τ', 'tau'],
  ['φ', 'phi'],
  ['ω', 'omega'],
  ['Δ', 'Delta'],
  ['Σ', 'Sigma'],
  ['Ω', 'Omega'],
  ['∑', 'sum'],
  ['∏', 'product'],
  ['∫', 'integral'],
  ['∂', 'partial'],
  ['∈', 'in'],
  ['∉', 'not in'],
  ['⊂', 'subset of'],
  ['⊆', 'subset of'],
  ['∪', 'union'],
  ['∩', 'intersection'],
  ['∀', 'for all'],
  ['∃', 'exists'],
  ['∧', 'and'],
  ['∨', 'or'],
  ['¬', 'not'],
  ['⊗', 'tensor product'],
  ['⊕', 'oplus'],
  ['⟨', '<'],
  ['⟩', '>'],
  ['"', '"'],
  ['"', '"'],
  ["'", "'"],
  ["'", "'"],
];

const normalizeUnicodeForLatex = (text) => {
  let s = String(text).normalize('NFKC');
  for (const [from, to] of UNICODE_REPLACEMENTS) {
    s = s.split(from).join(to);
  }
  // Remaining non-ASCII: strip combining marks, then drop anything still non-ASCII.
  s = s.replace(/[^\x00-\x7F]/g, (ch) => {
    const decomposed = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/^[\x20-\x7E]$/.test(decomposed)) return decomposed;
    return '';
  });
  return s;
};

const escapeLatex = (text) => {
  if (text == null) return '';
  return normalizeUnicodeForLatex(text)
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

module.exports = { escapeLatex, latexParagraph, sanitizeFilename, normalizeUnicodeForLatex };
