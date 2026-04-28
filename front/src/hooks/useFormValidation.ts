/**
 * Form Validation Hook - TypeScript version
 * Comprehensive form validation with security features
 */

import { useState, useCallback, useMemo } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('useFormValidation');
import type { ValidationSchema, ValidationResult, ValidationRule } from '../types';

export interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

export interface UseFormValidationOptions<T> {
  initialValues: T;
  validationSchema: ValidationSchema<T>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  sanitizeOnSubmit?: boolean;
  onSubmit?: (values: T) => void | Promise<void>;
}

export interface UseFormValidationReturn<T> {
  formState: FormState<T>;
  setValue: (field: keyof T, value: T[keyof T]) => void;
  setValues: (values: Partial<T>) => void;
  setError: (field: keyof T, error: string) => void;
  clearError: (field: keyof T) => void;
  clearErrors: () => void;
  setTouched: (field: keyof T, touched?: boolean) => void;
  setFieldTouched: (field: keyof T) => void;
  validateField: (field: keyof T) => boolean;
  validateForm: () => boolean;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  reset: () => void;
  getFieldProps: (field: keyof T) => {
    value: T[keyof T];
    onChange: (value: T[keyof T]) => void;
    onBlur: () => void;
    error: string | undefined;
    touched: boolean;
  };
}

// Built-in validation rules
export const ValidationRules = {
  required: <T>(message: string = 'Ce champ est requis'): ValidationRule<T> => ({
    required: true,
    custom: (value: T) => {
      if (value === null || value === undefined || value === '') {
        return message;
      }
      if (typeof value === 'string' && value.trim() === '') {
        return message;
      }
      return null;
    },
  }),

  email: (message: string = 'Adresse email invalide'): ValidationRule<string> => ({
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    custom: (value: string) => {
      if (!value) return null;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value.trim()) ? null : message;
    },
  }),

  minLength: (min: number, message?: string): ValidationRule<string> => ({
    min,
    custom: (value: string) => {
      if (!value) return null;
      if (value.length < min) {
        return message || `Minimum ${min} caractères requis`;
      }
      return null;
    },
  }),

  maxLength: (max: number, message?: string): ValidationRule<string> => ({
    max,
    custom: (value: string) => {
      if (!value) return null;
      if (value.length > max) {
        return message || `Maximum ${max} caractères autorisés`;
      }
      return null;
    },
  }),

  password: (message: string = 'Mot de passe trop faible'): ValidationRule<string> => ({
    custom: (value: string) => {
      if (!value) return null;

      const requirements = [
        { test: /.{8,}/, message: 'Au moins 8 caractères' },
        { test: /[a-z]/, message: 'Au moins une minuscule' },
        { test: /[A-Z]/, message: 'Au moins une majuscule' },
        { test: /\d/, message: 'Au moins un chiffre' },
      ];

      for (const req of requirements) {
        if (!req.test.test(value)) {
          return req.message;
        }
      }

      return null;
    },
  }),

  confirmPassword: (passwordField: string, message: string = 'Les mots de passe ne correspondent pas') => ({
    custom: (value: string, allValues: any) => {
      if (!value) return null;
      if (value !== allValues[passwordField]) {
        return message;
      }
      return null;
    },
  }),

  numeric: (message: string = 'Seuls les chiffres sont autorisés'): ValidationRule<string | number> => ({
    pattern: /^\d+$/,
    custom: (value: string | number) => {
      if (!value) return null;
      const numericValue = typeof value === 'string' ? value : value.toString();
      return /^\d+$/.test(numericValue) ? null : message;
    },
  }),

  range: (min: number, max: number, message?: string): ValidationRule<number> => ({
    custom: (value: number) => {
      if (value === null || value === undefined) return null;
      if (value < min || value > max) {
        return message || `La valeur doit être entre ${min} et ${max}`;
      }
      return null;
    },
  }),

  noXSS: (message: string = 'Contenu non autorisé détecté'): ValidationRule<string> => ({
    custom: (value: string) => {
      if (!value) return null;

      // Basic XSS patterns
      const xssPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe/i,
        /<object/i,
        /<embed/i,
      ];

      for (const pattern of xssPatterns) {
        if (pattern.test(value)) {
          return message;
        }
      }

      return null;
    },
  }),
};

