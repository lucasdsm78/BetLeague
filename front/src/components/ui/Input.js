import React, { useState, useCallback, memo } from 'react';

const Input = memo(({
    type = 'text',
    name,
    value,
    onChange,
    placeholder,
    error,
    disabled = false,
    maxLength,
    autoComplete,
    required = false,
    pattern,
    spellCheck = false,
    className = '',
    showPasswordToggle = false,
    'aria-label': ariaLabel,
    ...props
}) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const handleChange = useCallback((e) => {
        const { value } = e.target;
        if (maxLength && value.length > maxLength) return;
        onChange(e);
    }, [onChange, maxLength]);

    const handleFocus = useCallback(() => {
        setIsFocused(true);
    }, []);

    const handleBlur = useCallback(() => {
        setIsFocused(false);
    }, []);

    const togglePasswordVisibility = useCallback(() => {
        setShowPassword(prev => !prev);
    }, []);

    const inputType = showPasswordToggle && type === 'password' 
        ? (showPassword ? 'text' : 'password')
        : type;

    const inputClasses = [
        'form-input',
        className,
        error ? 'error' : '',
        isFocused ? 'focused' : '',
        disabled ? 'disabled' : ''
    ].filter(Boolean).join(' ');

    return (
        <div className="input-wrapper">
            <div className="input-container">
                <input
                    type={inputType}
                    name={name}
                    value={value}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    disabled={disabled}
                    maxLength={maxLength}
                    autoComplete={autoComplete}
                    required={required}
                    pattern={pattern}
                    spellCheck={spellCheck}
                    className={inputClasses}
                    aria-label={ariaLabel || placeholder}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${name}-error` : undefined}
                    {...props}
                />
                {showPasswordToggle && type === 'password' && (
                    <button
                        type="button"
                        className="password-toggle"
                        onClick={togglePasswordVisibility}
                        disabled={disabled}
                        aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                        {showPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                )}
            </div>
            {error && (
                <span 
                    id={`${name}-error`}
                    className="input-error"
                    role="alert"
                >
                    {error}
                </span>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;