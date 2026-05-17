export type RobotsDirective = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' | 'noindex,nofollow,noarchive';

export interface SeoMeta {
  readonly title: string;
  readonly description: string;
  readonly keywords?: string;
  readonly canonicalPath: string;
  readonly robots: RobotsDirective;
  readonly type: 'website' | 'article';
  readonly imagePath: string;
  readonly structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}

const SITE_NAME = 'BetLeague';
const DEFAULT_IMAGE_PATH = '/betleague-logo.jpg';
const HOME_KEYWORDS = 'pronostic gratuit entre amis, ligue de pronostics sportifs, paris sportifs gratuits, ligue paris sportifs';
const INDEXABLE_ROBOTS: RobotsDirective = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
const NOINDEX_ROBOTS: RobotsDirective = 'noindex,nofollow,noarchive';

const normalizeSiteUrl = (rawUrl?: string): string => {
  const fallback = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const candidate = (rawUrl || fallback).trim();

  try {
    return new URL(candidate).origin;
  } catch {
    return fallback;
  }
};

export const getSiteUrl = (): string => normalizeSiteUrl(process.env.REACT_APP_SITE_URL);

export const buildAbsoluteUrl = (path: string): string => {
  const siteUrl = getSiteUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, `${siteUrl}/`).toString();
};

const defaultDescription = 'BetLeague est la plateforme de pronostic gratuit entre amis pour créer une ligue de pronostics sportifs, partager vos tickets et profiter de paris sportifs gratuits dans une expérience mobile rapide et sécurisée.';

const homeStructuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: buildAbsoluteUrl('/'),
    logo: buildAbsoluteUrl('/betleague-logo.png'),
    sameAs: [],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: buildAbsoluteUrl('/'),
    inLanguage: 'fr-FR',
    description: defaultDescription,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Qu’est-ce que BetLeague ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'BetLeague est une plateforme de pronostic gratuit entre amis pour créer une ligue de pronostics sportifs privée, publier ses tickets et comparer ses performances en temps réel.',
        },
      },
      {
        '@type': 'Question',
        name: 'Peut-on utiliser BetLeague sur mobile ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Oui. L’interface BetLeague est pensée mobile-first avec une navigation tactile rapide, des temps de chargement optimisés et une expérience fluide sur smartphone.',
        },
      },
      {
        '@type': 'Question',
        name: 'BetLeague propose-t-il des gains en argent réel ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Non. BetLeague est un jeu social gratuit basé sur des points fictifs et ne propose ni retrait ni gain monétaire.',
        },
      },
    ],
  },
];

const routeMetaByPath: Record<string, SeoMeta> = {
  '/': {
    title: 'BetLeague — Pronostics gratuits entre amis',
    description: defaultDescription,
    keywords: HOME_KEYWORDS,
    canonicalPath: '/',
    robots: INDEXABLE_ROBOTS,
    type: 'website',
    imagePath: DEFAULT_IMAGE_PATH,
    structuredData: homeStructuredData,
  },
  '/cgu': {
    title: 'Conditions générales d’utilisation — BetLeague',
    description: 'Consultez les conditions générales d’utilisation de BetLeague, application de ligues de pronostics sportifs entre amis.',
    canonicalPath: '/cgu',
    robots: INDEXABLE_ROBOTS,
    type: 'article',
    imagePath: DEFAULT_IMAGE_PATH,
  },
  '/confidentialite': {
    title: 'Politique de confidentialité — BetLeague',
    description: 'Découvrez comment BetLeague protège vos données personnelles, sécurise les accès et respecte votre confidentialité.',
    canonicalPath: '/confidentialite',
    robots: INDEXABLE_ROBOTS,
    type: 'article',
    imagePath: DEFAULT_IMAGE_PATH,
  },
  '/mentions-legales': {
    title: 'Mentions légales — BetLeague',
    description: 'Accédez aux mentions légales officielles de BetLeague et aux informations relatives à l’éditeur du service.',
    canonicalPath: '/mentions-legales',
    robots: INDEXABLE_ROBOTS,
    type: 'article',
    imagePath: DEFAULT_IMAGE_PATH,
  },
};

const authPrefixes = ['/login', '/register', '/2fa', '/forgot-password'];
const privatePrefixes = ['/matches', '/leagues', '/invitations', '/tournaments', '/tickets', '/shop', '/profile'];

const createNoIndexMeta = (title: string, description: string, canonicalPath: string): SeoMeta => ({
  title,
  description,
  canonicalPath,
  robots: NOINDEX_ROBOTS,
  type: 'website',
  imagePath: DEFAULT_IMAGE_PATH,
});

export const getSeoMetaForPath = (pathname: string): SeoMeta => {
  const exactMatch = routeMetaByPath[pathname];
  if (exactMatch) {
    return exactMatch;
  }

  if (pathname.startsWith('/tickets/shared/')) {
    return createNoIndexMeta(
      'Ticket partagé — BetLeague',
      'Consultez un ticket partagé BetLeague. Cette page publique reste exclue de l’indexation pour protéger la confidentialité des joueurs.',
      pathname,
    );
  }

  if (authPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return createNoIndexMeta(
      'Connexion sécurisée — BetLeague',
      'Accédez à votre espace BetLeague pour gérer vos ligues, vos tickets et vos pronostics sportifs en toute sécurité.',
      pathname,
    );
  }

  if (privatePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return createNoIndexMeta(
      'Espace membre — BetLeague',
      'Zone privée BetLeague réservée aux utilisateurs connectés.',
      pathname,
    );
  }

  return createNoIndexMeta(
    `${SITE_NAME} — Pronostic gratuit entre amis`,
    defaultDescription,
    pathname || '/',
  );
};




