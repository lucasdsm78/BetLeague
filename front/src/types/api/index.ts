export * from './common';
export * from './auth';
export * from './profile';
export * from './matches';

// Leagues: export explicite (évite les surprises de TS server)
export type {
  ApiLeagueSummary,
  ApiLeaguesPage,
  ApiLeagueCreateRequest,
  ApiLeagueMessageResponse,
  ApiInvitationReceived,
  ApiLeagueBalanceResponse,
  ApiLeagueBalancesBulkResponse,
  ApiParticipatedLeaguesResponse,
  ApiLeagueUpdateRequest,
  ApiLeagueUpdateResponse,
  ApiLeagueNameAvailabilityResponse,
  ApiLeagueLeaveResponse,
  ApiLeagueJoinResponse,
  ApiLeagueRankingRow,
} from './leagues';

export * from './users';
export * from './subscription';
export * from './packs';
export * from './invitations';

// Exports explicites pour éviter les collisions (ex: ApiLeagueSummary)
export type {
  ApiMatchSummary,
  ApiMatchChoiceSummary,
  ApiTicketReadModel,
  ApiTicketsInProgressResponse,
  ApiTicketsFinishedResponse,
  ApiTicketDetailResponse,
  ApiMatchChoiceCreate,
  ApiTicketCreateRequest,
  ApiTicketCreateResponse,
} from './tickets';

export * from './tournament';
export * from './passwordReset';
