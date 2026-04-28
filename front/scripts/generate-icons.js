/**
 * Generate PWA icons from SVG
 *
 * Usage: node scripts/generate-icons.js
 * Requires: npm install sharp
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('Sharp not installed. Run: npm install sharp --save-dev');
    console.log('\nAlternative: Use an online tool like https://realfavicongenerator.net');
    console.log('Upload public/icons/icon.svg and download the generated icons.\n');
    process.exit(1);
  }

  const iconsDir = path.join(__dirname, '../public/icons');
  const svgPath = path.join(iconsDir, 'icon.svg');
  const maskableSvgPath = path.join(iconsDir, 'icon-maskable.svg');

  if (!fs.existsSync(svgPath)) {
    console.error('icon.svg not found in public/icons/');
    process.exit(1);
  }

  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

  console.log('Generating PWA icons...\n');

  // Generate regular icons
  for (const size of sizes) {
    const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Created: icon-${size}x${size}.png`);
  }

  // Generate maskable icons (for Android adaptive icons)
  if (fs.existsSync(maskableSvgPath)) {
    for (const size of [192, 512]) {
      const outputPath = path.join(iconsDir, `icon-maskable-${size}x${size}.png`);
      await sharp(maskableSvgPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`Created: icon-maskable-${size}x${size}.png`);
    }
  }

  // Generate notification icons
  const notifSvgPath = path.join(iconsDir, 'notification-icon.svg');
  if (fs.existsSync(notifSvgPath)) {
    await sharp(notifSvgPath)
      .resize(192, 192)
      .png()
      .toFile(path.join(iconsDir, 'notification-icon.png'));
    console.log('Created: notification-icon.png');
  }

  // Generate Apple touch icon
  await sharp(svgPath)
    .resize(180, 180)
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('Created: apple-touch-icon.png');

  // Generate favicon
  await sharp(svgPath)
    .resize(32, 32)
    .png()
    .toFile(path.join(iconsDir, 'favicon-32x32.png'));
  console.log('Created: favicon-32x32.png');

  await sharp(svgPath)
    .resize(16, 16)
    .png()
    .toFile(path.join(iconsDir, 'favicon-16x16.png'));
  console.log('Created: favicon-16x16.png');

  console.log('\nDone! Icons generated successfully.');
}

generateIcons().catch(console.error);
