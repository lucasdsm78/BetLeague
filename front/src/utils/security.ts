/**
 * Security Utilities - Advanced Frontend Security
 * Comprehensive security utilities for React components
 */

import React from 'react';

// Content Security Policy helpers
export const CSPUtils = {
  // Generate secure nonce for inline styles/scripts
  generateNonce: (): string => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)));
  },

  // Validate and sanitize URLs
  validateURL: (url: string): boolean => {
    try {
      const parsed = new URL(url);
      const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
      return allowedProtocols.includes(parsed.protocol);
    } catch {
      return false;
    }
  },

  // Check for XSS patterns
  containsXSS: (input: string): boolean => {
    const xssPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]+src[^>]*=[\s"']*javascript:/gi,
      /<object[\s\S]*?>[\s\S]*?<\/object>/gi,
      /<embed[\s\S]*?>/gi,
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }
};

// Input sanitization utilities
export const SanitizationUtils = {
  // HTML sanitization
  sanitizeHTML: (input: string): string => {
    // Create a temporary div element
    const temp = document.createElement('div');
    temp.textContent = input;
    return temp.innerHTML;
  },

  // SQL injection protection (for display purposes)
  sanitizeSQL: (input: string): string => {
    return input
      .replace(/'/g, '&#39;')
      .replace(/"/g, '&quot;')
      .replace(/;/g, '&#59;')
      .replace(/--/g, '&#45;&#45;');
  },

  // General input sanitization
  sanitizeInput: (input: string, type: 'text' | 'email' | 'url' | 'number' = 'text'): string => {
    if (typeof input !== 'string') return '';

    let sanitized = input.trim();

    // Remove NULL bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    switch (type) {
      case 'email':
        // Keep only valid email characters
        sanitized = sanitized.replace(/[^a-zA-Z0-9@._-]/g, '');
        break;
      case 'url':
        // Keep only valid URL characters
        sanitized = sanitized.replace(/[^a-zA-Z0-9:/?#[\]@!$&'()*+,;=._~-]/g, '');
        break;
      case 'number':
        // Keep only numbers and decimal point
        sanitized = sanitized.replace(/[^0-9.-]/g, '');
        break;
      default:
        // For text, remove dangerous HTML/script tags
        sanitized = sanitized
          .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
          .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
    }

    return sanitized;
  },

  // Path validation for routing security
  isValidPath: (path: string): boolean => {
    if (typeof path !== 'string' || !path) return false;

    // Check for valid path format
    const pathRegex = /^\/[a-zA-Z0-9/_-]*$/;
    if (!pathRegex.test(path)) return false;

    // Check for path traversal attempts
    if (path.includes('..') || path.includes('./') || path.includes('.\\')) {
      return false;
    }

    // Check for dangerous path patterns
    const dangerousPatterns = [
      /\/etc\//i,
      /\/proc\//i,
      /\/sys\//i,
      /\/root\//i,
      /\/home\//i,
      /\/var\//i,
      /\\system32\\/i,
      /\\windows\\/i
    ];

    return !dangerousPatterns.some(pattern => pattern.test(path));
  },

  // Remove dangerous characters
  removeDangerousChars: (input: string): string => {
    return input.replace(/[<>'"&]/g, '');
  },

  // Escape for safe HTML attribute values
  escapeAttribute: (input: string): string => {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  },

  // Email validation and sanitization
  sanitizeEmail: (email: string): string => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const cleaned = email.toLowerCase().trim();
    return emailRegex.test(cleaned) ? cleaned : '';
  },

  // Phone number sanitization
  sanitizePhone: (phone: string): string => {
    return phone.replace(/[^\d+\-\s\(\)]/g, '').trim();
  },

  // Remove control characters
  removeControlChars: (input: string): string => {
    return input.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  }
};

// Rate limiting utilities
export class ClientRateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxAttempts: number;

  constructor(maxAttempts: number = 5, windowMs: number = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);

    if (recentAttempts.length >= this.maxAttempts) {
      return false;
    }

    // Record this attempt
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);

    return true;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  getRemainingTime(key: string): number {
    const attempts = this.attempts.get(key) || [];
    if (attempts.length === 0) return 0;

    const oldestAttempt = Math.min(...attempts);
    return Math.max(0, this.windowMs - (Date.now() - oldestAttempt));
  }
}

// Session security utilities
export const SessionUtils = {
  // Generate secure session ID
  generateSessionId: (): string => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  },

  // Check if session is expired
  isSessionExpired: (expiryTime: number): boolean => {
    return Date.now() > expiryTime;
  },

  // Generate device fingerprint
  generateDeviceFingerprint: (): string => {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.platform,
      navigator.cookieEnabled ? '1' : '0'
    ];

    // Simple hash function
    let hash = 0;
    const str = components.join('|');
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  },

  // Secure storage with encryption simulation
  secureStore: {
    setItem: (key: string, value: string): void => {
      try {
        // In a real app, encrypt the value here
        const encrypted = btoa(value); // Simple encoding for demo
        sessionStorage.setItem(key, encrypted);
      } catch (error) {
        console.error('Failed to store secure item:', error);
      }
    },

    getItem: (key: string): string | null => {
      try {
        const encrypted = sessionStorage.getItem(key);
        if (!encrypted) return null;

        // In a real app, decrypt the value here
        return atob(encrypted); // Simple decoding for demo
      } catch (error) {
        console.error('Failed to retrieve secure item:', error);
        return null;
      }
    },

    removeItem: (key: string): void => {
      sessionStorage.removeItem(key);
    }
  }
};

