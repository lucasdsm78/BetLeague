/**
 * Hooks Index - Export all custom hooks
 * Centralized hook management for BetLeague
 */

// Authentication hooks
export {
  useAuth,
  useAuthUser,
  useIsAuthenticated,
  useAuthError,
  useAuthLoading,
  usePermissions,
  useRoles,
  useSessionMonitor,
} from './useAuth';

// API hooks
export {
  useApi,
  useApiQuery,
  useApiMutation,
  apiCacheUtils,
} from './useApi';

// Form hooks
export {
  useFormValidation,
  ValidationRules,
  SanitizationUtils,
} from './useFormValidation';

// Toast hooks
export { useGlobalToast } from '../toast/ToastProvider';

// (Optionnel) si besoin interne/technique :
// export { useToast } from '../toast/useToast';

// Utility hooks
export {
  useDebounce,
  useAdvancedDebounce,
  useDebouncedCallback,
} from './useDebounce';

// Re-export legacy hooks (will be updated later)
export { default as useFormSecurity } from './useFormSecurity';

// Hook composition utilities
import { useAuth as useAuthHook } from './useAuth';
import { useGlobalToast } from '../toast/ToastProvider';

export const useAppInitialization = () => {
  const { isAuthenticated, isLoading } = useAuthHook();
  const { showError } = useGlobalToast();

  return {
    isAuthenticated,
    isLoading,
    showError,
  };
};

// Hook types for external use
export type {
  UseAuthReturn,
  UseAuthOptions,
} from './useAuth';

export type {
  UseApiState,
  UseApiOptions,
  UseApiReturn,
} from './useApi';

export type {
  FormState,
  UseFormValidationOptions,
  UseFormValidationReturn,
} from './useFormValidation';

export type {
  // pas de types toast exposés depuis hooks (API publique = toast/ToastProvider)
} from '../toast/useToast';

export type {
  UseDebounceOptions,
  UseDebounceReturn,
} from './useDebounce';
