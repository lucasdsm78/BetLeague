/**
 * League Store - Zustand store for leagues state management
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import enhancedAuthService from '../services/authService.enhanced';
import type {
  League,
  LeagueDetails,
  Invitation,
  LeaguesState,
  LeagueCreateForm,
  PaginationState,
  FilterState
} from '../types';

interface LeagueActions {
  // League actions
  setLeagues: (leagues: League[]) => void;
  addLeague: (league: League) => void;
  updateLeague: (id: number, updates: Partial<League>) => void;
  removeLeague: (id: number) => void;
  setCurrentLeague: (league: LeagueDetails | null) => void;

  // Invitation actions
  setInvitations: (invitations: Invitation[]) => void;
  addInvitation: (invitation: Invitation) => void;
  updateInvitation: (id: number, updates: Partial<Invitation>) => void;
  removeInvitation: (id: number) => void;

  // UI state actions
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Filter and pagination
  setFilters: (filters: Partial<FilterState>) => void;
  setPagination: (pagination: Partial<PaginationState>) => void;
  resetFilters: () => void;

  // API actions
  fetchLeagues: () => Promise<void>;
  createLeague: (form: LeagueCreateForm) => Promise<boolean>;
  joinLeague: (leagueId: number) => Promise<boolean>;
  leaveLeague: (leagueId: number) => Promise<boolean>;
  fetchInvitations: () => Promise<void>;
  respondToInvitation: (invitationId: number, accept: boolean) => Promise<boolean>;

  // Getters
  getLeagueById: (id: number) => League | undefined;
  getUserLeagues: (userId: number) => League[];
  getActiveInvitations: () => Invitation[];
}

interface LeagueStore extends LeaguesState {
  filters: FilterState;
  pagination: PaginationState;
}

type LeagueStoreWithActions = LeagueStore & LeagueActions;

const buildAuthHeaders = (): Record<string, string> => {
  const token = enhancedAuthService.getCurrentToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const extractApiErrorMessage = (errorData: any, fallbackMessage: string): string => {
  const detail = errorData?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (detail && typeof detail === 'object' && typeof detail.message === 'string' && detail.message.trim()) return detail.message;
  if (typeof errorData?.message === 'string' && errorData.message.trim()) return errorData.message;
  return fallbackMessage;
};

// Initial state
const initialState: LeagueStore = {
  leagues: [],
  currentLeague: null,
  invitations: [],
  isLoading: false,
  error: null,
  filters: {
    search: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
  pagination: {
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
  },
};

export const useLeagueStore = create<LeagueStoreWithActions>()(
  immer((set, get) => ({
    ...initialState,

    // League actions
    setLeagues: (leagues: League[]) => {
      set((state) => {
        state.leagues = leagues;
        state.pagination.totalItems = leagues.length;
      });
    },

    addLeague: (league: League) => {
      set((state) => {
        state.leagues.unshift(league);
        state.pagination.totalItems += 1;
      });
    },

    updateLeague: (id: number, updates: Partial<League>) => {
      set((state) => {
        const index = state.leagues.findIndex(league => league.id === id);
        if (index !== -1) {
          state.leagues[index] = { ...state.leagues[index], ...updates };
        }

        // Update current league if it's the same
        if (state.currentLeague && state.currentLeague.id === id) {
          state.currentLeague = { ...state.currentLeague, ...updates };
        }
      });
    },

    removeLeague: (id: number) => {
      set((state) => {
        state.leagues = state.leagues.filter(league => league.id !== id);
        state.pagination.totalItems -= 1;

        // Clear current league if it's the same
        if (state.currentLeague && state.currentLeague.id === id) {
          state.currentLeague = null;
        }
      });
    },

    setCurrentLeague: (league: LeagueDetails | null) => {
      set((state) => {
        state.currentLeague = league;
      });
    },

    // Invitation actions
    setInvitations: (invitations: Invitation[]) => {
      set((state) => {
        state.invitations = invitations;
      });
    },

    addInvitation: (invitation: Invitation) => {
      set((state) => {
        state.invitations.unshift(invitation);
      });
    },

    updateInvitation: (id: number, updates: Partial<Invitation>) => {
      set((state) => {
        const index = state.invitations.findIndex(inv => inv.id === id);
        if (index !== -1) {
          state.invitations[index] = { ...state.invitations[index], ...updates };
        }
      });
    },

    removeInvitation: (id: number) => {
      set((state) => {
        state.invitations = state.invitations.filter(inv => inv.id !== id);
      });
    },

    // UI state actions
    setLoading: (isLoading: boolean) => {
      set((state) => {
        state.isLoading = isLoading;
        if (isLoading) {
          state.error = null;
        }
      });
    },

    setError: (error: string | null) => {
      set((state) => {
        state.error = error;
        state.isLoading = false;
      });
    },

    clearError: () => {
      set((state) => {
        state.error = null;
      });
    },

    // Filter and pagination
    setFilters: (filters: Partial<FilterState>) => {
      set((state) => {
        state.filters = { ...state.filters, ...filters };
        // Reset pagination when filters change
        state.pagination.currentPage = 1;
      });
    },

    setPagination: (pagination: Partial<PaginationState>) => {
      set((state) => {
        state.pagination = { ...state.pagination, ...pagination };
      });
    },

    resetFilters: () => {
      set((state) => {
        state.filters = {
          search: '',
          status: '',
          dateFrom: '',
          dateTo: '',
          sortBy: 'createdAt',
          sortOrder: 'desc',
        };
        state.pagination.currentPage = 1;
      });
    },

    // API actions
    fetchLeagues: async () => {
      const { setLoading, setError, setLeagues } = get();

      try {
        setLoading(true);
        const response = await fetch('/api/leagues', {
          headers: buildAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error('Impossible de charger les ligues.');
        }

        const data = await response.json();
        setLeagues(data.leagues || []);

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Impossible de charger les ligues.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },

    createLeague: async (form: LeagueCreateForm): Promise<boolean> => {
      const { setLoading, setError, addLeague } = get();

      try {
        setLoading(true);
        const payload = {
          name: form.name.trim(),
          max_players: form.maxMembers,
          is_private: form.type === 'private',
          is_free: form.entryFee === 0,
          nb_btl: form.entryFee > 0 ? form.entryFee : null,
          description: form.description?.trim(),
        };

        const response = await fetch('/api/league/create', {
          method: 'POST',
          headers: buildAuthHeaders(),
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(extractApiErrorMessage(errorData, 'Impossible de créer la ligue.'));
        }

        const data = await response.json();
        if (data.league) {
          addLeague(data.league);
        }

        return true;

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Impossible de créer la ligue.';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },

    joinLeague: async (leagueId: number): Promise<boolean> => {
      const { setLoading, setError, updateLeague } = get();

      try {
        setLoading(true);
        const response = await fetch(`/api/league/${leagueId}/join`, {
          method: 'POST',
          headers: buildAuthHeaders(),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(extractApiErrorMessage(errorData, 'Impossible de rejoindre la ligue.'));
        }

        const data = await response.json();
        if (data.league) {
          updateLeague(leagueId, data.league);
        }

        return true;

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Impossible de rejoindre la ligue.';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },

    leaveLeague: async (leagueId: number): Promise<boolean> => {
      const { setLoading, setError, updateLeague } = get();

      try {
        setLoading(true);
        const response = await fetch(`/api/league/${leagueId}/leave`, {
          method: 'POST',
          headers: buildAuthHeaders(),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(extractApiErrorMessage(errorData, 'Impossible de quitter la ligue.'));
        }

        const data = await response.json();
        if (data.league) {
          updateLeague(leagueId, data.league);
        }

        return true;

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Impossible de quitter la ligue.';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },

    fetchInvitations: async () => {
      const { setLoading, setError, setInvitations } = get();

      try {
        setLoading(true);
        const response = await fetch('/api/invitations?is_received=true', {
          headers: buildAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error('Impossible de charger les invitations.');
        }

        const data = await response.json();
        setInvitations(data.invitations || []);

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Impossible de charger les invitations.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },

    respondToInvitation: async (invitationId: number, accept: boolean): Promise<boolean> => {
      const { setLoading, setError, updateInvitation } = get();

      try {
        setLoading(true);
        const response = await fetch(
          `/api/league/invitation/${accept ? 'true' : 'false'}?invitation_id=${invitationId}`,
          {
            method: 'PUT',
            headers: buildAuthHeaders(),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(extractApiErrorMessage(errorData, "Impossible de répondre à l'invitation."));
        }

        // Update invitation status
        updateInvitation(invitationId, {
          status: accept ? 'accepted' : 'declined',
          respondedAt: new Date().toISOString(),
        });

        return true;

      } catch (error) {
        const message = error instanceof Error ? error.message : "Impossible de répondre à l'invitation.";
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },

    // Getters
    getLeagueById: (id: number) => {
      const state = get();
      return state.leagues.find(league => league.id === id);
    },

    getUserLeagues: (userId: number) => {
      const state = get();
      return state.leagues.filter(league =>
        league.createdBy === userId ||
        league.currentPlayers > 0 // Simplified check - should check participants
      );
    },

    getActiveInvitations: () => {
      const state = get();
      return state.invitations.filter(inv =>
        inv.status === 'pending' &&
        new Date(inv.expiresAt) > new Date()
      );
    },
  }))
);

// Selectors for performance optimization
export const useLeagues = () => useLeagueStore((state) => state.leagues);
export const useCurrentLeague = () => useLeagueStore((state) => state.currentLeague);
export const useInvitations = () => useLeagueStore((state) => state.invitations);
export const useLeagueLoading = () => useLeagueStore((state) => state.isLoading);
export const useLeagueError = () => useLeagueStore((state) => state.error);
export const useLeagueFilters = () => useLeagueStore((state) => state.filters);
export const useLeaguePagination = () => useLeagueStore((state) => state.pagination);

// Computed selectors
export const useActiveInvitations = () =>
  useLeagueStore((state) => state.getActiveInvitations());

export const useLeagueById = (id: number) =>
  useLeagueStore((state) => state.getLeagueById(id));

export const useUserLeagues = (userId: number) =>
  useLeagueStore((state) => state.getUserLeagues(userId));

export default useLeagueStore;
