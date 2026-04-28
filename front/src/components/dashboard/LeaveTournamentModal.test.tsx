import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import LeaveTournamentModal from './LeaveTournamentModal';

const baseTournament = {
  id: 12,
  uuid: 'uuid-12',
  name: 'Tournoi Knockout',
  is_private: false,
  max_players: 16,
};

describe('LeaveTournamentModal', () => {
  it('ne rend rien sans tournoi sélectionné', () => {
    const { container } = render(
      <LeaveTournamentModal
        tournament={null}
        isLeaving={false}
        error=""
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('rend une vraie dialog accessible et focus le bouton annuler', async () => {
    render(
      <LeaveTournamentModal
        tournament={baseTournament}
        isLeaving={false}
        error=""
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /quitter le tournoi/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/tournoi knockout/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /annuler/i })).toHaveFocus();
    });
  });

  it('se ferme avec échap quand aucune requête n’est en cours', () => {
    const onClose = jest.fn();

    render(
      <LeaveTournamentModal
        tournament={baseTournament}
        isLeaving={false}
        error=""
        onClose={onClose}
        onConfirm={() => {}}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('affiche l’état de chargement et bloque la fermeture pendant la désinscription', () => {
    const onClose = jest.fn();

    render(
      <LeaveTournamentModal
        tournament={baseTournament}
        isLeaving
        error=""
        onClose={onClose}
        onConfirm={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: /désinscription/i })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByLabelText(/fermer/i));

    expect(onClose).not.toHaveBeenCalled();
  });
});

