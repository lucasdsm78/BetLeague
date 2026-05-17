import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import enhancedAuthService from '../services/authService.enhanced';
import { useAuthStore } from '../store/authStore';
import { __resetSharedAuthInitializationForTests, useEnhancedAuth } from './useAuth.enhanced';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useEnhancedAuth', () => {
  beforeEach(async () => {
    await act(async () => {
      useAuthStore.getState().logout();
      __resetSharedAuthInitializationForTests();
      await enhancedAuthService.logout({ server: false });
      __resetSharedAuthInitializationForTests();
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await act(async () => {
      useAuthStore.getState().logout();
      await enhancedAuthService.logout({ server: false });
      __resetSharedAuthInitializationForTests();
    });
  });

  it('attend réellement la restauration de session en StrictMode avant de marquer l’init comme terminée', async () => {
    const deferred = createDeferred<{ user: { id: string; email: string; pseudo: string; username: string }; token: string } | null>();
    const restoreSessionSpy = jest
      .spyOn(enhancedAuthService, 'restoreSession')
      .mockImplementation(() => deferred.promise);

    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <React.StrictMode>{children}</React.StrictMode>
    );

    const { result } = renderHook(() => useEnhancedAuth(), { wrapper });

    await waitFor(() => expect(restoreSessionSpy).toHaveBeenCalledTimes(1));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.initializationComplete).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);

    await act(async () => {
      deferred.resolve({
        user: {
          id: 'user-42',
          email: 'player@example.com',
          pseudo: 'player',
          username: 'player',
        },
        token: 'header.payload.signature',
      });
      await deferred.promise;
    });

    await waitFor(() => expect(result.current.initializationComplete).toBe(true));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toMatchObject({
      id: 'user-42',
      email: 'player@example.com',
    });
  });
});


