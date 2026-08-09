const sharp = require('sharp');

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Greedily wraps `text` to fit `maxChars` per line (approximate, based on average glyph width). */
function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Burns a "GPS Map Camera"-style caption banner (address, lat/lng, timestamp, label) onto the
 * bottom of a photo, matching the geotagged-photo format V-Green expects in its reports.
 * Returns the stamped image as a JPEG buffer.
 */
async function stampGeotag(originalBuffer, { label, address, lat, lng, capturedAt }) {
  const image = sharp(originalBuffer).rotate(); // auto-orient using EXIF
  const meta = await image.metadata();
  const width = meta.width || 1280;
  const height = meta.height || 960;

  const margin = 24;
  const fontSize = Math.max(16, Math.round(height * 0.02));
  // Average glyph width for Arial is roughly 0.55x the font size.
  const maxChars = Math.max(20, Math.floor((width - margin * 2) / (fontSize * 0.55)));

  const rawLines = [
    label,
    ...wrapText(address, maxChars),
    `Lat: ${lat.toFixed(6)}  Lng: ${lng.toFixed(6)}`,
    new Date(capturedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
  ];
  const lines = rawLines.map(escapeXml);

  const lineHeight = fontSize * 1.35;
  const bannerHeight = Math.round(lineHeight * lines.length + fontSize * 0.8);
  const startY = height - bannerHeight + fontSize;

  const textSvg = lines
    .map(
      (line, i) =>
        `<text x="${margin}" y="${startY + i * lineHeight}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="#ffffff">${line}</text>`
    )
    .join('');

  const overlaySvg = `
    <svg width="${width}" height="${height}">
      <rect x="0" y="${height - bannerHeight}" width="${width}" height="${bannerHeight}" fill="#000000" fill-opacity="0.6" />
      ${textSvg}
    </svg>
  `;

  return image
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

module.exports = { stampGeotag };
