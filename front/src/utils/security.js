// Security utilities for form protection and data sanitization

export const sanitizeInput = (input, type = 'text') => {
    if (typeof input !== 'string') return '';
    
    // Remove potential XSS vectors
    const sanitized = input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/data:/gi, '');
    
    switch (type) {
        case 'email':
            return sanitized.toLowerCase().trim().replace(/[^\w@.-]/g, '');
        case 'username':
            return sanitized.trim().replace(/[^a-zA-Z0-9_-]/g, '');
        case 'password':
            return sanitized; // Keep original for password
        case 'text':
        default:
            return sanitized.trim();
    }
};

export const validatePassword = (password) => {
    const criteria = {
        minLength: password.length >= 8,
        hasUpper: /[A-Z]/.test(password),
        hasLower: /[a-z]/.test(password),
        hasNumber: /\d/.test(password),
        hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    
    const score = Object.values(criteria).filter(Boolean).length;
    
    return {
        isValid: score >= 3,
        score,
        criteria,
        strength: score < 2 ? 'weak' : 
                 score < 4 ? 'medium' : 'strong'
    };
};

export const generateCSRFToken = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

export const rateLimit = (() => {
    const attempts = new Map();
    
    return (key, maxAttempts = 5, windowMs = 300000) => {
        const now = Date.now();
        const userAttempts = attempts.get(key) || { count: 0, resetTime: now + windowMs };
        
        if (now > userAttempts.resetTime) {
            userAttempts.count = 0;
            userAttempts.resetTime = now + windowMs;
        }
        
        userAttempts.count++;
        attempts.set(key, userAttempts);
        
        return {
            allowed: userAttempts.count <= maxAttempts,
            attemptsLeft: Math.max(0, maxAttempts - userAttempts.count),
            resetTime: userAttempts.resetTime
        };
    };
})();

export const createSecureHeaders = (includeCSRF = false) => {
    const headers = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    };
    
    if (includeCSRF) {
        headers['X-CSRF-Token'] = generateCSRFToken();
    }
    
    return headers;
};

export const detectBotBehavior = (() => {
    const interactions = [];
    
    return (event) => {
        const now = Date.now();
        interactions.push(now);
        
        // Keep only last 10 interactions
        if (interactions.length > 10) {
            interactions.shift();
        }
        
        // Check for suspiciously fast interactions (less than 100ms apart)
        const rapidInteractions = interactions.filter((time, index) => {
            if (index === 0) return false;
            return time - interactions[index - 1] < 100;
        }).length;
        
        return rapidInteractions >= 3;
    };
})();

export const secureStorage = {
    set: (key, value, expirationMinutes = 60) => {
        try {
            const expirationTime = Date.now() + (expirationMinutes * 60 * 1000);
            const item = {
                value: btoa(JSON.stringify(value)), // Base64 encode
                expiration: expirationTime
            };
            localStorage.setItem(key, JSON.stringify(item));
        } catch (error) {
            console.error('Storage error:', error);
        }
    },
    
    get: (key) => {
        try {
            const item = localStorage.getItem(key);
            if (!item) return null;
            
            const parsed = JSON.parse(item);
            if (Date.now() > parsed.expiration) {
                localStorage.removeItem(key);
                return null;
            }
            
            return JSON.parse(atob(parsed.value));
        } catch (error) {
            console.error('Storage error:', error);
            return null;
        }
    },
    
    remove: (key) => {
        localStorage.removeItem(key);
    }
};

export default {
    sanitizeInput,
    validatePassword,
    generateCSRFToken,
    rateLimit,
    createSecureHeaders,
    detectBotBehavior,
    secureStorage
};