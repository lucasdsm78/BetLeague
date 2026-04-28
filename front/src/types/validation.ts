/**
 * Types UI - Validation
 *
 * Utilisés par les hooks `useFormValidation` / `useFormSecurity`.
 */

export interface ValidationRule<T = unknown> {
  readonly required?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly pattern?: RegExp;
  readonly custom?: (value: T, allValues?: any) => string | null;
}

export type ValidationSchema<T = Record<string, unknown>> = {
  readonly [K in keyof T]?: ValidationRule<T[K]>;
};

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: Record<string, string>;
}

