const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const INDEXABLE_ROUTES = ['/', '/cgu', '/confidentialite', '/mentions-legales'];
const EXCLUDED_ROUTES = ['/login', '/register', '/2fa', '/forgot-password', '/matches', '/leagues', '/invitations', '/tournaments', '/tickets', '/shop', '/profile'];

const normalizeSiteUrl = (value) => {
  const fallback = 'http://localhost:3000';
  const candidate = (value || fallback).trim();

  try {
    return new URL(candidate).origin;
  } catch {
    return fallback;
  }
};

const siteUrl = normalizeSiteUrl(process.env.REACT_APP_SITE_URL || process.env.APP_FRONTEND_URL || process.env.SITE_URL);

const buildAbsoluteUrl = (pathname) => new URL(pathname, `${siteUrl}/`).toString();

const robotsContent = [
  'User-agent: *',
  'Allow: /',
  ...EXCLUDED_ROUTES.map((route) => `Disallow: ${route}`),
  `Sitemap: ${buildAbsoluteUrl('/sitemap.xml')}`,
  '',
].join('\n');

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${INDEXABLE_ROUTES.map((route) => `  <url>\n    <loc>${buildAbsoluteUrl(route)}</loc>\n    <changefreq>${route === '/' ? 'weekly' : 'monthly'}</changefreq>\n    <priority>${route === '/' ? '1.0' : '0.4'}</priority>\n  </url>`).join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), robotsContent, 'utf8');
fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapContent, 'utf8');

console.log(`SEO assets generated for ${siteUrl}`);

