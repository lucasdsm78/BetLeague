import http from '../http';
import { ApiClientError } from '../secureApiClient';
import { createTournament, getTournamentCreationAccess, getUserTournamentMatches, leaveTournament, TournamentCreationError } from './tournament';

jest.mock('../http', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('tournament api service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mappe le quota mensuel atteint vers une erreur métier exploitable', async () => {
    (http.post as jest.Mock).mockRejectedValueOnce(
      new ApiClientError('quota atteint', {
        status: 402,
        code: 'TOURNAMENT_MONTHLY_FREE_CREATION_LIMIT_REACHED',
        details: {
          detail: {
            message: 'quota atteint',
            monthly_free_tournaments_limit: 2,
            monthly_free_tournaments_used: 2,
            monthly_free_tournaments_remaining: 0,
            can_create_tournament: false,
            requires_tournament_subscription: true,
          },
        },
      })
    );

    await expect(
      createTournament({ name: 'Tournoi test', is_private: false, max_players: 16 })
    ).rejects.toEqual(
      expect.objectContaining({
        name: 'TournamentCreationError',
        message: expect.any(String),
        status: 402,
        code: 'TOURNAMENT_MONTHLY_FREE_CREATION_LIMIT_REACHED',
        requiresSubscription: true,
        quota: expect.objectContaining({
          monthly_free_tournaments_limit: 2,
          monthly_free_tournaments_used: 2,
          monthly_free_tournaments_remaining: 0,
          can_create_tournament: false,
          requires_tournament_subscription: true,
        }),
      })
    );
  });

  it('retourne le statut de quota de création tournoi', async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        monthly_free_tournaments_limit: 2,
        monthly_free_tournaments_used: 1,
        monthly_free_tournaments_remaining: 1,
        has_active_subscription: false,
        can_create_tournament: true,
        requires_tournament_subscription: false,
      },
      status: 200,
      headers: {},
    });

    await expect(getTournamentCreationAccess()).resolves.toEqual({
      monthly_free_tournaments_limit: 2,
      monthly_free_tournaments_used: 1,
      monthly_free_tournaments_remaining: 1,
      has_active_subscription: false,
      can_create_tournament: true,
      requires_tournament_subscription: false,
    });
  });

  it('charge les options de matchs tournoi via le endpoint agrégé', async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        matches: [
          {
            id: 11,
            tournament_id: 2,
            tournament_name: 'Knockout',
            tournament_uuid: 'uuid-2',
            stage_type: 'semi_final',
            stage_label: 'Demi-finale',
            player1_name: 'Lucas',
            player2_name: 'Emma',
            start_date: 100,
            end_date: 200,
            display_label: 'Knockout - Demi-finale - Lucas vs Emma',
          },
        ],
      },
      status: 200,
      headers: {},
    });

    await expect(getUserTournamentMatches()).resolves.toEqual([
      {
        id: 11,
        tournament_id: 2,
        tournament_name: 'Knockout',
        tournament_uuid: 'uuid-2',
        stage_type: 'semi_final',
        stage_label: 'Demi-finale',
        player1_name: 'Lucas',
        player2_name: 'Emma',
        start_date: 100,
        end_date: 200,
        display_label: 'Knockout - Demi-finale - Lucas vs Emma',
      },
    ]);

    expect(http.get).toHaveBeenCalledWith('/tournaments/my/match-options');
  });

  it('mappe une tentative de départ interdite vers le message backend', async () => {
    (http.delete as jest.Mock).mockRejectedValueOnce(
      new ApiClientError('forbidden', {
        status: 403,
        details: {
          detail: 'Le créateur du tournoi ne peut pas quitter son propre tournoi',
        },
      })
    );

    await expect(leaveTournament(12)).rejects.toThrow('Le créateur du tournoi ne peut pas quitter son propre tournoi');
  });

  it('mappe un tournoi déjà démarré vers le message backend', async () => {
    (http.delete as jest.Mock).mockRejectedValueOnce(
      new ApiClientError('conflict', {
        status: 409,
        details: {
          detail: 'Le tournoi a déjà commencé',
        },
      })
    );

    await expect(leaveTournament(12)).rejects.toThrow('Le tournoi a déjà commencé');
  });
});

