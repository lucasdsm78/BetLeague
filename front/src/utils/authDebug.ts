/**
 * Debug utilities for authentication issues
 */

import enhancedAuthService from '../services/authService.enhanced';
import { useAuthStore } from '../store/authStore';

export const debugAuth = () => {
  console.log('🔍 === AUTH DEBUG INFORMATION ===');

  // Check enhanced auth service
  const currentToken = enhancedAuthService.getCurrentToken();
  const isAuthenticated = enhancedAuthService.isAuthenticated();
  const timeUntilExpiry = enhancedAuthService.getTimeUntilExpiry();

  console.log('📱 Enhanced Auth Service:');
  console.log('  - Has Token:', !!currentToken);
  console.log('  - Token Preview:', currentToken ? currentToken.substring(0, 50) + '...' : 'None');
  console.log('  - Is Authenticated:', isAuthenticated);
  console.log('  - Time Until Expiry:', timeUntilExpiry, 'ms');

  // Check auth store
  const store = useAuthStore.getState();
  console.log('🏪 Auth Store:');
  console.log('  - Is Authenticated:', store.isAuthenticated);
  console.log('  - User:', store.user);
  console.log('  - Error:', store.error);
  console.log('  - Is Loading:', store.isLoading);

  console.log('🍪 Session Strategy:');
  console.log('  - Access Token Storage:', currentToken ? 'memory-only' : 'none');
  console.log('  - Refresh Token Storage:', 'httpOnly cookie (non lisible côté JS)');

  // Test API call with current setup
  console.log('🌐 Testing API Call...');

  return {
    hasToken: !!currentToken,
    isAuthenticated,
    timeUntilExpiry,
    storeState: store,
    storageStrategy: {
      accessToken: currentToken ? 'memory-only' : 'none',
      refreshToken: 'httpOnly-cookie'
    }
  };
};

// Exposer la fonction de debug uniquement en mode debug
if (process.env.REACT_APP_DEBUG === 'true') {
  (window as any).debugAuth = debugAuth;
} else {
  delete (window as any).debugAuth;
}
