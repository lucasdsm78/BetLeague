import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { buildAbsoluteUrl, getSeoMetaForPath } from './seoConfig';
const upsertMeta = (selector: string, attributes: Record<string, string>) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
};
const upsertLink = (selector: string, attributes: Record<string, string>) => {
  let element = document.head.querySelector<HTMLLinkElement>(selector);
  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
};
const upsertStructuredData = (jsonLd: string) => {
  let scriptElement = document.head.querySelector<HTMLScriptElement>('script[data-betleague-seo="json-ld"]');
  if (!scriptElement) {
    scriptElement = document.createElement('script');
    scriptElement.type = 'application/ld+json';
    scriptElement.setAttribute('data-betleague-seo', 'json-ld');
    document.head.appendChild(scriptElement);
  }
  scriptElement.textContent = jsonLd;
};
const SeoHead = () => {
  const location = useLocation();
  useEffect(() => {
    const seo = getSeoMetaForPath(location.pathname);
    const canonicalUrl = buildAbsoluteUrl(seo.canonicalPath);
    const imageUrl = buildAbsoluteUrl(seo.imagePath);
    document.title = seo.title;
    document.documentElement.lang = 'fr';
    upsertMeta('meta[name="description"]', { name: 'description', content: seo.description });
    if (seo.keywords) {
      upsertMeta('meta[name="keywords"]', { name: 'keywords', content: seo.keywords });
    }
    upsertMeta('meta[name="robots"]', { name: 'robots', content: seo.robots });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'fr_FR' });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'BetLeague' });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: seo.title });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: seo.description });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: seo.type });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: imageUrl });
    upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: 'BetLeague, application de ligues de pronostics sportifs entre amis' });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.title });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: seo.description });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: imageUrl });
    upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl });
    if (seo.structuredData) {
      upsertStructuredData(JSON.stringify(seo.structuredData));
      return;
    }
    document.head.querySelector('script[data-betleague-seo="json-ld"]')?.remove();
  }, [location.pathname]);
  return null;
};
export default SeoHead;
