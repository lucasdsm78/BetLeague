// Re-export all types for easy importing
export * from './entities';

// Additional utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Event handler types for React
export type EventHandler<T = Element> = (event: React.SyntheticEvent<T>) => void;
export type ChangeHandler<T = HTMLInputElement> = (event: React.ChangeEvent<T>) => void;
export type SubmitHandler = (event: React.FormEvent<HTMLFormElement>) => void;

// Component prop types
export interface BaseProps {
  className?: string;
  children?: React.ReactNode;
  'data-testid'?: string;
}

export interface WithLoading {
  isLoading?: boolean;
}

export interface WithError {
  error?: string | null;
  onErrorClear?: () => void;
}

// API types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestConfig {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  retries?: number;
}

// Environment types
export interface Environment {
  NODE_ENV: 'development' | 'production' | 'test';
  REACT_APP_API_URL: string;
  REACT_APP_VERSION: string;
  REACT_APP_BUILD_DATE: string;
}

declare global {
  interface Window {
    ENV: Environment;
  }
}