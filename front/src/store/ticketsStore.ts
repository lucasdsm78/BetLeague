/**
 * ticketsStore - tiny event store to trigger ticket list refreshes.
 *
 * Why: when a ticket is created in MatchesSection (or elsewhere), TicketsSection
 * might already be mounted (route transitions, keep-alive layouts, etc.).
 * We expose a monotonic counter that consumers can depend on to refetch.
 */

import { create } from 'zustand';

interface TicketsRefreshState {
  refreshSeq: number;
  bumpRefresh: () => void;
}

export const useTicketsRefreshStore = create<TicketsRefreshState>((set) => ({
  refreshSeq: 0,
  bumpRefresh: () => set((s) => ({ refreshSeq: s.refreshSeq + 1 })),
}));

