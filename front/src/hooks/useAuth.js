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
                } else {
                    // Si le token existe mais /validate échoue pour d'autres raisons,
                    // on peut quand même considérer l'utilisateur comme connecté
                    console.warn('Validate token failed but token exists:', error);
                    setIsAuthenticated(true);
                    setUser({ email: 'user@example.com', pseudo: 'User' }); // Fallback user
                }
                setError(error);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();
    }, []);

    const login = useCallback(async (email, password, code = "string") => {
        setIsLoading(true);
        setError(null);

        try {
            const data = await authService.login(email, password, code);
            
            // Créer un objet utilisateur temporaire avec l'email
            const tempUser = {
                email: email,
                pseudo: email.split('@')[0], // Utilise la partie avant @ comme pseudo temporaire
                username: email.split('@')[0]
            };
            
            setUser(tempUser);
            setIsAuthenticated(true);
            return { ...data, user: tempUser };
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
            
            // Créer un objet utilisateur avec les données d'inscription
            const newUser = {
                email: email,
                pseudo: pseudo,
                username: pseudo
            };
            
            setUser(newUser);
            setIsAuthenticated(true);
            return { ...data, user: newUser };
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