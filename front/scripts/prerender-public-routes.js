const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const INDEX_FILE = path.join(BUILD_DIR, 'index.html');
const DEFAULT_PUBLIC_SITE_URL = 'https://app.betleague.app';

const resolveSiteUrl = () => {
  const rawValue = process.env.REACT_APP_SITE_URL || process.env.APP_FRONTEND_URL || process.env.SITE_URL;
  const requirePublicUrl = process.env.SEO_REQUIRE_PUBLIC_URL === 'true';

  if (!rawValue) {
    return DEFAULT_PUBLIC_SITE_URL;
  }

  const candidate = rawValue.trim();

  try {
    return new URL(candidate).origin;
  } catch {
    if (requirePublicUrl) {
      throw new Error(`Invalid public site URL: ${candidate}`);
    }

    return DEFAULT_PUBLIC_SITE_URL;
  }
};

const siteUrl = resolveSiteUrl();
const absoluteUrl = (pathname) => new URL(pathname, `${siteUrl}/`).toString();

const sharedImage = '/betleague-logo.jpg';

const routes = [
  {
    path: '/',
    title: 'BetLeague — Pronostics gratuits entre amis',
    description: 'BetLeague est la plateforme de pronostic gratuit entre amis pour créer une ligue de pronostics sportifs, partager vos tickets et profiter de paris sportifs gratuits dans une expérience mobile rapide et sécurisée.',
    robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
    type: 'website',
    imagePath: sharedImage,
    snapshot: `
      <main class="prerender-shell__content">
        <section class="prerender-hero">
          <span class="prerender-eyebrow">Pronostic gratuit entre amis</span>
          <h1>BetLeague, l’application de pronostic gratuit entre amis</h1>
          <p>Créez une ligue de pronostics sportifs, partagez vos tickets et profitez de paris sportifs gratuits dans une expérience mobile rapide, fluide et sécurisée.</p>
          <ul>
            <li>Ligue paris sportifs simple à lancer</li>
            <li>Tickets partagés et résultats lisibles sur mobile</li>
            <li>Jeu social gratuit sans argent réel</li>
          </ul>
        </section>
        <section class="prerender-grid" aria-label="Bénéfices BetLeague">
          <article><h2>Créez votre ligue</h2><p>Lancez une ligue de pronostics sportifs privée avec vos amis autour de vos sports préférés.</p></article>
          <article><h2>Suivez vos tickets</h2><p>Consultez vos sélections, vos gains fictifs et vos performances en quelques secondes.</p></article>
          <article><h2>Partagez vos résultats</h2><p>Diffusez vos tickets et animez votre groupe avec une expérience web mobile-first.</p></article>
        </section>
      </main>
    `,
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'BetLeague',
        url: absoluteUrl('/'),
        logo: absoluteUrl('/betleague-logo.png'),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'BetLeague',
        url: absoluteUrl('/'),
        inLanguage: 'fr-FR',
        description: 'Plateforme de pronostic gratuit entre amis et de ligue de pronostics sportifs.',
      },
    ],
  },
  {
    path: '/cgu',
    title: 'Conditions générales d’utilisation — BetLeague',
    description: 'Consultez les conditions générales d’utilisation de BetLeague, application de ligues de pronostics sportifs entre amis.',
    robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
    type: 'article',
    imagePath: sharedImage,
    snapshot: `
      <main class="prerender-shell__content prerender-shell__content--legal">
        <span class="prerender-eyebrow">Cadre d’utilisation</span>
        <h1>Conditions Générales d’Utilisation</h1>
        <p>BetLeague est une application de divertissement social autour des pronostics sportifs. Les BTL sont des points fictifs, sans valeur monétaire, utilisés uniquement pour jouer pour le plaisir.</p>
        <section>
          <h2>Nature du service</h2>
          <p>BetLeague propose des ligues privées et des fonctionnalités de pronostics sportifs à des fins exclusivement récréatives, sans mise d’argent réelle ni gain financier.</p>
        </section>
        <section>
          <h2>Compte utilisateur et sécurité</h2>
          <p>L’inscription est réservée aux personnes âgées d’au moins 15 ans. L’utilisateur est responsable de la confidentialité de ses identifiants et du respect des règles d’usage.</p>
        </section>
      </main>
    `,
  },
  {
    path: '/confidentialite',
    title: 'Politique de confidentialité — BetLeague',
    description: 'Découvrez comment BetLeague protège vos données personnelles, sécurise les accès et respecte votre confidentialité.',
    robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
    type: 'article',
    imagePath: sharedImage,
    snapshot: `
      <main class="prerender-shell__content prerender-shell__content--legal">
        <span class="prerender-eyebrow">Protection des données</span>
        <h1>Politique de confidentialité</h1>
        <p>Cette page explique quelles données peuvent être traitées par BetLeague, pourquoi elles le sont et comment elles sont protégées dans le cadre d’une application de divertissement social gratuite.</p>
        <section>
          <h2>Données traitées</h2>
          <p>BetLeague peut traiter des données de compte, des données d’usage liées aux ligues et tickets, ainsi que des traces techniques nécessaires à la sécurité du service.</p>
        </section>
        <section>
          <h2>Vos droits</h2>
          <p>Vous disposez de droits d’accès, de rectification, d’effacement, de limitation, de portabilité et d’opposition, à exercer via contact@betleague.app.</p>
        </section>
      </main>
    `,
  },
  {
    path: '/mentions-legales',
    title: 'Mentions légales — BetLeague',
    description: 'Accédez aux mentions légales officielles de BetLeague et aux informations relatives à l’éditeur du service.',
    robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
    type: 'article',
    imagePath: sharedImage,
    snapshot: `
      <main class="prerender-shell__content prerender-shell__content--legal">
        <span class="prerender-eyebrow">Informations légales</span>
        <h1>Mentions légales</h1>
        <p>BetLeague est un service de communication au public en ligne édité à titre non professionnel, conformément à la loi pour la confiance dans l’économie numérique.</p>
        <section>
          <h2>Contact</h2>
          <p>Pour toute question relative au service : contact@betleague.app.</p>
        </section>
        <section>
          <h2>Hébergeur</h2>
          <p>OVH SAS — 2 rue Kellermann, 59100 Roubaix — France.</p>
        </section>
      </main>
    `,
  },
];

