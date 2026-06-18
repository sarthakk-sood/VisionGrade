const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const TECTONIC_CANDIDATES = [
  process.env.TECTONIC_PATH,
  'tectonic',
  '/opt/homebrew/bin/tectonic',
  '/usr/local/bin/tectonic',
].filter(Boolean);

const PDFLATEX_CANDIDATES = [
  process.env.PDFLATEX_PATH,
  'pdflatex',
  '/Library/TeX/texbin/pdflatex',
  '/usr/local/texlive/2024/bin/universal-darwin/pdflatex',
].filter(Boolean);

const rmrf = (dir) => {
  if (!dir || !fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
};

const tryTectonic = async (texPath, outDir) => {
  for (const cmd of TECTONIC_CANDIDATES) {
    try {
      await execFileAsync(cmd, [texPath, '--outdir', outDir], {
        timeout: 180_000,
        env: { ...process.env, RUST_LOG: 'error' },
      });
      return true;
    } catch {
      // try next binary
    }
  }
  return false;
};

const tryPdflatex = async (texPath, outDir) => {
  const base = path.basename(texPath, '.tex');
  for (const cmd of PDFLATEX_CANDIDATES) {
    try {
      for (let i = 0; i < 2; i++) {
        await execFileAsync(cmd, ['-interaction=nonstopmode', '-output-directory', outDir, texPath], {
          timeout: 180_000,
          cwd: outDir,
        });
      }
      if (fs.existsSync(path.join(outDir, `${base}.pdf`))) return true;
    } catch {
      // try next binary
    }
  }
  return false;
};

/**
 * Compile LaTeX source string to a PDF buffer.
 * Uses Tectonic (preferred) or pdflatex as fallback.
 */
const compileLatexToPdf = async (texContent, basename = 'document') => {
  const safeBase = basename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) || 'document';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vg-latex-'));
  const texPath = path.join(tmpDir, `${safeBase}.tex`);

  try {
    fs.writeFileSync(texPath, texContent, 'utf8');

    let compiled = await tryTectonic(texPath, tmpDir);
    if (!compiled) compiled = await tryPdflatex(texPath, tmpDir);

    const pdfPath = path.join(tmpDir, `${safeBase}.pdf`);
    if (!compiled || !fs.existsSync(pdfPath)) {
      throw new Error(
        'LaTeX compiler not found. Install Tectonic: brew install tectonic'
      );
    }

    return fs.readFileSync(pdfPath);
  } finally {
    rmrf(tmpDir);
  }
};

module.exports = { compileLatexToPdf };
