import React, { ReactNode } from 'react';
import { useEnhancedAuth } from '../hooks/useAuth.enhanced';

interface ProtectedRouteProps {
    children: ReactNode;
    fallback?: ReactNode;
    requireAuth?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
    children, 
    fallback = null, 
    requireAuth = true 
}) => {
    const { isAuthenticated, isLoading } = useEnhancedAuth();

    if (isLoading) {
        return (
            <div className="loading-spinner">
                <div className="spinner"></div>
                <p>Vérification de l'authentification...</p>
            </div>
        );
    }

    // Si authentification requise mais utilisateur non connecté
    if (requireAuth && !isAuthenticated) {
        return <>{fallback}</>;
    }

    // Si pas d'authentification requise mais utilisateur connecté
    if (!requireAuth && isAuthenticated) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
};

export default ProtectedRoute;