// Input sanitization utilities
export const SanitizationUtils = {
  trim: (value: string): string => value.trim(),

  email: (value: string): string => value.toLowerCase().trim(),

  noSpecialChars: (value: string): string =>
    value.replace(/[<>\/\\&"'`]/g, ''),

  alphanumeric: (value: string): string =>
    value.replace(/[^a-zA-Z0-9\s]/g, ''),

  numeric: (value: string): string =>
    value.replace(/[^0-9]/g, ''),

  removeHTML: (value: string): string =>
    value.replace(/<[^>]*>/g, ''),
};

export function useFormValidation<T extends Record<string, any>>(
  options: UseFormValidationOptions<T>
): UseFormValidationReturn<T> {
  const {
    initialValues,
    validationSchema,
    validateOnChange = true,
    validateOnBlur = true,
    sanitizeOnSubmit = true,
    onSubmit,
  } = options;

  const [formState, setFormState] = useState<FormState<T>>(() => ({
    values: { ...initialValues },
    errors: {},
    touched: {},
    isValid: false,
    isSubmitting: false,
    isDirty: false,
  }));

  // Validate a single field
  const validateField = useCallback((field: keyof T): boolean => {
    const value = formState.values[field];
    const rule = validationSchema[field];

    if (!rule) return true;

    let error: string | null = null;

    // Required validation
    if (rule.required && (value === null || value === undefined || value === '')) {
      error = 'Ce champ est requis';
    }

    // Pattern validation
    if (!error && rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      error = 'Format invalide';
    }

    // Length validation
    if (!error && rule.min && typeof value === 'string' && value.length < rule.min) {
      error = `Minimum ${rule.min} caractères requis`;
    }

    if (!error && rule.max && typeof value === 'string' && value.length > rule.max) {
      error = `Maximum ${rule.max} caractères autorisés`;
    }

    // Custom validation
    if (!error && rule.custom) {
      error = rule.custom(value, formState.values);
    }

    // Update form state
    setFormState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [field]: error || undefined,
      },
    }));

    return !error;
  }, [formState.values, validationSchema]);

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    Object.keys(validationSchema).forEach(key => {
      const field = key as keyof T;
      if (!validateField(field)) {
        isValid = false;
      }
    });

    // Update overall validity
    setFormState(prev => ({
      ...prev,
      isValid,
    }));

    return isValid;
  }, [validateField, validationSchema]);

  // Set single field value
  const setValue = useCallback((field: keyof T, value: T[keyof T]) => {
    setFormState(prev => {
      const newState = {
        ...prev,
        values: {
          ...prev.values,
          [field]: value,
        },
        isDirty: true,
      };

      // Validate on change if enabled
      if (validateOnChange) {
        setTimeout(() => validateField(field), 0);
      }

      return newState;
    });
  }, [validateOnChange, validateField]);

  // Set multiple field values
  const setValues = useCallback((values: Partial<T>) => {
    setFormState(prev => ({
      ...prev,
      values: {
        ...prev.values,
        ...values,
      },
      isDirty: true,
    }));

    // Validate all changed fields
    if (validateOnChange) {
      Object.keys(values).forEach(key => {
        setTimeout(() => validateField(key as keyof T), 0);
      });
    }
  }, [validateOnChange, validateField]);

  // Set field error
  const setError = useCallback((field: keyof T, error: string) => {
    setFormState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [field]: error,
      },
    }));
  }, []);

  // Clear single field error
  const clearError = useCallback((field: keyof T) => {
    setFormState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [field]: undefined,
      },
    }));
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setFormState(prev => ({
      ...prev,
      errors: {},
    }));
  }, []);

  // Set field touched state
  const setTouched = useCallback((field: keyof T, touched: boolean = true) => {
    setFormState(prev => ({
      ...prev,
      touched: {
        ...prev.touched,
        [field]: touched,
      },
    }));
  }, []);

  // Mark field as touched (for onBlur)
  const setFieldTouched = useCallback((field: keyof T) => {
    setTouched(field, true);

    if (validateOnBlur) {
      validateField(field);
    }
  }, [setTouched, validateOnBlur, validateField]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    const allFields = Object.keys(validationSchema) as Array<keyof T>;
    allFields.forEach(field => setTouched(field, true));

    // Validate form
    if (!validateForm()) {
      return;
    }

    setFormState(prev => ({ ...prev, isSubmitting: true }));

    try {
      let values = { ...formState.values };

      // Sanitize values if enabled
      if (sanitizeOnSubmit) {
        Object.keys(values).forEach(key => {
          const value = values[key as keyof T];
          if (typeof value === 'string') {
            // Basic sanitization
            values[key as keyof T] = SanitizationUtils.trim(value) as T[keyof T];
          }
        });
      }

      if (onSubmit) {
        await onSubmit(values);
      }
    } catch (error) {
      logger.error('form submission error', { error });
    } finally {
      setFormState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [formState.values, validationSchema, validateForm, setTouched, sanitizeOnSubmit, onSubmit]);

  // Reset form
  const reset = useCallback(() => {
    setFormState({
      values: { ...initialValues },
      errors: {},
      touched: {},
      isValid: false,
      isSubmitting: false,
      isDirty: false,
    });
  }, [initialValues]);

  // Get field props helper
  const getFieldProps = useCallback((field: keyof T) => ({
    value: formState.values[field],
    onChange: (value: T[keyof T]) => setValue(field, value),
    onBlur: () => setFieldTouched(field),
    error: formState.errors[field],
    touched: formState.touched[field] || false,
  }), [formState, setValue, setFieldTouched]);

  // Memoized form validity
  const isFormValid = useMemo(() => {
    return Object.keys(formState.errors).every(key => !formState.errors[key as keyof T]);
  }, [formState.errors]);

  // Update form validity when errors change
  useMemo(() => {
    setFormState(prev => ({
      ...prev,
      isValid: isFormValid,
    }));
  }, [isFormValid]);

  return {
    formState,
    setValue,
    setValues,
    setError,
    clearError,
    clearErrors,
    setTouched,
    setFieldTouched,
    validateField,
    validateForm,
    handleSubmit,
    reset,
    getFieldProps,
  };
}
