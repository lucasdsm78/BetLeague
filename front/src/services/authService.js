class AuthService {
    constructor() {
        this.baseURL = (process.env.REACT_APP_API_URL || 'http://localhost:8001/api') + '/auth';
        this.defaultTimeout = 10000;
    }

    async makeRequest(endpoint, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

        try {
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                credentials: 'include',
                signal: controller.signal,
                ...options,
            };

            const token = localStorage.getItem('authToken');
            if (token && !options.skipAuth) {
                config.headers['X-Authentication'] = `Bearer ${token}`;
            }

            const response = await fetch(`${this.baseURL}${endpoint}`, config);
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new AuthError(
                    errorData.detail || 'Une erreur est survenue',
                    response.status,
                    errorData
                );
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new AuthError('Timeout de connexion', 408);
            }
            
            if (error instanceof AuthError) {
                throw error;
            }
            
            throw new AuthError('Erreur réseau', 0, error);
        }
    }

    async login(email, password, code = "string") {
        const data = await this.makeRequest('/login', {
            method: 'POST',
            body: JSON.stringify({
                email: email.toLowerCase().trim(),
                password: password,
                code: code
            }),
            skipAuth: true
        });

        if (data.token_auth) {
            localStorage.setItem('authToken', data.token_auth);
        }

        return data;
    }

    async register(pseudo, email, password) {
        const data = await this.makeRequest('/register', {
            method: 'POST',
            body: JSON.stringify({
                pseudo: pseudo.trim(),
                email: email.toLowerCase().trim(),
                password: password
            }),
            skipAuth: true
        });

        if (data.token_auth) {
            localStorage.setItem('authToken', data.token_auth);
        }

        return data;
    }

    async validateToken() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new AuthError('No token found', 401);
        }

        try {
            return await this.makeRequest('/validate');
        } catch (error) {
            if (error.status === 401 || error.status === 403) {
                this.logout();
            }
            throw error;
        }
    }

    logout() {
        localStorage.removeItem('authToken');
    }

    isAuthenticated() {
        return !!localStorage.getItem('authToken');
    }

    getToken() {
        return localStorage.getItem('authToken');
    }
}

class AuthError extends Error {
    constructor(message, status = 0, data = {}) {
        super(message);
        this.name = 'AuthError';
        this.status = status;
        this.data = data;
    }

    isNetworkError() {
        return this.status === 0;
    }

    isTimeout() {
        return this.status === 408;
    }

    isUnauthorized() {
        return this.status === 401;
    }

    isForbidden() {
        return this.status === 403;
    }

    isConflict() {
        return this.status === 409;
    }

    isTooManyRequests() {
        return this.status === 429;
    }

    isServerError() {
        return this.status >= 500;
    }

    getDisplayMessage() {
        if (this.isNetworkError()) {
            return 'Erreur de connexion. Vérifiez votre réseau.';
        }
        
        if (this.isTimeout()) {
            return 'Timeout. Vérifiez votre connexion.';
        }
        
        if (this.isUnauthorized()) {
            return 'Session expirée. Veuillez vous reconnecter.';
        }
        
        if (this.isTooManyRequests()) {
            return 'Trop de tentatives. Réessayez plus tard.';
        }
        
        if (this.isServerError()) {
            return 'Erreur serveur. Réessayez plus tard.';
        }

        return this.message;
    }
}

const authService = new AuthService();

export { AuthError };
export default authService;