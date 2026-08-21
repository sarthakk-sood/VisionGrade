const cloudinary = require('../config/cloudinary');
const { PDFParse } = require('pdf-parse');

const uploadAndParsePDF = async (buffer, originalName) => {
  // Step 1 — Upload to Cloudinary
  const cloudinaryResult = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'vision-grade/pdfs',
        resource_type: 'auto',
        public_id: `${Date.now()}-${originalName.replace(/\s+/g, '_')}`,
        overwrite: false,
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    uploadStream.end(buffer);
  });

  // Step 2 — Extract text from buffer using pdf-parse v2 API
  // getText() returns a LineStore object with:
  //   .text  — full concatenated text string across all pages
  //   .pages — array of { num, text } page objects
  //   .total — total page count
  // verbosity: 0 = ERRORS only (required — omitting it throws "Cannot read .verbosity of undefined")
  const parser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });
  const lineStore = await parser.getText();

  const extractedText = (lineStore.text || '').replace(/\s+/g, ' ').trim();
  const numPages = lineStore.total || 0;

  // Per-page text lets retrieved excerpts be attributed to a page, so a teacher
  // reviewing a generated question can find the passage it came from.
  const pages = (lineStore.pages || [])
    .map((p, i) => ({
      num: p.num ?? i + 1,
      text: (p.text || '').replace(/\s+/g, ' ').trim(),
    }))
    .filter((p) => p.text.length);

  // Clean up parser resources
  await parser.destroy();

  // Page text duplicates extractedText, so skip it on very large PDFs rather
  // than risk pushing the Mongo document towards its 16MB ceiling.
  const pagesSize = pages.reduce((sum, p) => sum + p.text.length, 0);
  const keepPages = pagesSize > 0 && pagesSize <= 1_500_000;

  if (!keepPages && pages.length) {
    console.warn(
      `[pdfService] ${originalName}: page-level text omitted (${pagesSize} chars); excerpts will cite the file only.`
    );
  }

  return {
    url: cloudinaryResult.secure_url,
    publicId: cloudinaryResult.public_id,
    extractedText,
    pages: keepPages ? pages : [],
    pageCount: numPages,
  };
};

module.exports = { uploadAndParsePDF };