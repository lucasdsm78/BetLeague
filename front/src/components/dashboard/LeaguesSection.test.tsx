import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import LeaguesSection from './LeaguesSection';

const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
const mockRefetchProfile = jest.fn().mockResolvedValue(undefined);
const mockMutateAsync = jest.fn();
const mockGetCreatedLeaguesPage = jest.fn();
const mockClearApiCache = jest.fn();

let mockCreatedLeaguesData: Array<any> = [];
let mockAvailableLeaguesData: Array<any> = [
  {
    id: 22,
    name: 'Ligue publique',
    is_free: true,
    max_players: 10,
    nb_players_remaining: 8,
    status: 'OPEN',
    current_total_pot: null,
  },
];

jest.mock('../../services/secureApiClient', () => ({
  __esModule: true,
  default: {
    clearCache: () => mockClearApiCache(),
  },
}));

jest.mock('../../services/api/leagues', () => ({
  getLeagueDetails: jest.fn(),
  getCreatedLeaguesPage: (...args: unknown[]) => mockGetCreatedLeaguesPage(...args),
}));

jest.mock('../../hooks/queries/useProfileQuery', () => ({
  useProfileMeQuery: () => ({
    data: { nb_btl: 120 },
    refetch: mockRefetchProfile,
  }),
}));

jest.mock('../../hooks/useLeagueBalances', () => ({
  useLeagueBalances: () => ({
    getBalance: () => null,
    isBalanceLoading: () => false,
  }),
}));

jest.mock('../../hooks/queries/useLeaguesQueries', () => ({
  useLeaguesListQuery: (tab: string) => {
    if (tab === 'myLeagues') {
      return {
        data: mockCreatedLeaguesData,
        isLoading: false,
        isFetching: false,
        refetch: jest.fn().mockResolvedValue({ data: mockCreatedLeaguesData }),
      };
    }

    if (tab === 'availableLeagues') {
      return {
        data: mockAvailableLeaguesData,
        isLoading: false,
        isFetching: false,
        refetch: jest.fn().mockResolvedValue({ data: mockAvailableLeaguesData }),
      };
    }

    return {
      data: [],
      isLoading: false,
      isFetching: false,
      refetch: jest.fn().mockResolvedValue({ data: [] }),
    };
  },
  useJoinLeagueMutation: () => ({
    mutateAsync: (...args: unknown[]) => mockMutateAsync(...args),
  }),
}));

jest.mock('../../toast/ToastProvider', () => ({
  useGlobalToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}));

jest.mock('../league/CreateLeagueForm', () => ({
  __esModule: true,
  default: ({ isOpen, onSuccess }: { isOpen: boolean; onSuccess: (league: unknown, message: string) => void }) => {
    if (!isOpen) return null;
    return (
      <button
        type="button"
        onClick={() => {
          mockCreatedLeaguesData = [
            {
              id: 101,
              name: 'Ma nouvelle ligue',
              is_free: true,
              max_players: 10,
              nb_players_remaining: 9,
              status: 'OPEN',
              current_total_pot: null,
            },
          ];
          onSuccess({ message: 'Ligue créée avec succès !' }, 'Ligue créée avec succès !');
        }}
      >
        Simuler création réussie
      </button>
    );
  },
}));

jest.mock('../league/LeagueDetailsModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../league/InviteUserModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../league/LeagueRankingModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../league/LeaveLeagueModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../league/EditLeagueModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../InsufficientBTLModal', () => ({ __esModule: true, default: () => null }));

describe('LeaguesSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatedLeaguesData = [];
    mockGetCreatedLeaguesPage.mockImplementation(async () => ({
      leagues: mockCreatedLeaguesData,
      page: 1,
      pageSize: 10,
      total: mockCreatedLeaguesData.length,
      totalPages: 1,
    }));
  });

  it('affiche immédiatement la ligue nouvellement créée dans l’onglet Créées', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <LeaguesSection />
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /ligues disponibles/i }));
    fireEvent.click(screen.getByRole('button', { name: /créer une ligue/i }));
    fireEvent.click(screen.getByRole('button', { name: /simuler création réussie/i }));

    await waitFor(() => {
      expect(screen.getByText('Ma nouvelle ligue')).toBeInTheDocument();
    });

    expect(mockShowSuccess).toHaveBeenCalledWith('Ligue créée', 'Ligue créée avec succès !');
        expect(mockClearApiCache).toHaveBeenCalled();
    expect(mockGetCreatedLeaguesPage).toHaveBeenCalledWith(1, 10);
  });
});




