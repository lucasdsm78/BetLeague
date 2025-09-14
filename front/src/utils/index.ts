/**
 * Utils Index - Centralized utility exports
 * All utility functions for the BetLeague application
 */

// Security utilities
export {
  CSPUtils,
  SanitizationUtils,
  ClientRateLimiter,
  SessionUtils,
  FormSecurityUtils,
  APISecurityUtils,
  withSecurity,
  DEFAULT_SECURITY_CONFIG
} from './security';

export { default as SecurityUtils } from './security';


// Re-export existing security utils if they exist
export { default as security } from './security.js';

// Common utility functions
export const CommonUtils = {
  // Format currency
  formatCurrency: (amount: number, currency: string = 'BTL'): string => {
    return `${amount.toLocaleString()} ${currency}`;
  },

  // Format date
  formatDate: (date: string | Date): string => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // Truncate text
  truncateText: (text: string, maxLength: number = 50): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  // Generate unique ID
  generateId: (): string => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  },

  // Deep clone object
  deepClone: <T>(obj: T): T => {
    return JSON.parse(JSON.stringify(obj));
  },

  // Debounce function
  debounce: <T extends (...args: any[]) => void>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  // Throttle function
  throttle: <T extends (...args: any[]) => void>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // Check if object is empty
  isEmpty: (obj: any): boolean => {
    if (obj == null) return true;
    if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
    return Object.keys(obj).length === 0;
  },

  // Get nested object property safely
  get: (obj: any, path: string, defaultValue: any = undefined): any => {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result == null) return defaultValue;
      result = result[key];
    }
    
    return result !== undefined ? result : defaultValue;
  }
};

// Validation utilities
export const ValidationUtils = {
  // Email validation
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Password strength validation
  isStrongPassword: (password: string): boolean => {
    const minLength = 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*]/.test(password);
    
    return password.length >= minLength && hasUpper && hasLower && hasNumber && hasSpecial;
  },

  // Username validation
  isValidUsername: (username: string): boolean => {
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    return usernameRegex.test(username);
  },

  // URL validation
  isValidUrl: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  // Phone number validation (French format)
  isValidPhone: (phone: string): boolean => {
    const phoneRegex = /^(?:\+33|0)[1-9](?:[0-9]{8})$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }
};

// Local storage utilities
export const StorageUtils = {
  // Set item with expiry
  setWithExpiry: (key: string, value: any, ttl: number): void => {
    const now = new Date();
    const item = {
      value: value,
      expiry: now.getTime() + ttl,
    };
    localStorage.setItem(key, JSON.stringify(item));
  },

  // Get item with expiry check
  getWithExpiry: (key: string): any => {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;

    try {
      const item = JSON.parse(itemStr);
      const now = new Date();
      
      if (now.getTime() > item.expiry) {
        localStorage.removeItem(key);
        return null;
      }
      
      return item.value;
    } catch {
      localStorage.removeItem(key);
      return null;
    }
  },

  // Clear expired items
  clearExpired: (): void => {
    const now = new Date().getTime();
    
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      try {
        const itemStr = localStorage.getItem(key);
        if (!itemStr) continue;
        
        const item = JSON.parse(itemStr);
        if (item.expiry && now > item.expiry) {
          localStorage.removeItem(key);
        }
      } catch {
        // Invalid JSON, remove item
        localStorage.removeItem(key);
      }
    }
  }
};

// Error handling utilities
export const ErrorUtils = {
  // Log error with context
  logError: (error: Error, context?: any): void => {
    console.error('Application Error:', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  },

  // Create user-friendly error message
  getUserFriendlyMessage: (error: any): string => {
    if (typeof error === 'string') return error;
    
    if (error?.message) {
      // Common error patterns
      if (error.message.includes('fetch')) {
        return 'Problème de connexion réseau';
      }
      if (error.message.includes('timeout')) {
        return 'Délai d\'attente dépassé';
      }
      if (error.message.includes('unauthorized')) {
        return 'Session expirée, veuillez vous reconnecter';
      }
      
      return error.message;
    }
    
    return 'Une erreur inattendue s\'est produite';
  },

  // Handle async errors
  handleAsyncError: (promise: Promise<any>, fallbackValue?: any): Promise<any> => {
    return promise.catch(error => {
      ErrorUtils.logError(error);
      return fallbackValue;
    });
  }
};

// Import default exports
import SecurityUtils from './security';

// Export all utilities as default
export default {
  CommonUtils,
  ValidationUtils,
  StorageUtils,
  ErrorUtils,
  SecurityUtils,
};