import React, { memo } from 'react';

const Button = memo(({
    children,
    type = 'button',
    variant = 'primary',
    size = 'medium',
    disabled = false,
    loading = false,
    onClick,
    className = '',
    fullWidth = false,
    ...props
}) => {
    const baseClasses = [
        'btn',
        `btn-${variant}`,
        `btn-${size}`,
        fullWidth ? 'btn-full-width' : '',
        loading ? 'btn-loading' : '',
        disabled ? 'btn-disabled' : '',
        className
    ].filter(Boolean).join(' ');

    const handleClick = (e) => {
        if (disabled || loading) return;
        onClick?.(e);
    };

    return (
        <button
            type={type}
            className={baseClasses}
            disabled={disabled || loading}
            onClick={handleClick}
            aria-disabled={disabled || loading}
            {...props}
        >
            {loading && (
                <span className="btn-spinner" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="spinner-icon">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/>
                        <path d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor"/>
                    </svg>
                </span>
            )}
            <span className={loading ? 'btn-content-loading' : 'btn-content'}>
                {children}
            </span>
        </button>
    );
});

Button.displayName = 'Button';

export default Button;