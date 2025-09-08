import { useState, useCallback } from 'react';

let toastId = 0;

export const useToast = () => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = ++toastId;
        const toast = { id, message, type, duration };

        setToasts(prev => [...prev, toast]);

        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const clearToasts = useCallback(() => {
        setToasts([]);
    }, []);

    const showSuccess = useCallback((message, duration) => 
        addToast(message, 'success', duration), [addToast]);

    const showError = useCallback((message, duration) => 
        addToast(message, 'error', duration), [addToast]);

    const showWarning = useCallback((message, duration) => 
        addToast(message, 'warning', duration), [addToast]);

    const showInfo = useCallback((message, duration) => 
        addToast(message, 'info', duration), [addToast]);

    return {
        toasts,
        addToast,
        removeToast,
        clearToasts,
        showSuccess,
        showError,
        showWarning,
        showInfo
    };
};

export default useToast;