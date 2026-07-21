// Builds the component storybook artifact: a self-contained, browsable directory with the
// live demo page plus one PNG screenshot per theme (and one with the client menu open),
// captured with Playwright. Output goes to storybook-dist/ for CI to upload / a container
// to serve.
import { createServer } from 'node:http';
import { copyFile, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { extname, join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'storybook-dist');
const shotDir = join(outDir, 'screenshots');
const assetOut = join(outDir, 'assets');
const zipPath = join(root, 'storybook.zip');

const SHARED_ASSETS = [
  'bunnyland-ui.css',
  'bunnyland-ui.js',
  'bunnyland-api.js',
  'bunnyland-play.js',
];

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

async function loadThemes() {
  // Reuse the package's own theme list so the storybook never drifts from the source of truth.
  try {
    const mod = await import(join(root, 'dist', 'theme.js'));
    if (Array.isArray(mod.THEME_OPTIONS) && mod.THEME_OPTIONS.length) return mod.THEME_OPTIONS;
  } catch {
    // dist not built yet — fall back to the documented palette list.
  }
  return [
    { value: 'purple-blue', label: 'Purple / Blue' },
    { value: 'candy', label: 'Candy Pink / Cyan' },
    { value: 'earth', label: 'Earth Green / Gold' },
    { value: 'ocean', label: 'Ocean Teal / Coral' },
    { value: 'sunset', label: 'Sunset Orange / Plum' },
    { value: 'high-contrast', label: 'High Contrast' },
  ];
}

async function assembleOutput() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(assetOut, { recursive: true });
  await mkdir(shotDir, { recursive: true });
  for (const asset of SHARED_ASSETS) {
    await copyFile(join(root, 'assets', asset), join(assetOut, asset));
  }
  await cp(join(root, 'storybook', 'index.html'), join(outDir, 'index.html'));
  await cp(join(root, 'storybook', 'storybook.js'), join(outDir, 'storybook.js'));
  await copyFile(join(root, '.storybook-build', 'preact-story.js'), join(assetOut, 'preact-story.js'));
  await copyFile(join(root, '.storybook-build', 'preact-story.js.map'), join(assetOut, 'preact-story.js.map'));
}

function startServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/' || path.endsWith('/')) path += 'index.html';
    const filePath = join(outDir, path);
    if (!filePath.startsWith(outDir)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const type = CONTENT_TYPES[extname(filePath)] || 'application/octet-stream';
    const stream = createReadStream(filePath);
    stream.on('open', () => {
      res.writeHead(200, { 'content-type': type });
      stream.pipe(res);
    });
    stream.on('error', () => res.writeHead(404).end('not found'));
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (err) {
    // The CI runner installs the bundled browser; locally fall back to a system Chrome so a
    // version-mismatched or missing download does not block a capture.
    const channel = process.env.STORYBOOK_BROWSER_CHANNEL || 'chrome';
    process.stderr.write(`bundled chromium unavailable (${err.message}); using channel "${channel}"\n`);
    return chromium.launch({ channel });
  }
}

