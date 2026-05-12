import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import DashboardLayout from './DashboardLayout';

const mockLogout = jest.fn();
const mockUpdateUser = jest.fn();
const mockHasPermission = jest.fn(() => true);
const mockShowError = jest.fn();

jest.mock('../hooks/useAuth.enhanced', () => ({
  useEnhancedAuth: () => ({
    user: {
      id: 7,
      email: 'lucas@example.com',
      pseudo: 'Lucas',
      username: 'Lucas',
      isTournamentSubscriber: false,
    },
    logout: mockLogout,
    isLoading: false,
    isAuthenticated: true,
  }),
}));

jest.mock('../hooks/queries/useProfileQuery', () => ({
  useProfileMeQuery: () => ({
    data: {
      commerce_availability: { shop_enabled: true },
      is_tournament_subscriber: false,
      tournament_creation_access: null,
    },
    isLoading: false,
  }),
}));

jest.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    updateUser: mockUpdateUser,
    hasPermission: mockHasPermission,
  }),
}));

jest.mock('../toast/ToastProvider', () => ({
  useGlobalToast: () => ({
    showError: mockShowError,
  }),
}));

jest.mock('./auth/LogoutModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./notifications/NotificationsHeaderButton', () => ({
  NotificationsHeaderButton: () => <button type="button">Notifications</button>,
}));

jest.mock('./legal/LegalLinks', () => ({
  __esModule: true,
  default: () => <div>Liens légaux</div>,
}));

describe('DashboardLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('affiche Profil dans la navigation rapide mobile', () => {
    render(
      <MemoryRouter initialEntries={['/matches']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DashboardLayout>
          <div>Contenu dashboard</div>
        </DashboardLayout>
      </MemoryRouter>
    );

    const bottomNav = screen.getByRole('navigation', { name: /navigation rapide/i });

    expect(within(bottomNav).getByRole('button', { name: /profil/i })).toBeInTheDocument();
    expect(within(bottomNav).getByRole('button', { name: /matchs/i })).toBeInTheDocument();
    expect(within(bottomNav).getByRole('button', { name: /ligues/i })).toBeInTheDocument();
    expect(within(bottomNav).getByRole('button', { name: /invitations/i })).toBeInTheDocument();
    expect(within(bottomNav).getByRole('button', { name: /tournois/i })).toBeInTheDocument();
    expect(within(bottomNav).getByRole('button', { name: /tickets/i })).toBeInTheDocument();
  });
});

