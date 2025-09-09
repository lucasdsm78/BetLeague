import React, { useState, useCallback, memo } from 'react';
import { useAuth } from '../hooks/useAuth';
import Input from './ui/Input';
import Button from './ui/Button';
import { AuthError } from '../services/authService';
import './ui/styles.css';
import './AuthForms.css';

const PasswordStrength = memo(({ password }) => {
    const calculateStrength = useCallback((pwd) => {
        let strength = 0;
        if (pwd.length >= 8) strength++;
        if (pwd.length >= 12) strength++;
        if (/[a-z]/.test(pwd)) strength++;
        if (/[A-Z]/.test(pwd)) strength++;
        if (/[0-9]/.test(pwd)) strength++;
        if (/[^\w\s]/.test(pwd)) strength++;
        return Math.min(strength, 5);
    }, []);

    const strength = calculateStrength(password);
    const strengthLabels = ['Très faible', 'Faible', 'Faible', 'Moyen', 'Fort', 'Très fort'];

    if (!password) return null;

    return (
        <div className="password-strength">
            <div className="strength-bar">
                <div 
                    className={`strength-fill strength-${strength}`}
                    style={{ width: `${(strength / 5) * 100}%` }}
                />
            </div>
            <span className="strength-text">
                {strengthLabels[strength]}
            </span>
        </div>
    );
});

PasswordStrength.displayName = 'PasswordStrength';

const OptimizedRegisterForm = memo(({ onBack, onSwitchToLogin }) => {
    const { register } = useAuth();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const validateUsername = useCallback((username) => {
        if (!username.trim()) return 'Nom d\'utilisateur requis';
        if (username.length < 3) return 'Minimum 3 caractères';
        if (username.length > 30) return 'Maximum 30 caractères';
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            return 'Seuls les lettres, chiffres, - et _ sont autorisés';
        }
        return null;
    }, []);

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
        if (password.length < 8) return 'Minimum 8 caractères';
        if (password.length > 128) return 'Maximum 128 caractères';
        
        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^\w\s]/.test(password)) strength++;
        
        if (strength < 3) {
            return 'Mot de passe trop faible (utilisez majuscules, minuscules, chiffres)';
        }
        return null;
    }, []);

    const validateConfirmPassword = useCallback((confirmPassword, password) => {
        if (password !== confirmPassword) {
            return 'Les mots de passe ne correspondent pas';
        }
        return null;
    }, []);

    const validateForm = useCallback(() => {
        const newErrors = {};
        
        const usernameError = validateUsername(formData.username);
        const emailError = validateEmail(formData.email);
        const passwordError = validatePassword(formData.password);
        const confirmPasswordError = validateConfirmPassword(formData.confirmPassword, formData.password);
        
        if (usernameError) newErrors.username = usernameError;
        if (emailError) newErrors.email = emailError;
        if (passwordError) newErrors.password = passwordError;
        if (confirmPasswordError) newErrors.confirmPassword = confirmPasswordError;
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData, validateUsername, validateEmail, validatePassword, validateConfirmPassword]);

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        
        setFormData(prev => ({ ...prev, [name]: value }));
        
        // Validation en temps réel
        if (errors[name]) {
            let error = null;
            
            switch (name) {
                case 'username':
                    error = validateUsername(value);
                    break;
                case 'email':
                    error = validateEmail(value);
                    break;
                case 'password':
                    error = validatePassword(value);
                    // Revalider confirmPassword si nécessaire
                    if (formData.confirmPassword && errors.confirmPassword) {
                        setErrors(prev => ({
                            ...prev,
                            confirmPassword: validateConfirmPassword(formData.confirmPassword, value)
                        }));
                    }
                    break;
                case 'confirmPassword':
                    error = validateConfirmPassword(value, formData.password);
                    break;
                default:
                    break;
            }
            
            setErrors(prev => ({
                ...prev,
                [name]: error
            }));
        }
    }, [errors, formData, validateUsername, validateEmail, validatePassword, validateConfirmPassword]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        
        if (!validateForm()) return;

        setIsLoading(true);
        setErrors({});

        try {
            await register(formData.username, formData.email, formData.password);
        } catch (error) {
            if (error instanceof AuthError) {
                let message = error.getDisplayMessage();
                
                if (error.isConflict()) {
                    message = 'Email ou nom d\'utilisateur déjà utilisé.';
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
    }, [formData, register, validateForm]);

    return (
        <div className="auth-form">
            <button className="back-btn" onClick={onBack} type="button">
                ← Retour
            </button>

            <div className="form-header">
                <h2>Inscription</h2>
                <p>Rejoignez la communauté BetLeague</p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
                {errors.general && (
                    <div className="error-message" role="alert">
                        {errors.general}
                    </div>
                )}

                <Input
                    type="text"
                    name="username"
                    placeholder="Nom d'utilisateur (3-30 caractères)"
                    value={formData.username}
                    onChange={handleChange}
                    error={errors.username}
                    autoComplete="username"
                    maxLength={30}
                    required
                    disabled={isLoading}
                    pattern="[a-zA-Z0-9_-]+"
                    spellCheck={false}
                />

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

                <div className="form-group">
                    <Input
                        type="password"
                        name="password"
                        placeholder="Mot de passe (min. 8 caractères)"
                        value={formData.password}
                        onChange={handleChange}
                        error={errors.password}
                        autoComplete="new-password"
                        maxLength={128}
                        required
                        disabled={isLoading}
                        showPasswordToggle
                    />
                    <PasswordStrength password={formData.password} />
                </div>

                <Input
                    type="password"
                    name="confirmPassword"
                    placeholder="Confirmer le mot de passe"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    error={errors.confirmPassword}
                    autoComplete="new-password"
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
                    {isLoading ? 'Inscription...' : 'S\'inscrire'}
                </Button>
            </form>

            <div className="form-footer">
                <p>
                    Déjà un compte ?{' '}
                    <button 
                        className="link-btn" 
                        onClick={onSwitchToLogin}
                        type="button"
                    >
                        Se connecter
                    </button>
                </p>
            </div>
        </div>
    );
});

OptimizedRegisterForm.displayName = 'OptimizedRegisterForm';

export default OptimizedRegisterForm;