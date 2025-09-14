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
export {
  useToast,
  useErrorToast,
  useSuccessToast,
  useGlobalToast,
} from './useToast';

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
import { useErrorToast as useErrorToastHook } from './useToast';

export const useAppInitialization = () => {
  const { isAuthenticated, isLoading } = useAuthHook();
  const { showError } = useErrorToastHook();
  
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
  ToastType,
  CreateToastOptions,
  UseToastReturn,
  ToastConfig,
} from './useToast';

export type {
  UseDebounceOptions,
  UseDebounceReturn,
} from './useDebounce';