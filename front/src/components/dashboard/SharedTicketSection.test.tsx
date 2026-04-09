import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import SharedTicketSection from './SharedTicketSection';
import { getSharedTicketDetail } from '../../services/api/tickets';

jest.mock('../../services/api/tickets', () => ({
  getSharedTicketDetail: jest.fn(),
}));

jest.mock('./TicketShareSheet', () => ({
  __esModule: true,
  default: () => null,
}));

describe('SharedTicketSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('affiche le contexte tournoi quand le ticket partagé appartient à un tournoi', async () => {
    (getSharedTicketDetail as jest.Mock).mockResolvedValueOnce({
      uuid: 'shared-ticket-1',
      mise: 10,
      gain: 30,
      status: 'CORRECT',
      league_summary: { id: 2, name: 'Ligue secondaire' },
      tournament_match_summary: {
        tournament_match_id: 14,
        tournament_id: 7,
        name: 'Tournoi Flash',
        stage_id: 3,
        type: 'semi_final',
      },
      match_choice_summaries: [],
    });

    render(
      <MemoryRouter
        initialEntries={['/ticket/shared/shared-ticket-1']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/ticket/shared/:ticketUuid" element={<SharedTicketSection />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Tournoi : Tournoi Flash')).toBeInTheDocument();
    });

    expect(getSharedTicketDetail).toHaveBeenCalledWith('shared-ticket-1', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
});



