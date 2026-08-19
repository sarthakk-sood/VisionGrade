const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { execFile } = require('child_process');
const { promisify } = require('util');
const cloudinary = require('../config/cloudinary');

const execFileAsync = promisify(execFile);

/** Cloud compiler — no local TeX install required. */
const LATEX_ONLINE_URL = process.env.LATEX_COMPILE_URL || 'https://latexonline.cc/compile';
const LATEX_COMPILE_MODE = (process.env.LATEX_COMPILE_MODE || 'online').toLowerCase();

/** Below this size, send LaTeX inline; above it, upload to Cloudinary and compile by URL. */
const INLINE_TEX_CHAR_LIMIT = 12_000;

const TECTONIC_CANDIDATES = [
  process.env.TECTONIC_PATH,
  'C:\\ProgramData\\chocolatey\\bin\\tectonic.exe',
  'C:\\ProgramData\\chocolatey\\lib\\tectonic\\tools\\tectonic.exe',
  'tectonic',
  '/opt/homebrew/bin/tectonic',
  '/usr/local/bin/tectonic',
  '/usr/bin/tectonic',
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

const isPdfBuffer = (buf) =>
  Buffer.isBuffer(buf) && buf.length > 4 && buf.slice(0, 5).toString('ascii') === '%PDF-';

const uploadTexForCompile = (texContent, basename) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'vision-grade/latex-temp',
        resource_type: 'raw',
        public_id: `${basename}-${Date.now()}`,
        format: 'tex',
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(Buffer.from(texContent, 'utf8'));
  });

const destroyCloudinaryRaw = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
  } catch {
    // Best-effort cleanup of temporary compile source.
  }
};

/**
 * Compile LaTeX via latexonline.cc (cloud). Uses inline text for small docs,
 * or uploads to Cloudinary and passes a public URL for larger exam papers.
 */
const compileLatexOnline = async (texContent, basename) => {
  let uploaded = null;

  try {
    const params = { command: 'pdflatex' };

    if (texContent.length <= INLINE_TEX_CHAR_LIMIT) {
      params.text = texContent;
    } else {
      uploaded = await uploadTexForCompile(texContent, basename);
      params.url = uploaded.secure_url;
    }

    const response = await axios.get(LATEX_ONLINE_URL, {
      params,
      responseType: 'arraybuffer',
      timeout: 120_000,
      validateStatus: () => true,
    });

    if (response.status >= 400 || !isPdfBuffer(response.data)) {
      const detail = Buffer.from(response.data || '').toString('utf8').slice(0, 600);
      throw new Error(
        `Online LaTeX compile failed (HTTP ${response.status}). ${detail || 'No PDF returned.'}`
      );
    }

    return Buffer.from(response.data);
  } finally {
    if (uploaded?.public_id) {
      await destroyCloudinaryRaw(uploaded.public_id);
    }
  }
};

const tryTectonic = async (texPath, outDir) => {
  for (const cmd of TECTONIC_CANDIDATES) {
    try {
      await execFileAsync(cmd, [texPath, '--outdir', outDir], {
        timeout: 60_000,
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

const compileLatexLocal = async (texContent, basename) => {
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
        'Local LaTeX compiler not found. Set LATEX_COMPILE_MODE=online (default) ' +
        'or install tectonic and set TECTONIC_PATH in .env.'
      );
    }

    return fs.readFileSync(pdfPath);
  } finally {
    rmrf(tmpDir);
  }
};

/**
 * Compile LaTeX source string to a PDF buffer.
 *
 * Default (LATEX_COMPILE_MODE=online): cloud compiler at latexonline.cc — no local install.
 * Set LATEX_COMPILE_MODE=local to use tectonic/pdflatex on this machine instead.
 */
const compileLatexToPdf = async (texContent, basename = 'document') => {
  const safeBase = basename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) || 'document';

  if (LATEX_COMPILE_MODE === 'local') {
    return compileLatexLocal(texContent, safeBase);
  }

  try {
    return await compileLatexOnline(texContent, safeBase);
  } catch (onlineErr) {
    // If a developer has a local compiler installed, use it as fallback.
    try {
      console.warn('[latexCompileService] Online compile failed, trying local compiler…', onlineErr.message);
      return await compileLatexLocal(texContent, safeBase);
    } catch {
      throw onlineErr;
    }
  }
};

module.exports = { compileLatexToPdf };
