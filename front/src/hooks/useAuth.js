import { useState, useEffect, useCallback } from 'react';
import authService, { AuthError } from '../services/authService';

export const useAuth = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Vérification initiale du token au chargement
    useEffect(() => {
        const initAuth = async () => {
            const token = authService.getToken();
            if (!token) {
                setIsLoading(false);
                return;
            }

            try {
                const data = await authService.validateToken();
                setUser(data.user);
                setIsAuthenticated(true);
            } catch (error) {
                if (error instanceof AuthError && error.isUnauthorized()) {
                    authService.logout();
                }
                setError(error);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();
    }, []);

    const login = useCallback(async (email, password) => {
        setIsLoading(true);
        setError(null);

        try {
            const data = await authService.login(email, password);
            setUser(data.user);
            setIsAuthenticated(true);
            return data;
        } catch (error) {
            setError(error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const register = useCallback(async (pseudo, email, password) => {
        setIsLoading(true);
        setError(null);

        try {
            const data = await authService.register(pseudo, email, password);
            setUser(data.user);
            setIsAuthenticated(true);
            return data;
        } catch (error) {
            setError(error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const logout = useCallback(() => {
        authService.logout();
        setUser(null);
        setIsAuthenticated(false);
        setError(null);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        isAuthenticated,
        user,
        isLoading,
        error,
        login,
        register,
        logout,
        clearError
    };
};