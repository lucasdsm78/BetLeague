import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import DeleteAccountCard from './DeleteAccountCard';

// Mock toast
jest.mock('../../toast/ToastProvider', () => ({
  useGlobalToast: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
    showWarning: jest.fn(),
  }),
}));

// Mock store user
jest.mock('../../store/authStore', () => ({
  useAuthStore: (sel: any) => sel({ user: { pseudo: 'Lucas' } }),
}));

// Mock mutation
jest.mock('../../hooks/queries/useProfileMutations', () => ({
  useDeleteMyAccountMutation: () => ({
    isPending: false,
    mutateAsync: jest.fn(async () => ({ message: 'ok' })),
  }),
}));

describe('DeleteAccountCard', () => {
  it('demande une phrase de confirmation avant le formulaire', () => {
    render(
      <MemoryRouter>
        <DeleteAccountCard isTwoFactorEnabled={false} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /supprimer mon compte/i }));

    expect(screen.getByLabelText(/confirmation/i)).toBeInTheDocument();
    expect(screen.getByText(/SUPPRIMER LUCAS/i)).toBeInTheDocument();
  });
});
