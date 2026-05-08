import { render, screen } from '@testing-library/react';
import { NotificationsPanel } from './NotificationsPanel';
import { useNotificationsStore } from '../../store/notificationsStore';

jest.mock('../../store/notificationsStore', () => ({
  useNotificationsStore: jest.fn(),
}));

const mockedUseNotificationsStore = useNotificationsStore as jest.MockedFunction<typeof useNotificationsStore>;

function mockStoreState() {
  const state = {
    items: [
      {
        id: 1,
        type: 'league_overtaken',
        title: 'Classement mis à jour',
        message: 'Lucas est passé devant toi.',
        created_at: Date.now() - 1_000,
        read_at: null,
      },
    ],
    isLoading: false,
    nextCursor: null,
    unreadCount: 1,
    loadMore: jest.fn(async () => undefined),
    markRead: jest.fn(async () => undefined),
    markAllRead: jest.fn(async () => undefined),
    deleteOne: jest.fn(async () => undefined),
  };

  mockedUseNotificationsStore.mockImplementation((selector: any) => selector(state));
}

describe('NotificationsPanel', () => {
  beforeEach(() => {
    mockStoreState();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders league_overtaken notifications', () => {
    render(<NotificationsPanel />);

    expect(screen.getByText('Classement mis à jour')).toBeInTheDocument();
    expect(screen.getByText('Lucas est passé devant toi.')).toBeInTheDocument();
    expect(screen.getByText('1 non lue')).toBeInTheDocument();
  });
});

