import React, { useState, useCallback, memo } from 'react';
import { useAuth } from '../hooks/useAuth';
import Input from './ui/Input';
import Button from './ui/Button';
import { AuthError } from '../services/authService';
import './ui/styles.css';
import './AuthForms.css';

const LoginForm = memo(({ onBack, onSwitchToRegister }) => {
    const { login } = useAuth();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [attemptCount, setAttemptCount] = useState(0);

    const validateEmail = useCallback((email) => {
        if (!email.trim()) return 'Email requis';
        if (email.length > 254) return 'Email trop long';
        if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
            return 'Email invalide';
        }
        return null;
    }, []);

    const validatePassword = useCallback((password) => {
        if (!password) return 'Mot de passe requis';
        if (password.length > 128) return 'Mot de passe trop long';
        return null;
    }, []);

    const validateForm = useCallback(() => {
        const newErrors = {};

        const emailError = validateEmail(formData.email);
        const passwordError = validatePassword(formData.password);

        if (emailError) newErrors.email = emailError;
        if (passwordError) newErrors.password = passwordError;

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData, validateEmail, validatePassword]);

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;

        setFormData(prev => ({ ...prev, [name]: value }));

        // Validation en temps réel
        if (errors[name]) {
            const error = name === 'email'
                ? validateEmail(value)
                : validatePassword(value);

            setErrors(prev => ({
                ...prev,
                [name]: error
            }));
        }
    }, [errors, validateEmail, validatePassword]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();

        if (attemptCount >= 5) {
            setErrors({ general: 'Trop de tentatives. Attendez quelques minutes.' });
            return;
        }

        if (!validateForm()) return;

        setIsLoading(true);
        setErrors({});

        try {
            await login(formData.email, formData.password);
            setAttemptCount(0);
        } catch (error) {
            setAttemptCount(prev => prev + 1);

            if (error instanceof AuthError) {
                let message = error.getDisplayMessage();

                if (error.isUnauthorized()) {
                    message = 'Email ou mot de passe incorrect.';
                } else if (error.isTooManyRequests()) {
                    message = 'Trop de tentatives. Réessayez plus tard.';
                }

                setErrors({ general: message });
            } else {
                setErrors({ general: 'Erreur inattendue. Veuillez réessayer.' });
            }
        } finally {
            setIsLoading(false);
        }
    }, [formData, login, validateForm, attemptCount]);

    return (
        <div className="auth-form">
            <button className="back-btn" onClick={onBack} type="button">
                ← Retour
            </button>

            <div className="form-header">
                <h2>Connexion</h2>
                <p>Bon retour sur BetLeague !</p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
                {errors.general && (
                    <div className="error-message" role="alert">
                        {errors.general}
                    </div>
                )}

                <Input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleChange}
                    error={errors.email}
                    autoComplete="email"
                    maxLength={254}
                    required
                    disabled={isLoading}
                    spellCheck={false}
                />

                <Input
                    type="password"
                    name="password"
                    placeholder="Mot de passe"
                    value={formData.password}
                    onChange={handleChange}
                    error={errors.password}
                    autoComplete="current-password"
                    maxLength={128}
                    required
                    disabled={isLoading}
                    showPasswordToggle
                />

                <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    loading={isLoading}
                    disabled={isLoading}
                >
                    {isLoading ? 'Connexion...' : 'Se connecter'}
                </Button>
            </form>

            <div className="form-footer">
                <p>
                    Pas encore de compte ?{' '}
                    <button
                        className="link-btn"
                        onClick={onSwitchToRegister}
                        type="button"
                    >
                        S'inscrire
                    </button>
                </p>
            </div>
        </div>
    );
});

LoginForm.displayName = 'OptimizedLoginForm';

export default LoginForm;
