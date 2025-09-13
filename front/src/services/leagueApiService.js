/**
 * League API Service - Secure integration with backend
 * Follows React best practices with proper error handling
 */

class LeagueApiService {
    constructor() {
        this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';
    }

    /**
     * Get authentication headers with JWT token
     */
    getAuthHeaders() {
        const token = localStorage.getItem('authToken');
        return {
            'Content-Type': 'application/json',
            'X-Authentication': token ? `Bearer ${token}` : ''
        };
    }

    /**
     * Secure HTTP request with comprehensive error handling
     */
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            headers: this.getAuthHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            // Handle authentication errors
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('authToken');
                window.location.href = '/';
                throw new Error('Session expirée. Veuillez vous reconnecter.');
            }
            
            // Handle different error status codes
            if (!response.ok) {
                let errorMessage = 'Une erreur est survenue';
                
                try {
                    const errorData = await response.json();
                    
                    switch (response.status) {
                        case 400:
                            errorMessage = 'Données invalides';
                            break;
                        case 403:
                            errorMessage = 'Accès refusé';
                            break;
                        case 404:
                            errorMessage = 'Ressource non trouvée';
                            break;
                        case 409:
                            errorMessage = errorData.detail || 'Conflit de données';
                            break;
                        case 422:
                            // Validation errors from FastAPI
                            if (errorData.detail && Array.isArray(errorData.detail)) {
                                errorMessage = errorData.detail
                                    .map(err => err.msg || err.message)
                                    .join(', ');
                            } else {
                                errorMessage = errorData.detail || 'Erreur de validation';
                            }
                            break;
                        case 500:
                            errorMessage = 'Erreur serveur interne';
                            break;
                        default:
                            errorMessage = errorData.detail || `Erreur ${response.status}`;
                    }
                } catch {
                    // If error response is not JSON
                    errorMessage = `Erreur ${response.status}: ${response.statusText}`;
                }
                
                throw new Error(errorMessage);
            }

            return await response.json();
        } catch (error) {
            // Network errors
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error('Impossible de se connecter au serveur. Vérifiez votre connexion internet.');
            }
            throw error;
        }
    }

    /**
     * Create a new league
     * Maps frontend form data to backend LeagueCreateModel
     */
    async createLeague(formData) {
        // Input validation
        if (!formData.name || formData.name.trim().length < 3) {
            throw new Error('Le nom de la ligue doit contenir au moins 3 caractères');
        }

        if (formData.name.trim().length > 50) {
            throw new Error('Le nom de la ligue ne peut pas dépasser 50 caractères');
        }

        if (!formData.maxMembers || formData.maxMembers < 2 || formData.maxMembers > 200) {
            throw new Error('Le nombre de participants doit être entre 2 et 200');
        }

        if (formData.entryFee < 0 || formData.entryFee > 10000) {
            throw new Error('La mise d\'entrée doit être entre 0 et 10000 BTL');
        }

        // Transform frontend data to match LeagueCreateModel
        const payload = {
            name: formData.name.trim(),
            max_players: parseInt(formData.maxMembers),
            is_private: formData.type === 'private',
            is_free: formData.entryFee === 0,
            nb_btl: formData.entryFee > 0 ? parseInt(formData.entryFee) : null
        };

        try {
            const response = await this.makeRequest('/league/create', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            return {
                success: true,
                data: response,
                message: response.message || 'Ligue créée avec succès !'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate league name (client-side check)
     */
    validateLeagueName(name) {
        if (!name || typeof name !== 'string') {
            return { isValid: false, error: 'Le nom est requis' };
        }

        const trimmedName = name.trim();
        
        if (trimmedName.length < 3) {
            return { isValid: false, error: 'Minimum 3 caractères requis' };
        }

        if (trimmedName.length > 50) {
            return { isValid: false, error: 'Maximum 50 caractères autorisés' };
        }

        // Check for forbidden characters
        const forbiddenChars = /[<>\/\\&"'`]/;
        if (forbiddenChars.test(trimmedName)) {
            return { isValid: false, error: 'Caractères non autorisés détectés' };
        }

        return { isValid: true };
    }

    /**
     * Get user's leagues
     */
    async getLeagues() {
        try {
            const response = await this.makeRequest('/leagues');
            return {
                success: true,
                data: response
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Join a league
     */
    async joinLeague(leagueId) {
        if (!leagueId || isNaN(leagueId)) {
            throw new Error('ID de ligue invalide');
        }

        try {
            const response = await this.makeRequest(`/league/${leagueId}/join`, {
                method: 'POST'
            });
            return {
                success: true,
                data: response,
                message: response.message || 'Vous avez rejoint la ligue !'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get invitations
     */
    async getInvitations(isReceived = true) {
        try {
            const response = await this.makeRequest(`/invitations?is_received=${isReceived}`);
            return {
                success: true,
                data: response
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update invitation status
     */
    async updateInvitation(invitationId, accept) {
        if (!invitationId || isNaN(invitationId)) {
            throw new Error('ID d\'invitation invalide');
        }

        try {
            const response = await this.makeRequest(
                `/league/invitation/${accept ? 'true' : 'false'}?invitation_id=${invitationId}`, 
                { method: 'PUT' }
            );
            return {
                success: true,
                data: response,
                message: response.message || (accept ? 'Invitation acceptée' : 'Invitation refusée')
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export singleton instance
const leagueApiService = new LeagueApiService();
export default leagueApiService;