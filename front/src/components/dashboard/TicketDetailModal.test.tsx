import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import TicketDetailModal from './TicketDetailModal';

const mockRefetch = jest.fn();

jest.mock('hooks/useTicketDetail', () => ({
  useTicketDetail: () => ({
    ticket: {
      id: 42,
      display_number: 3,
      uuid: 'ticket-uuid-42',
      mise: 10,
      gain: 25,
      status: 'pending',
      league_summary: { id: 7, name: 'Ligue VIP' },
      tournament_match_summary: null,
      match_choice_summaries: [],
    },
    loading: false,
    error: null,
    refetch: mockRefetch,
    lastUpdated: null,
  }),
}));

jest.mock('./TicketShareSheet', () => ({
  __esModule: true,
  default: () => null,
}));

describe('TicketDetailModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('affiche le numéro ordinal du ticket sans exposer son uuid', () => {
    const onAskDelete = jest.fn();

    render(
      <TicketDetailModal
        isOpen
        onClose={jest.fn()}
        ticketId={42}
        onAskDelete={onAskDelete}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Ticket #3' })).toBeInTheDocument();
    expect(screen.queryByText(/uuid:/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /supprimer le ticket/i }));

    expect(onAskDelete).toHaveBeenCalledWith({ id: 42, display_number: 3 });
  });
});

