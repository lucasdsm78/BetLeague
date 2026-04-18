import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import EditAccountModal from './EditAccountModal';

const mockMutateAsync = jest.fn(async () => ({
  token_auth: 'new-token',
  refresh_token: 'new-refresh',
  token_expiration: '2026-01-01T00:00:00Z',
}));

jest.mock('../../hooks/queries/useProfileMutations', () => ({
  useUpdateProfileMutation: () => ({
    isPending: false,
    mutateAsync: mockMutateAsync,
  }),
}));

jest.mock('../../toast/ToastProvider', () => ({
  useGlobalToast: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
    showWarning: jest.fn(),
    showInfo: jest.fn(),
  }),
}));

describe('EditAccountModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('affiche le champ mot de passe actuel et bloque la soumission quand l’email change', () => {
    render(
      <EditAccountModal
        pseudo="player"
        email="player@example.com"
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'new@example.com' } });

    expect(screen.getByLabelText(/mot de passe actuel/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDisabled();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('désactive le submit tant que le mot de passe actuel requis n’est pas saisi', () => {
    render(
      <EditAccountModal
        pseudo="player"
        email="player@example.com"
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'new@example.com' } });

    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDisabled();
  });

  it('affiche le champ code 2fa et bloque la soumission quand la 2fa est activée', () => {
    render(
      <EditAccountModal
        pseudo="player"
        email="player@example.com"
        isTwoFactorEnabled
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText(/pseudo/i), { target: { value: 'player-updated' } });

    expect(screen.getByLabelText(/code 2fa/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDisabled();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('désactive le submit tant que le code 2fa requis n’est pas complet', () => {
    render(
      <EditAccountModal
        pseudo="player"
        email="player@example.com"
        isTwoFactorEnabled
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText(/pseudo/i), { target: { value: 'player-updated' } });

    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDisabled();
  });

  it('envoie current_password et two_fa_code quand ils sont requis', async () => {
    render(
      <EditAccountModal
        pseudo="player"
        email="player@example.com"
        isTwoFactorEnabled
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'updated@example.com' } });
    fireEvent.change(screen.getByLabelText(/mot de passe actuel/i), { target: { value: 'currentpass123' } });
    fireEvent.change(screen.getByLabelText(/code 2fa/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());

    expect(mockMutateAsync).toHaveBeenCalledWith({
      email: 'updated@example.com',
      current_password: 'currentpass123',
      two_fa_code: '123456',
    });
  });
});



