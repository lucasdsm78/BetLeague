import twoFactorService, { TwoFactorActionError } from './twoFactor';
import { ApiClientError } from './secureApiClient';
import http from './http';

jest.mock('./http', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

describe('twoFactorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mappe la vérification 2FA réussie', async () => {
    (http.post as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: { enabled: true, message: 'ok', attempts_remaining: 3 },
      status: 200,
      headers: {},
    });

    await expect(twoFactorService.verifyTwoFactor('123456')).resolves.toEqual({
      enabled: true,
      message: 'ok',
      attemptsRemaining: 3,
    });
  });

  it('propage Retry-After et attemptsRemaining dans une erreur métier 2FA', async () => {
    (http.post as jest.Mock).mockRejectedValueOnce(
      new ApiClientError('Rate limit dépassé', {
        status: 429,
        code: 'RATE_LIMITED',
        headers: { 'retry-after': '60' },
        details: { detail: { attempts_remaining: 0 } },
      })
    );

    await expect(twoFactorService.verifyTwoFactor('123456')).rejects.toEqual(
      expect.objectContaining<TwoFactorActionError>({
        name: 'TwoFactorActionError',
        message: 'Rate limit dépassé',
        status: 429,
        code: 'RATE_LIMITED',
        retryAfterSeconds: 60,
        attemptsRemaining: 0,
      })
    );
  });

  it('envoie le bon payload pour la désactivation 2FA', async () => {
    (http.post as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: { enabled: false, message: 'disabled', sessions_revoked: true, reauth_required: true },
      status: 200,
      headers: {},
    });

    await expect(
      twoFactorService.disableTwoFactor({ currentPassword: 'supersafe123', code: '123456' })
    ).resolves.toEqual({ enabled: false, message: 'disabled', sessionsRevoked: true, reauthRequired: true });

    expect(http.post).toHaveBeenCalledWith('/auth/user/disable-2fa', {
      current_password: 'supersafe123',
      code: '123456',
    });
  });
});
