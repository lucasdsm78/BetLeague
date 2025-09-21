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

  // Check localStorage
  console.log('💾 LocalStorage:');
  const authToken = localStorage.getItem('auth_token');
  const refreshToken = localStorage.getItem('refresh_token');
  console.log('  - Auth Token:', !!authToken ? authToken.substring(0, 50) + '...' : 'None');
  console.log('  - Refresh Token:', !!refreshToken ? refreshToken.substring(0, 50) + '...' : 'None');

  // Test API call with current setup
  console.log('🌐 Testing API Call...');

  return {
    hasToken: !!currentToken,
    isAuthenticated,
    timeUntilExpiry,
    storeState: store,
    localStorage: {
      authToken: !!authToken,
      refreshToken: !!refreshToken
    }
  };
};

// Call this function in the browser console after login
(window as any).debugAuth = debugAuth;