import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import CreateLeagueForm from './CreateLeagueForm';
import { createLeague } from '../../services/api/leagues';

jest.mock('../../services/api/leagues', () => ({
  createLeague: jest.fn(),
}));

jest.mock('../../hooks/useAuth.enhanced', () => ({
  useEnhancedAuth: () => ({
    user: { email: 'owner@example.com', btlBalance: 500 },
  }),
}));

jest.mock('../../hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    profile: { nb_btl: 500 },
    refetch: jest.fn(),
  }),
}));

jest.mock('../InsufficientBTLModal', () => ({
  __esModule: true,
  default: () => null,
}));

describe('CreateLeagueForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calcule automatiquement la date de fin et envoie start_date au backend', async () => {
    (createLeague as jest.Mock).mockResolvedValueOnce({ message: 'The free league is well created' });
    const onSuccess = jest.fn();
    const onClose = jest.fn();

    render(
      <CreateLeagueForm
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    fireEvent.change(screen.getByLabelText(/nom de la ligue/i), {
      target: { value: 'Ligue programmée' },
    });

    fireEvent.change(screen.getByLabelText(/date de début/i), {
      target: { name: 'startDate', value: '2025-01-01T10:30' },
    });

    fireEvent.change(screen.getByLabelText(/joueurs minimum/i), {
      target: { name: 'minMembers', value: '4' },
    });

    expect(screen.getByLabelText(/date de fin/i)).toHaveValue('2025-01-08T10:30');

    fireEvent.click(screen.getByRole('button', { name: /créer la ligue/i }));

    await waitFor(() => {
      expect(createLeague).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Ligue programmée',
            min_players: 4,
          start_date: new Date('2025-01-01T10:30').getTime(),
        })
      );
    });

    expect(onSuccess).toHaveBeenCalledWith({ message: 'The free league is well created' }, 'The free league is well created');
    expect(onClose).toHaveBeenCalled();
  });
});

