import React, { useState, useRef, useCallback } from 'react';
import './AuthForms.css';

const RegisterForm = ({ onRegister, onBack, onSwitchToLogin }) => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState(0);
    const formRef = useRef(null);

    const calculatePasswordStrength = (password) => {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^\w\s]/.test(password)) strength++;
        return Math.min(strength, 5);
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.username.trim()) {
            newErrors.username = 'Nom d\'utilisateur requis';
        } else if (formData.username.length < 3) {
            newErrors.username = 'Minimum 3 caractères';
        } else if (formData.username.length > 30) {
            newErrors.username = 'Maximum 30 caractères';
        } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
            newErrors.username = 'Seuls les lettres, chiffres, - et _ sont autorisés';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email requis';
        } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email)) {
            newErrors.email = 'Email invalide';
        } else if (formData.email.length > 254) {
            newErrors.email = 'Email trop long';
        }

        if (!formData.password) {
            newErrors.password = 'Mot de passe requis';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Minimum 8 caractères';
        } else if (formData.password.length > 128) {
            newErrors.password = 'Maximum 128 caractères';
        } else if (passwordStrength < 3) {
            newErrors.password = 'Mot de passe trop faible (utilisez majuscules, minuscules, chiffres)';
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsLoading(true);
        setErrors({});

        try {
            const sanitizedData = {
                username: formData.username.trim(),
                email: formData.email.toLowerCase().trim(),
                password: formData.password
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sanitizedData),
                signal: controller.signal,
                credentials: 'include'
            });

            clearTimeout(timeoutId);
            const data = await response.json();

            if (response.ok) {
                onRegister(data.user, data.access_token);
            } else {
                const message = response.status === 409 ? 'Email ou nom d\'utilisateur déjà utilisé.' :
                               response.status === 429 ? 'Trop de tentatives. Réessayez plus tard.' :
                               data.detail || 'Erreur lors de l\'inscription';
                setErrors({ general: message });
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                setErrors({ general: 'Timeout. Vérifiez votre connexion.' });
            } else {
                setErrors({ general: 'Erreur réseau. Veuillez réessayer.' });
            }
        } finally {
            setIsLoading(false);
        }
    }, [formData, validateForm, onRegister]);

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        
        const maxLengths = { username: 30, email: 254, password: 128, confirmPassword: 128 };
        if (value.length > maxLengths[name]) return;
        
        setFormData(prev => ({ ...prev, [name]: value }));
        
        if (name === 'password') {
            setPasswordStrength(calculatePasswordStrength(value));
        }
        
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
                <h2>Inscription</h2>
                <p>Rejoignez la communauté BetLeague</p>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} autoComplete="on">
                {errors.general && (
                    <div className="error-message">{errors.general}</div>
                )}

                <div className="form-group">
                    <input
                        type="text"
                        name="username"
                        placeholder="Nom d'utilisateur (3-30 caractères)"
                        value={formData.username}
                        onChange={handleChange}
                        className={errors.username ? 'error' : ''}
                        autoComplete="username"
                        maxLength={30}
                        required
                        disabled={isLoading}
                        pattern="[a-zA-Z0-9_-]+"
                        spellCheck={false}
                    />
                    {errors.username && <span className="field-error">{errors.username}</span>}
                </div>

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
                            placeholder="Mot de passe (min. 8 caractères)"
                            value={formData.password}
                            onChange={handleChange}
                            className={errors.password ? 'error' : ''}
                            autoComplete="new-password"
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
                    {formData.password && (
                        <div className="password-strength">
                            <div className="strength-bar">
                                <div 
                                    className={`strength-fill strength-${passwordStrength}`}
                                    style={{ width: `${(passwordStrength / 5) * 100}%` }}
                                />
                            </div>
                            <span className="strength-text">
                                {passwordStrength < 2 ? 'Très faible' : 
                                 passwordStrength < 3 ? 'Faible' :
                                 passwordStrength < 4 ? 'Moyen' :
                                 passwordStrength < 5 ? 'Fort' : 'Très fort'}
                            </span>
                        </div>
                    )}
                    {errors.password && <span className="field-error">{errors.password}</span>}
                </div>

                <div className="form-group">
                    <div className="password-input-wrapper">
                        <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            name="confirmPassword"
                            placeholder="Confirmer le mot de passe"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className={errors.confirmPassword ? 'error' : ''}
                            autoComplete="new-password"
                            maxLength={128}
                            required
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            disabled={isLoading}
                            aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        >
                            {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                        </button>
                    </div>
                    {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
                </div>

                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoading}
                >
                    {isLoading ? 'Inscription...' : 'S\'inscrire'}
                </button>
            </form>

            <div className="form-footer">
                <p>
                    Déjà un compte ?{' '}
                    <button className="link-btn" onClick={onSwitchToLogin}>
                        Se connecter
                    </button>
                </p>
            </div>
        </div>
    );
};

export default RegisterForm;
