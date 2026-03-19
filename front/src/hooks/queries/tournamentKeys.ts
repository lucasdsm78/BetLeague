export const tournamentKeys = {
  all: ['tournaments'] as const,
  availableList: [...(['tournaments'] as const), 'available'] as const,
  myList: [...(['tournaments'] as const), 'my'] as const,
  myCreatedList: [...(['tournaments'] as const), 'my-created'] as const,
  finishedList: [...(['tournaments'] as const), 'finished'] as const,
  creationAccess: [...(['tournaments'] as const), 'creation-access'] as const,
  available: (page: number, pageSize: number) => [...tournamentKeys.availableList, page, pageSize] as const,
  my: (page: number, pageSize: number) => [...tournamentKeys.myList, page, pageSize] as const,
  myCreated: (page: number, pageSize: number) => [...tournamentKeys.myCreatedList, page, pageSize] as const,
  finished: (page: number, pageSize: number) => [...tournamentKeys.finishedList, page, pageSize] as const,
  stages: (tournamentId: number) => [...tournamentKeys.all, 'stages', tournamentId] as const,
  stageMatches: (tournamentId: number, stageType: string) => [...tournamentKeys.all, 'stage_matches', tournamentId, stageType] as const,
};
