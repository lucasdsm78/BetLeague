import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import EditLeagueModal from './EditLeagueModal';
import { updateLeague } from '../../services/api/leagues';

jest.mock('../../services/api/leagues', () => ({
  updateLeague: jest.fn(),
}));

describe('EditLeagueModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('envoie min_players lors de la modification de la ligue', async () => {
    (updateLeague as jest.Mock).mockResolvedValueOnce({ message: 'The league is well updated.' });

    const onClose = jest.fn();
    const onSuccess = jest.fn();

    render(
      <EditLeagueModal
        league={{
          id: 12,
          name: 'Ligue Premium',
          isStarted: false,
          maxPlayers: 10,
          minPlayers: 4,
          isFree: true,
          startDate: 1_735_689_600,
        }}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    fireEvent.change(screen.getByLabelText(/nombre minimum de joueurs/i), {
      target: { value: '6' },
    });

    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => {
      expect(updateLeague).toHaveBeenCalledWith(
        12,
        expect.objectContaining({
          name: 'Ligue Premium',
          max_players: 10,
          min_players: 6,
        })
      );
    });

    expect(onSuccess).toHaveBeenCalled();
  });
});

