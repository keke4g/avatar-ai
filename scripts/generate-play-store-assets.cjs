const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { chromium } = require('playwright');

const outputDir = path.resolve('output/play-store');
const logoPath = path.resolve('public/towers-mexico-logo-blue.png');
fs.mkdirSync(outputDir, { recursive: true });

async function generateArtwork() {
  const logoSource = sharp(logoPath).ensureAlpha();
  const { data: logoPixels, info: logoInfo } = await logoSource
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let index = 0; index < logoPixels.length; index += 4) {
    if (
      logoPixels[index] < 30 &&
      logoPixels[index + 1] < 30 &&
      logoPixels[index + 2] < 30
    ) {
      logoPixels[index + 3] = 0;
    }
  }
  const cleanLogo = sharp(logoPixels, {
    raw: {
      width: logoInfo.width,
      height: logoInfo.height,
      channels: 4,
    },
  });

  const logo = await cleanLogo
    .clone()
    .resize(310, 310, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const iconBackground = Buffer.from(`
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset="1" stop-color="#e7f5fc"/>
        </linearGradient>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#005f8f" flood-opacity="0.18"/>
        </filter>
      </defs>
      <rect width="512" height="512" fill="url(#bg)"/>
      <circle cx="256" cy="250" r="175" fill="#ffffff" filter="url(#shadow)"/>
    </svg>`);

  await sharp(iconBackground)
    .composite([{ input: logo, left: 101, top: 92 }])
    .png()
    .toFile(path.join(outputDir, 'app-icon-512.png'));

  const feature = Buffer.from(`
    <svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="featureBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f8fcff"/>
          <stop offset="0.52" stop-color="#e5f5fc"/>
          <stop offset="1" stop-color="#c6e9f8"/>
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#005f8f"/>
          <stop offset="1" stop-color="#1599c7"/>
        </linearGradient>
        <filter id="cardShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#003f63" flood-opacity="0.15"/>
        </filter>
      </defs>
      <rect width="1024" height="500" fill="url(#featureBg)"/>
      <circle cx="938" cy="54" r="210" fill="#ffffff" opacity="0.55"/>
      <circle cx="910" cy="460" r="270" fill="#68c8ea" opacity="0.14"/>
      <rect x="54" y="58" width="300" height="384" rx="62" fill="#ffffff" filter="url(#cardShadow)"/>
      <rect x="405" y="106" width="78" height="8" rx="4" fill="url(#accent)"/>
      <text x="405" y="190" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="800" fill="#0a1724">Towers <tspan fill="#087ca8">México</tspan></text>
      <text x="405" y="244" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="600" fill="#39556b">Tu próximo espacio, mejor informado.</text>
      <text x="405" y="310" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="600" fill="#557184">Explora · Publica · Compara · Agenda</text>
      <rect x="405" y="346" width="333" height="62" rx="31" fill="#07111d"/>
      <text x="571" y="386" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="800" fill="#ffffff">CON ETERNA IA</text>
    </svg>`);

  const featureLogo = await cleanLogo
    .clone()
    .resize(230, 230, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  await sharp(feature)
    .composite([{ input: featureLogo, left: 89, top: 132 }])
    .png()
    .toFile(path.join(outputDir, 'feature-graphic-1024x500.png'));
}

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'es-MX',
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });

  async function openAndCapture(url, fileName) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(4500);
    await page.screenshot({
      path: path.join(outputDir, fileName),
      type: 'png',
      fullPage: false,
    });
  }

  await openAndCapture('https://towersmexico.com/', 'phone-01-home.png');
  await openAndCapture('https://towersmexico.com/explore', 'phone-02-explore.png');

  const propertyHref = await page
    .locator('a[href^="/property/"]')
    .first()
    .getAttribute('href')
    .catch(() => null);
  if (propertyHref) {
    await openAndCapture(
      new URL(propertyHref, 'https://towersmexico.com').toString(),
      'phone-03-property.png',
    );
  }

  await browser.close();
}

async function main() {
  await generateArtwork();
  await captureScreenshots();
  const files = fs.readdirSync(outputDir).filter((file) => file.endsWith('.png'));
  console.log(JSON.stringify({ outputDir, files }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
