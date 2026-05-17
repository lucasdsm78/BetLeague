/* eslint-disable testing-library/no-node-access */
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import SeoHead from './SeoHead';

const getMeta = (selector: string) => document.head.querySelector(selector)?.getAttribute('content');
const getCanonical = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');

describe('SeoHead', () => {
  beforeEach(() => {
    process.env.REACT_APP_SITE_URL = 'https://betleague.app';
    document.title = 'Test';
    document.head.querySelector('meta[name="description"]')?.remove();
    document.head.querySelector('meta[name="robots"]')?.remove();
    document.head.querySelector('meta[property="og:title"]')?.remove();
    document.head.querySelector('meta[name="twitter:title"]')?.remove();
    document.head.querySelector('link[rel="canonical"]')?.remove();
    document.head.querySelector('script[data-betleague-seo="json-ld"]')?.remove();
  });

  it('applique des métadonnées indexables sur la page d’accueil', () => {
    render(
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SeoHead />
      </MemoryRouter>
    );

    expect(document.title).toContain('BetLeague');
    expect(getMeta('meta[name="robots"]')).toContain('index,follow');
    expect(getMeta('meta[property="og:title"]')).toContain('BetLeague');
    expect(getCanonical()).toBe('https://betleague.app/');
    expect(document.head.querySelector('script[data-betleague-seo="json-ld"]')).toBeInTheDocument();
  });

  it('applique noindex sur une route privée', () => {
    render(
      <MemoryRouter initialEntries={['/matches']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SeoHead />
      </MemoryRouter>
    );

    expect(getMeta('meta[name="robots"]')).toBe('noindex,nofollow,noarchive');
    expect(getMeta('meta[name="description"]')).toContain('Zone privée');
    expect(getCanonical()).toBe('https://betleague.app/matches');
  });

  it('applique noindex sur un ticket partagé public', () => {
    render(
      <MemoryRouter initialEntries={['/tickets/shared/abc-123']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SeoHead />
      </MemoryRouter>
    );

    expect(getMeta('meta[name="robots"]')).toBe('noindex,nofollow,noarchive');
    expect(getMeta('meta[name="twitter:title"]')).toContain('Ticket partagé');
    expect(getCanonical()).toBe('https://betleague.app/tickets/shared/abc-123');
  });
});



