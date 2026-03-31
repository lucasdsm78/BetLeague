import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import TicketShareSheet from './TicketShareSheet';

const mockShareWinningTicket = jest.fn();
const mockShowSuccess = jest.fn();
const mockShowInfo = jest.fn();
const mockShowError = jest.fn();

jest.mock('../../utils/ticketShare', () => ({
  shareWinningTicket: (...args: unknown[]) => mockShareWinningTicket(...args),
}));

jest.mock('../../toast/ToastProvider', () => ({
  useGlobalToast: () => ({
    showSuccess: mockShowSuccess,
    showInfo: mockShowInfo,
    showError: mockShowError,
  }),
}));

describe('TicketShareSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('déclenche un partage Instagram story avec le ticket', async () => {
    const onClose = jest.fn();
    mockShareWinningTicket.mockResolvedValueOnce({
      method: 'native+clipboard',
      url: 'https://betleague.app/tickets/shared/ticket-uuid',
      message: 'message',
      network: 'instagram',
      variant: 'story',
    });

    render(
      <TicketShareSheet
        isOpen
        onClose={onClose}
        ticket={{
          uuid: 'ticket-uuid',
          gain: 42.5,
          leagueName: 'Ligue VIP',
          choices: [{ homeTeam: 'PSG', awayTeam: 'OM', choice: 'PSG' }],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /story instagram/i }));

    await waitFor(() => expect(mockShareWinningTicket).toHaveBeenCalledWith(expect.objectContaining({
      ticketUuid: 'ticket-uuid',
      network: 'instagram',
      variant: 'story',
    })));

    expect(mockShowInfo).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

