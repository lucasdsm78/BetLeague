import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse } from '../../services/http';
import { updateProfile, deleteMyAccount, changeMyPassword } from '../../services/api/userProfile';
import type { ApiUpdateProfileData, ApiUpdateProfileResponse } from '../../types/api/profile';
import type { ApiDeleteMyAccountRequest, ApiDeleteMyAccountResponse } from '../../types/api/account';
import type { ApiChangePasswordRequest, ApiChangePasswordResponse } from '../../types/api/changePassword';
import twoFactorService from '../../services/twoFactorService';
import type { TwoFactorSetup, TwoFactorStatus } from '../../types/entities/twoFactor';
import { profileKeys } from './profileKeys';
import authService from '../../services/authService';
import { useAuthStore } from '../../store/authStore';

export function useUpdateProfileMutation() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<ApiUpdateProfileResponse>, Error, ApiUpdateProfileData>({
    mutationFn: async (data) => {
      const dto = await updateProfile(data);
      return {
        success: true,
        data: dto,
        status: 200,
        headers: {},
      };
    },
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

export function useDeleteMyAccountMutation() {
  const qc = useQueryClient();

  return useMutation<ApiDeleteMyAccountResponse, Error, ApiDeleteMyAccountRequest>({
    mutationFn: deleteMyAccount,
    onSuccess: async () => {
      qc.clear();
      try {
        await authService.logout();
      } finally {
        useAuthStore.getState().logout();
      }
    },
  });
}

export function useChangeMyPasswordMutation() {
  const qc = useQueryClient();

  return useMutation<ApiChangePasswordResponse, Error, ApiChangePasswordRequest>({
    mutationFn: changeMyPassword,
    onSuccess: async (data) => {
      // backend révoque les tokens => on purge l'état local et on force logout
      if (data.reauth_required) {
        qc.clear();
        try {
          await authService.logout();
        } finally {
          useAuthStore.getState().logout();
        }
      } else {
        qc.invalidateQueries({ queryKey: profileKeys.me() });
      }
    },
  });
}
