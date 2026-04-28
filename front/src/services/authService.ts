import enhancedAuthService, { AuthError } from './authService.enhanced';
import type { LoginForm, RegisterForm } from '../types';
import type { ApiLoginResponse as LoginResponse, ApiRegisterResponse as RegisterResponse } from '../types/api/auth';

class AuthService {
  async login(credentials: LoginForm): Promise<LoginResponse> {
    const { user, token } = await enhancedAuthService.login(credentials);
    return {
      success: true,
      status: 200,
      headers: {},
      data: {
        token_auth: token,
        uuid: user.id || '',
        token_expiration: enhancedAuthService.getTokenExpiryTime()
          ? new Date(enhancedAuthService.getTokenExpiryTime()!).toISOString()
          : undefined,
        two_factor_enabled: user.twoFactorEnabled,
      },
    } as LoginResponse;
  }

  async register(credentials: RegisterForm): Promise<RegisterResponse> {
    const response = await enhancedAuthService.register(credentials);
    return {
      success: true,
      status: 202,
      headers: {},
      data: {
        message: response.message || "Si l'inscription est possible, vous pouvez maintenant vous connecter.",
      },
    } as RegisterResponse;
  }

  async refreshToken() {
    const ok = await enhancedAuthService.forceRefresh();
    if (!ok) {
      throw new AuthError('Actualisation du token échouée', 401, 'REFRESH_FAILED');
    }
    const token = enhancedAuthService.getCurrentToken();
    if (!token) {
      throw new AuthError('Token manquant après refresh', 401, 'REFRESH_FAILED');
    }
    return {
      token_auth: token,
      token_expiration: enhancedAuthService.getTokenExpiryTime()
        ? new Date(enhancedAuthService.getTokenExpiryTime()!).toISOString()
        : undefined,
    };
  }

  async logout() {
    await enhancedAuthService.logout();
  }

  isAuthenticated() {
    return enhancedAuthService.isAuthenticated();
  }

  getCurrentToken() {
    return enhancedAuthService.getCurrentToken();
  }

  checkPasswordStrength(password: string) {
    const feedback: string[] = [];
    let score = 0;
    if (password.length >= 8) score++; else feedback.push('Au moins 8 caractères');
    if (/[a-z]/.test(password)) score++; else feedback.push('Au moins une minuscule');
    if (/[A-Z]/.test(password)) score++; else feedback.push('Au moins une majuscule');
    if (/\d/.test(password)) score++; else feedback.push('Au moins un chiffre');
    if (/[^a-zA-Z\d]/.test(password)) score++; else feedback.push('Au moins un caractère spécial');
    return { score, feedback, isStrong: score >= 4 };
  }

  async validateToken() {
    return enhancedAuthService.validateToken();
  }
}

export const authService = new AuthService();
export default authService;
