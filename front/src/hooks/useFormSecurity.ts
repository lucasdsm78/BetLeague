import { useState, useRef, useCallback, useEffect } from 'react';

export const useFormSecurity = (initialAttempts = 0, maxAttempts = 5) => {
    const [attemptCount, setAttemptCount] = useState(initialAttempts);
    const [isBlocked, setIsBlocked] = useState(false);
    const lastAttemptTime = useRef(0);
    const blockTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const checkRateLimit = useCallback(() => {
        const now = Date.now();
        if (now - lastAttemptTime.current < 1000) {
            return { allowed: false, reason: 'Veuillez patienter avant de réessayer.' };
        }
        lastAttemptTime.current = now;
        return { allowed: true };
    }, []);

    const incrementAttempts = useCallback(() => {
        setAttemptCount(prev => {
            const newCount = prev + 1;
            if (newCount >= maxAttempts) {
                setIsBlocked(true);
                blockTimeoutRef.current = setTimeout(() => {
                    setIsBlocked(false);
                    setAttemptCount(0);
                }, 300000); // 5 minutes de blocage
            }
            return newCount;
        });
    }, [maxAttempts]);

    const resetAttempts = useCallback(() => {
        setAttemptCount(0);
        setIsBlocked(false);
        if (blockTimeoutRef.current) {
            clearTimeout(blockTimeoutRef.current);
            blockTimeoutRef.current = null;
        }
    }, []);

    const sanitizeInput = useCallback((input: any, type: string = 'text') => {
        if (typeof input !== 'string') return '';
        
        switch (type) {
            case 'email':
                return input.toLowerCase().trim().replace(/[^\w@.-]/g, '');
            case 'username':
                return input.trim().replace(/[^a-zA-Z0-9_-]/g, '');
            case 'text':
            default:
                return input.trim();
        }
    }, []);

    const validateInput = useCallback((value: string, type: string, maxLength: number) => {
        if (!value) return { isValid: false, error: 'Ce champ est requis' };
        if (value.length > maxLength) return { isValid: false, error: 'Valeur trop longue' };
        
        switch (type) {
            case 'email':
                const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                return emailRegex.test(value) ? 
                    { isValid: true } : 
                    { isValid: false, error: 'Email invalide' };
            case 'username':
                const usernameRegex = /^[a-zA-Z0-9_-]+$/;
                return usernameRegex.test(value) && value.length >= 3 ? 
                    { isValid: true } : 
                    { isValid: false, error: 'Nom d\'utilisateur invalide' };
            default:
                return { isValid: true };
        }
    }, []);

    useEffect(() => {
        return () => {
            if (blockTimeoutRef.current) {
                clearTimeout(blockTimeoutRef.current);
            }
        };
    }, []);

    return {
        attemptCount,
        isBlocked,
        checkRateLimit,
        incrementAttempts,
        resetAttempts,
        sanitizeInput,
        validateInput
    };
};

export default useFormSecurity;