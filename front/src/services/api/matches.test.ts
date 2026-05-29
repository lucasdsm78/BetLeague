import http from '../http';
import { getMatchesPage } from './matches';

jest.mock('../http', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe('matches api service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('construit une requête paginée sans filtre de ligue', async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: { matches: [], page: 1, page_size: 20, total: 0, total_pages: 0 },
      status: 200,
      headers: {},
    });

    await expect(getMatchesPage({ page: 1, pageSize: 20 })).resolves.toEqual({
      matches: [],
      page: 1,
      page_size: 20,
      total: 0,
      total_pages: 0,
    });

    expect(http.get).toHaveBeenCalledWith('/matches?page=1&page_size=20');
  });

  it('ajoute league_id à la requête pour cibler la Coupe du monde 2026', async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: { matches: [], page: 1, page_size: 20, total: 0, total_pages: 0 },
      status: 200,
      headers: {},
    });

    await getMatchesPage({ page: 1, pageSize: 20, leagueId: 1 });

    expect(http.get).toHaveBeenCalledWith('/matches?page=1&page_size=20&league_id=1');
  });
});

