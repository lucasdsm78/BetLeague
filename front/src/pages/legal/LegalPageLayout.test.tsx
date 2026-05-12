import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import LegalPageLayout from './LegalPageLayout';

describe('LegalPageLayout', () => {
  it('n’affiche plus les liens rapides Accueil, Connexion et Créer un compte', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LegalPageLayout
          eyebrow="Informations légales"
          title="Mentions légales"
          subtitle="Sous-titre"
          updatedAt="13 mai 2026"
        >
          <p>Contenu de test</p>
        </LegalPageLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /revenir à la page précédente/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /accueil/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /connexion/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /créer un compte/i })).not.toBeInTheDocument();
  });
});


