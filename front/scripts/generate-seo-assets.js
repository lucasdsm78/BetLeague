const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const INDEXABLE_ROUTES = ['/', '/cgu', '/confidentialite', '/mentions-legales'];
const LOCAL_FALLBACK_URL = 'http://localhost:3000';

const resolveSiteUrl = () => {
  const rawValue = process.env.REACT_APP_SITE_URL || process.env.APP_FRONTEND_URL || process.env.SITE_URL;
  const requirePublicUrl = process.env.SEO_REQUIRE_PUBLIC_URL === 'true';

  if (!rawValue) {
    if (requirePublicUrl) {
      throw new Error('Missing public site URL. Define REACT_APP_SITE_URL, APP_FRONTEND_URL or SITE_URL before running the production build.');
    }

    return LOCAL_FALLBACK_URL;
  }

  const candidate = rawValue.trim();

  try {
    return new URL(candidate).origin;
  } catch {
    if (requirePublicUrl) {
      throw new Error(`Invalid public site URL: ${candidate}`);
    }

    return LOCAL_FALLBACK_URL;
  }
};

const siteUrl = resolveSiteUrl();

const buildAbsoluteUrl = (pathname) => new URL(pathname, `${siteUrl}/`).toString();

const robotsContent = [
  'User-agent: *',
  'Allow: /',
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


