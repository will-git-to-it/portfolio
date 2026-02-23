/**
 * Portfolio → Figma Export
 *
 * Launches a local server, screenshots every portfolio page at desktop and
 * mobile viewport sizes using Puppeteer, then writes the PNGs and a
 * manifest.json to figma-export/output/.
 *
 * Usage:
 *   npm install
 *   npm run export
 *
 * After running, open Figma and load the "Portfolio Importer" plugin from
 * ../figma-plugin/manifest.json, then select all files in ./output/.
 */

import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { startServer } from './serve.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output');

const PAGES = [
  { name: 'Home', slug: 'home', path: '/' },
  { name: 'About', slug: 'about', path: '/about.html' },
  { name: 'Case Study', slug: 'case-study', path: '/case-study.html' },
];

const VIEWPORTS = [
  { name: 'Desktop', width: 1440 },
  { name: 'Mobile', width: 375 },
];

// Milliseconds to wait after page load for animations/fonts to settle.
const SETTLE_MS = 1200;

async function run() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Starting local portfolio server…');
  const { server, port } = await startServer();

  console.log(`Server listening on http://localhost:${port}`);
  console.log('Launching browser…\n');

  const browser = await puppeteer.launch({ headless: 'new' });
  const manifest = { pages: [] };

  try {
    for (const page of PAGES) {
      const pageEntry = { name: page.name, files: [] };

      for (const vp of VIEWPORTS) {
        const tab = await browser.newPage();

        // Disable CSS transitions/animations so screenshots are stable.
        await tab.addStyleTag({
          content: `*, *::before, *::after {
            animation-duration: 0s !important;
            transition-duration: 0s !important;
          }`,
        });

        await tab.setViewport({ width: vp.width, height: 900 });
        await tab.goto(`http://localhost:${port}${page.path}`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });

        // Wait for web fonts and any deferred rendering.
        await tab.evaluate(() => document.fonts.ready);
        await new Promise((r) => setTimeout(r, SETTLE_MS));

        // Measure full scrollable height.
        const fullHeight = await tab.evaluate(
          () =>
            Math.max(
              document.body.scrollHeight,
              document.documentElement.scrollHeight,
            ),
        );

        // Resize viewport to match full page height for a lossless screenshot.
        await tab.setViewport({ width: vp.width, height: fullHeight });

        const filename = `${page.slug}-${vp.name.toLowerCase()}.png`;
        const filepath = path.join(OUTPUT_DIR, filename);

        await tab.screenshot({ path: filepath, fullPage: false });
        await tab.close();

        pageEntry.files.push({
          viewport: vp.name,
          width: vp.width,
          height: fullHeight,
          file: filename,
        });

        console.log(`  ✓  ${filename}  (${vp.width} × ${fullHeight}px)`);
      }

      manifest.pages.push(pageEntry);
    }

    writeFileSync(
      path.join(OUTPUT_DIR, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
    );

    console.log('\nExport complete.');
    console.log(`Output saved to:  figma-export/output/\n`);
    console.log('Next steps:');
    console.log('  1. Open Figma');
    console.log('  2. Plugins → Development → Import plugin from manifest…');
    console.log('  3. Select  figma-plugin/manifest.json');
    console.log('  4. Run "Portfolio Importer" and select all files in output/');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('Export failed:', err.message);
  process.exit(1);
});