function galleryHtml(variants) {
  const cards = variants.map(variant => `
      <figure class="shot">
        <a href="index.html?theme=${encodeURIComponent(variant.theme)}&amp;scheme=${variant.scheme}">
          <img src="screenshots/${encodeURIComponent(variant.value)}.png" alt="Storybook in the ${variant.label} theme" loading="lazy" />
        </a>
        <figcaption><strong>${variant.label}</strong><span>${variant.value}</span></figcaption>
      </figure>`).join('');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bunnyland UI Web — Storybook Screenshots</title>
    <link rel="stylesheet" href="assets/bunnyland-ui.css" />
    <style>
      body { display: block; height: auto; min-height: 100vh; overflow: auto; }
      .wrap { max-width: 1180px; margin: 0 auto; padding: 20px; }
      h1 { color: var(--bl-text); font-size: 18px; margin-bottom: 6px; }
      p.lede { color: var(--bl-text-soft); font-size: var(--bl-text-md); margin-bottom: 18px; line-height: 1.6; }
      .gallery { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
      .shot { margin: 0; border: 1px solid var(--bl-border); border-radius: var(--bl-radius-md); overflow: hidden; background: var(--bl-bg-strong); }
      .shot img { display: block; width: 100%; height: auto; border-bottom: 1px solid var(--bl-border); }
      .shot figcaption { display: flex; justify-content: space-between; gap: 8px; padding: 8px 10px; font-size: var(--bl-text-sm); color: var(--bl-text-soft); }
      .shot figcaption span { color: var(--bl-text-muted); }
      a { color: var(--bl-accent); }
      @media (max-width: 720px) { .gallery { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>🐰 Bunnyland UI Web — Storybook Screenshots</h1>
      <p class="lede">
        Every shared component rendered across all six palettes in dark and light modes.
        Click any shot to open the live, interactive storybook in that appearance.
        <a href="index.html">Open the live storybook →</a>
        &nbsp;·&nbsp;
        <a href="storybook.zip" download>Download ZIP (offline bundle)</a>
      </p>
      <div class="gallery">
        ${cards}
        <figure class="shot">
          <a href="index.html?open=menu">
            <img src="screenshots/client-menu.png" alt="Storybook with the client menu overlay open" loading="lazy" />
          </a>
          <figcaption><strong>Client menu overlay</strong><span>initClientMenu</span></figcaption>
        </figure>
      </div>
    </div>
  </body>
</html>
`;
}

// ── Minimal self-contained ZIP writer (deflate) ───────────────────────────────
// Avoids a third-party archiver dependency and any reliance on a system `zip` binary
// inside the container. Emits a standard deflate ZIP the OS/browsers can open.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(full));
    } else {
      files.push({ name: relative(outDir, full).split(sep).join('/'), data: await readFile(full) });
    }
  }
  return files;
}

async function writeZip(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = Buffer.from(file.name, 'utf8');
    const crc = crc32(file.data);
    const compressed = deflateRawSync(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, compressed);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(file.data.length, 24);
    cd.writeUInt16LE(nameBytes.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBytes);

    offset += local.length + nameBytes.length + compressed.length;
  }
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  await writeFile(zipPath, Buffer.concat([...locals, centralBuffer, end]));
}

async function main() {
  const themes = await loadThemes();
  const variants = themes.flatMap(theme => ['dark', 'light'].map(scheme => ({
    label: `${theme.label} ${scheme === 'dark' ? 'Dark' : 'Light'}`,
    scheme,
    theme: theme.value,
    value: `${theme.value}-${scheme}`,
  })));
  await assembleOutput();

  const server = await startServer();
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${base}/index.html?theme=ocean&scheme=auto`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__storybookReady === true && window.__preactStoryReady === true);
  const autoDarkBackground = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bl-bg'));
  await page.emulateMedia({ colorScheme: 'light' });
  const autoLightBackground = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bl-bg'));
  if (autoDarkBackground === autoLightBackground) throw new Error('automatic color scheme did not change theme tokens');
  process.stdout.write('verified prefers-color-scheme auto mode\n');

  const captured = [];
  for (const variant of variants) {
    await page.goto(`${base}/index.html?theme=${encodeURIComponent(variant.theme)}&scheme=${variant.scheme}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__storybookReady === true && window.__preactStoryReady === true);
    const file = join(shotDir, `${variant.value}.png`);
    await page.screenshot({ path: file, fullPage: true });
    captured.push(`${variant.value}.png`);
    process.stdout.write(`captured ${variant.value}\n`);
  }

  // Overlay shot: client menu open on the default theme.
  await page.goto(`${base}/index.html?theme=${encodeURIComponent(themes[0].value)}&scheme=dark&open=menu`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__storybookReady === true && window.__preactStoryReady === true);
  await page.waitForSelector('#client-menu-dialog:not(.hidden)');
  await page.screenshot({ path: join(shotDir, 'client-menu.png'), fullPage: true });
  captured.push('client-menu.png');
  process.stdout.write('captured client-menu\n');

  await browser.close();
  await new Promise(resolve => server.close(resolve));

  await writeFile(join(outDir, 'screenshots.html'), galleryHtml(variants));

  // Bundle the whole browsable directory (HTML + CSS + JS + screenshots) into a ZIP so it
  // can be downloaded and opened offline from file://. Drop a copy inside the served output
  // too so the gallery's download link resolves from the container and the artifact.
  const files = await collectFiles(outDir);
  await writeZip(files);
  await copyFile(zipPath, join(outDir, 'storybook.zip'));

  process.stdout.write(`\nstorybook-dist ready: ${captured.length} screenshots + index.html + screenshots.html\n`);
  process.stdout.write(`storybook.zip ready: ${files.length} files bundled\n`);
}

main().catch(err => {
  process.stderr.write(`${err.stack || err}\n`);
  process.exitCode = 1;
});