const replaceTagContent = (html, pattern, replacement) => {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  return html;
};

const upsertMeta = (html, attrName, attrValue, content) => {
  const escapedValue = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`<meta[^>]+${attrName}="${escapedValue}"[^>]*>`, 'i');
  const tag = `<meta ${attrName}="${attrValue}" content="${content}">`;
  return regex.test(html) ? html.replace(regex, tag) : html.replace('</head>', `  ${tag}\n</head>`);
};

const upsertLink = (html, rel, href) => {
  const regex = new RegExp(`<link[^>]+rel="${rel}"[^>]*>`, 'i');
  const tag = `<link rel="${rel}" href="${href}">`;
  return regex.test(html) ? html.replace(regex, tag) : html.replace('</head>', `  ${tag}\n</head>`);
};

const upsertStructuredData = (html, structuredData) => {
  const regex = /<script type="application\/ld\+json" data-prerender-route="seo">[\s\S]*?<\/script>/i;
  const tag = `<script type="application/ld+json" data-prerender-route="seo">${JSON.stringify(structuredData)}</script>`;
  return regex.test(html) ? html.replace(regex, tag) : html.replace('</head>', `  ${tag}\n</head>`);
};

const injectSnapshot = (html, route) => {
  const shell = `\n<div class="prerender-shell" data-route="${route.path}">${route.snapshot}\n</div>\n<div id="root"></div>`;
  return html.replace(/<div id="root"><\/div>/i, shell);
};

const ensureDirectory = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

if (!fs.existsSync(INDEX_FILE)) {
  throw new Error(`Missing build index file at ${INDEX_FILE}. Run the build first.`);
}

const baseHtml = fs.readFileSync(INDEX_FILE, 'utf8');

routes.forEach((route) => {
  const canonical = absoluteUrl(route.path);
  const image = absoluteUrl(route.imagePath);
  let html = baseHtml;

  html = replaceTagContent(html, /<title>.*?<\/title>/i, `<title>${route.title}</title>`);
  html = upsertMeta(html, 'name', 'description', route.description);
  html = upsertMeta(html, 'name', 'robots', route.robots);
  html = upsertMeta(html, 'property', 'og:title', route.title);
  html = upsertMeta(html, 'property', 'og:description', route.description);
  html = upsertMeta(html, 'property', 'og:type', route.type);
  html = upsertMeta(html, 'property', 'og:url', canonical);
  html = upsertMeta(html, 'property', 'og:image', image);
  html = upsertMeta(html, 'property', 'og:image:alt', 'BetLeague, application de ligues de pronostics sportifs entre amis');
  html = upsertMeta(html, 'name', 'twitter:title', route.title);
  html = upsertMeta(html, 'name', 'twitter:description', route.description);
  html = upsertMeta(html, 'name', 'twitter:image', image);
  html = upsertLink(html, 'canonical', canonical);
  html = upsertStructuredData(html, route.structuredData ?? {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: route.title,
    description: route.description,
    url: canonical,
    inLanguage: 'fr-FR',
  });
  html = injectSnapshot(html, route);

  const outputFile = route.path === '/'
    ? INDEX_FILE
    : path.join(BUILD_DIR, route.path.replace(/^\//, ''), 'index.html');

  ensureDirectory(outputFile);
  fs.writeFileSync(outputFile, html, 'utf8');
});

console.log(`Pre-rendered public routes for ${siteUrl}`);




