import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import ChangePasswordModal from './ChangePasswordModal';

const mockMutateAsync = jest.fn(async () => ({ message: 'ok', reauth_required: true }));

jest.mock('../../hooks/queries/useProfileMutations', () => ({
  useChangeMyPasswordMutation: () => ({
    isPending: false,
    mutateAsync: mockMutateAsync,
  }),
}));

jest.mock('../../toast/ToastProvider', () => ({
  useGlobalToast: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
    showWarning: jest.fn(),
  }),
}));

describe('ChangePasswordModal', () => {
  beforeEach(() => {
    mockMutateAsync.mockClear();
  });

  it('affiche un champ 2FA si activée', () => {
    render(<ChangePasswordModal isTwoFactorEnabled onClose={() => {}} />);
    expect(screen.getByLabelText(/code 2fa/i)).toBeInTheDocument();
  });

  it('n’affiche pas le champ 2FA si désactivée', () => {
    render(<ChangePasswordModal isTwoFactorEnabled={false} onClose={() => {}} />);
    expect(screen.queryByLabelText(/code 2fa/i)).toBeNull();
  });

  it('désactive le submit tant que les champs ne sont pas valides', () => {
    render(<ChangePasswordModal isTwoFactorEnabled={false} onClose={() => {}} />);

    const submit = screen.getByRole('button', { name: /mettre à jour/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/mot de passe actuel/i), { target: { value: 'aaaaaaaa' } });
    fireEvent.change(screen.getByLabelText(/nouveau mot de passe/i), { target: { value: 'bbbbbbbb' } });
    fireEvent.change(screen.getByLabelText(/confirmer/i), { target: { value: 'bbbbbbbb' } });

    expect(submit).not.toBeDisabled();
  });

  it('appelle mutateAsync avec le payload attendu', async () => {
    const { container } = render(<ChangePasswordModal isTwoFactorEnabled onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText(/mot de passe actuel/i), { target: { value: 'oldpassword' } });
    fireEvent.change(screen.getByLabelText(/nouveau mot de passe/i), { target: { value: 'newpassword' } });
    fireEvent.change(screen.getByLabelText(/confirmer/i), { target: { value: 'newpassword' } });
    fireEvent.change(screen.getByLabelText(/code 2fa/i), { target: { value: '123456' } });

    const form = container.querySelector('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());

    expect(mockMutateAsync).toHaveBeenCalledWith({
      current_password: 'oldpassword',
      new_password: 'newpassword',
      two_fa_code: '123456',
    });
  });
});
