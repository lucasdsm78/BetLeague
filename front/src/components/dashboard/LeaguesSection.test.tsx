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
const mockGetParticipatedLeaguesPage = jest.fn();
const mockClearApiCache = jest.fn();

let mockParticipatedLeaguesData: Array<any> = [];
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
  getParticipatedLeaguesPage: (...args: unknown[]) => mockGetParticipatedLeaguesPage(...args),
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
    if (tab === 'participatedLeagues') {
      return {
        data: mockParticipatedLeaguesData,
        isLoading: false,
        isFetching: false,
        refetch: jest.fn().mockResolvedValue({ data: mockParticipatedLeaguesData }),
      };
    }

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
  useLeagueCountQuery: (tab: string) => {
    if (tab === 'participatedLeagues') {
      return {
        data: mockParticipatedLeaguesData.length,
        isLoading: false,
        isFetching: false,
      };
    }

    if (tab === 'myLeagues') {
      return {
        data: mockCreatedLeaguesData.length,
        isLoading: false,
        isFetching: false,
      };
    }

    if (tab === 'availableLeagues') {
      return {
        data: mockAvailableLeaguesData.length,
        isLoading: false,
        isFetching: false,
      };
    }

    return {
      data: 0,
      isLoading: false,
      isFetching: false,
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
    mockParticipatedLeaguesData = [];
    mockCreatedLeaguesData = [];
    mockAvailableLeaguesData = [
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
    mockGetCreatedLeaguesPage.mockImplementation(async () => ({
      leagues: mockCreatedLeaguesData,
      page: 1,
      pageSize: 10,
      total: mockCreatedLeaguesData.length,
      totalPages: 1,
    }));
    mockGetParticipatedLeaguesPage.mockImplementation(async () => ({
      leagues: mockParticipatedLeaguesData,
      page: 1,
      pageSize: 10,
      total: mockParticipatedLeaguesData.length,
      totalPages: 1,
    }));
    mockMutateAsync.mockImplementation(async ({ leagueId }: { leagueId: number }) => {
      const joinedLeague = mockAvailableLeaguesData.find((league) => league.id === leagueId);
      if (joinedLeague) {
        mockParticipatedLeaguesData = [joinedLeague, ...mockParticipatedLeaguesData];
        mockAvailableLeaguesData = mockAvailableLeaguesData.filter((league) => league.id !== leagueId);
      }
      return { message: 'Ligue rejointe' };
    });
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

  it('affiche les compteurs participées et disponibles dès le chargement de la page', async () => {
    mockParticipatedLeaguesData = [
      {
        id: 31,
        name: 'Ligue déjà rejointe',
        is_free: true,
        max_players: 10,
        nb_players_remaining: 6,
        status: 'OPEN',
        current_total_pot: null,
      },
    ];

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

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ligues participées/i })).toHaveTextContent('Participées1');
      expect(screen.getByRole('button', { name: /ligues disponibles/i })).toHaveTextContent('Disponibles1');
    });
  });

  it('affiche immédiatement la ligue rejointe dans l’onglet Participées', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /rejoindre la ligue ligue publique/i }));

    await waitFor(() => {
      expect(screen.getByText('Ligue publique')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ligues participées/i })).toHaveClass('active');
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({ leagueId: 22 });
    expect(mockShowSuccess).toHaveBeenCalledWith('Ligue rejointe', 'Vous avez rejoint Ligue publique');
    expect(mockClearApiCache).toHaveBeenCalled();
    expect(mockGetParticipatedLeaguesPage).toHaveBeenCalledWith(1, 10);
  });
});






