const puppeteer = require('puppeteer-core');
const env = require('../../config/env');

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      executablePath: env.puppeteerExecutablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserPromise;
}

/** Renders an HTML string to a PDF buffer using the shared headless Chromium instance. */
async function renderHtmlToPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '14mm', left: '10mm', right: '10mm' },
    });
  } finally {
    await page.close();
  }
}

module.exports = { renderHtmlToPdf };
