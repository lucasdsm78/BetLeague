import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse } from '../../services/http';
import userProfileService, { type UpdateProfileData, type UpdateProfileResponse } from '../../services/userProfileService';
import twoFactorService from '../../services/twoFactorService';
import type { TwoFactorSetup, TwoFactorStatus } from '../../types/entities/twoFactor';
import { profileKeys } from './profileKeys';

export function useUpdateProfileMutation() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<UpdateProfileResponse>, Error, UpdateProfileData>({
    mutationFn: (data) => userProfileService.updateProfile(data),
    onSuccess: () => {
      // après update, on refetch le profil (solde, pseudo, flags)
      qc.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

export function useEnableTwoFactorMutation() {
  return useMutation<TwoFactorSetup, Error, void>({
    mutationFn: async () => twoFactorService.enableTwoFactor(),
  });
}

export function useVerifyTwoFactorMutation() {
  const qc = useQueryClient();

  return useMutation<TwoFactorStatus, Error, { code: string }>({
    mutationFn: ({ code }) => twoFactorService.verifyTwoFactor(code),
    onSuccess: () => {
      // le backend a activé la 2FA côté compte, on refresh /auth/me
      qc.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}