// Form security utilities
export const FormSecurityUtils = {
  // Generate CSRF token
  generateCSRFToken: (): string => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)));
  },

  // Validate form submission timing (prevent automated attacks)
  validateSubmissionTiming: (formStartTime: number, minTime: number = 2000): boolean => {
    const submissionTime = Date.now() - formStartTime;
    return submissionTime >= minTime; // Must take at least 2 seconds
  },

  // Check for form field tampering
  validateFormStructure: (
    expectedFields: string[],
    actualFields: string[]
  ): boolean => {
    const expected = new Set(expectedFields.sort());
    const actual = new Set(actualFields.sort());

    if (expected.size !== actual.size) return false;

    const expectedArray = Array.from(expected);
    for (let i = 0; i < expectedArray.length; i++) {
      if (!actual.has(expectedArray[i])) return false;
    }

    return true;
  },

  // Honeypot field validation
  validateHoneypot: (honeypotValue: string): boolean => {
    return honeypotValue === '' || honeypotValue == null;
  }
};

// API security utilities
export const APISecurityUtils = {
  // Add security headers to requests
  addSecurityHeaders: (headers: Record<string, string> = {}): Record<string, string> => {
    return {
      ...headers,
      'X-Requested-With': 'XMLHttpRequest',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    };
  },

  // Validate API response structure
  validateResponseStructure: <T>(
    response: unknown,
    expectedKeys: (keyof T)[]
  ): response is T => {
    if (typeof response !== 'object' || response === null) {
      return false;
    }

    const responseObj = response as Record<string, unknown>;

    return expectedKeys.every(key => {
      const keyStr = String(key);
      return keyStr in responseObj && responseObj[keyStr] !== undefined;
    });
  },

  // Check response size to prevent DoS
  validateResponseSize: (response: string, maxSize: number = 10 * 1024 * 1024): boolean => {
    return new Blob([response]).size <= maxSize;
  }
};

// Component security HOC
export const withSecurity = <P extends object>(
  Component: React.ComponentType<P>,
  options: {
    rateLimitKey?: string;
    maxAttempts?: number;
    requireCSRF?: boolean;
  } = {}
) => {
  const rateLimiter = new ClientRateLimiter(options.maxAttempts);

  return React.memo((props: P) => {
    const [csrfToken] = React.useState(() =>
      options.requireCSRF ? FormSecurityUtils.generateCSRFToken() : null
    );

    // Rate limiting check
    React.useEffect(() => {
      if (options.rateLimitKey) {
        if (!rateLimiter.isAllowed(options.rateLimitKey)) {
          console.warn('Rate limit exceeded for component');
          return;
        }
      }
    }, []);

    const securityProps = {
      ...props,
      ...(csrfToken && { csrfToken })
    };

    return React.createElement(Component, securityProps);
  });
};

// Export types for TypeScript
export interface SecurityConfig {
  enableXSSProtection: boolean;
  enableCSRFProtection: boolean;
  enableRateLimiting: boolean;
  maxRequestsPerMinute: number;
  sessionTimeout: number;
  enableDeviceFingerprinting: boolean;
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  enableXSSProtection: true,
  enableCSRFProtection: true,
  enableRateLimiting: true,
  maxRequestsPerMinute: 100,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  enableDeviceFingerprinting: true,
};

export default {
  CSPUtils,
  SanitizationUtils,
  ClientRateLimiter,
  SessionUtils,
  FormSecurityUtils,
  APISecurityUtils,
  withSecurity,
  DEFAULT_SECURITY_CONFIG
};
