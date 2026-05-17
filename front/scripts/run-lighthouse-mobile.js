const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const REPORT_DIR = path.join(BUILD_DIR, 'lighthouse');
const PORT = Number(process.env.LIGHTHOUSE_PORT || 4173);
const ROUTE = process.env.LIGHTHOUSE_ROUTE || '/';
const HOST = process.env.LIGHTHOUSE_HOST || 'localhost';
const url = `http://${HOST}:${PORT}${ROUTE}`;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const resolveFilePath = (requestUrl) => {
  const pathname = decodeURIComponent(new URL(requestUrl, `http://${HOST}`).pathname);
  const directPath = path.join(BUILD_DIR, pathname);
  const indexPath = path.join(BUILD_DIR, pathname, 'index.html');

  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return directPath;
  }

  if (fs.existsSync(indexPath)) {
    return indexPath;
  }

  return path.join(BUILD_DIR, 'index.html');
};

const server = http.createServer((request, response) => {
  try {
    const filePath = resolveFilePath(request.url || '/');
    const ext = path.extname(filePath).toLowerCase();
    const body = fs.readFileSync(filePath);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Unable to serve build: ${error.message}`);
  }
});

const run = async () => {
  if (!fs.existsSync(path.join(BUILD_DIR, 'index.html'))) {
    throw new Error('Missing production build. Run `npm run build` first.');
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });

  await new Promise((resolve) => server.listen(PORT, HOST, resolve));

  const outputPath = path.join(REPORT_DIR, 'mobile-report');
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  await new Promise((resolve, reject) => {
    const child = spawn(
      npxCommand,
      [
        '-y',
        'lighthouse',
        url,
        '--quiet',
        '--no-enable-error-reporting',
        '--only-categories=performance,accessibility,best-practices,seo',
        '--form-factor=mobile',
        '--screenEmulation.mobile',
        '--chrome-flags=--headless --no-sandbox',
        '--output=json',
        '--output=html',
        `--output-path=${outputPath}`,
      ],
      { stdio: 'inherit', env: process.env },
    );

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Lighthouse exited with code ${code}`));
    });
  });

  const reportJsonPath = `${outputPath}.report.json`;
  const report = JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));
  const categories = report.categories || {};

  console.log('\nLighthouse mobile summary');
  Object.entries(categories).forEach(([key, value]) => {
    if (!value || typeof value.score !== 'number') return;
    console.log(`- ${key}: ${Math.round(value.score * 100)}/100`);
  });
  console.log(`Reports written to ${REPORT_DIR}`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    server.close();
  });


