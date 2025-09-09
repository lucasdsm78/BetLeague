import React, { useState, useRef, useCallback } from 'react';
import authService, { AuthError } from '../services/authService';
import './AuthForms.css';

const LoginForm = ({ onLogin, onBack, onSwitchToRegister }) => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [attemptCount, setAttemptCount] = useState(0);
    const lastAttemptTime = useRef(0);
    const formRef = useRef(null);

    const validateForm = () => {
        const newErrors = {};

        if (!formData.email.trim()) {
            newErrors.email = 'Email requis';
        } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email)) {
            newErrors.email = 'Email invalide';
        } else if (formData.email.length > 254) {
            newErrors.email = 'Email trop long';
        }

        if (!formData.password) {
            newErrors.password = 'Mot de passe requis';
        } else if (formData.password.length > 128) {
            newErrors.password = 'Mot de passe trop long';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        
        const now = Date.now();
        if (now - lastAttemptTime.current < 1000) {
            setErrors({ general: 'Veuillez patienter avant de réessayer.' });
            return;
        }
        lastAttemptTime.current = now;

        if (attemptCount >= 5) {
            setErrors({ general: 'Trop de tentatives. Attendez quelques minutes.' });
            return;
        }

        if (!validateForm()) return;

        setIsLoading(true);
        setErrors({});
        setAttemptCount(prev => prev + 1);

        try {
            const data = await authService.login(formData.email, formData.password);
            
            setAttemptCount(0);
            onLogin(data.user, data.access_token);
        } catch (error) {
            if (error instanceof AuthError) {
                let message = error.getDisplayMessage();
                
                if (error.isUnauthorized()) {
                    message = 'Email ou mot de passe incorrect.';
                } else if (error.isConflict()) {
                    message = 'Email ou nom d\'utilisateur déjà utilisé.';
                }
                
                setErrors({ general: message });
            } else {
                setErrors({ general: 'Erreur inattendue. Veuillez réessayer.' });
            }
        } finally {
            setIsLoading(false);
        }
    }, [formData, validateForm, onLogin, attemptCount]);

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        
        const maxLengths = { email: 254, password: 128 };
        if (value.length > maxLengths[name]) return;
        
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    }, [errors]);

    return (
        <div className="auth-form">
            <button className="back-btn" onClick={onBack}>
                ← Retour
            </button>

            <div className="form-header">
                <h2>Connexion</h2>
                <p>Bon retour sur BetLeague !</p>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} autoComplete="on">
                {errors.general && (
                    <div className="error-message">{errors.general}</div>
                )}

                <div className="form-group">
                    <input
                        type="email"
                        name="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleChange}
                        className={errors.email ? 'error' : ''}
                        autoComplete="email"
                        maxLength={254}
                        required
                        disabled={isLoading}
                        spellCheck={false}
                    />
                    {errors.email && <span className="field-error">{errors.email}</span>}
                </div>

                <div className="form-group">
                    <div className="password-input-wrapper">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            placeholder="Mot de passe"
                            value={formData.password}
                            onChange={handleChange}
                            className={errors.password ? 'error' : ''}
                            autoComplete="current-password"
                            maxLength={128}
                            required
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        >
                            {showPassword ? '👁️' : '👁️‍🗨️'}
                        </button>
                    </div>
                    {errors.password && <span className="field-error">{errors.password}</span>}
                </div>

                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoading}
                >
                    {isLoading ? 'Connexion...' : 'Se connecter'}
                </button>
            </form>

            <div className="form-footer">
                <p>
                    Pas encore de compte ?{' '}
                    <button className="link-btn" onClick={onSwitchToRegister}>
                        S'inscrire
                    </button>
                </p>
            </div>
        </div>
    );
};

export default LoginForm;
