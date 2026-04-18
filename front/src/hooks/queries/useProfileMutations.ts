import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse } from '../../services/http';
import { updateProfile, deleteMyAccount, changeMyPassword } from '../../services/api/userProfile';
import type { ApiUpdateProfileData, ApiUpdateProfileResponse } from '../../types/api/profile';
import type { ApiDeleteMyAccountRequest, ApiDeleteMyAccountResponse } from '../../types/api/account';
import type { ApiChangePasswordRequest, ApiChangePasswordResponse } from '../../types/api/changePassword';
import {
  twoFactorService,
  type TwoFactorSetup,
  type DisableTwoFactorPayload,
  type TwoFactorStatus,
  type VerifyTwoFactorPayload,
} from '../../services/twoFactor';
import { profileKeys } from './profileKeys';
import enhancedAuthService from '../../services/authService.enhanced';
import { useAuthStore } from '../../store/authStore';

export function useUpdateProfileMutation() {
  const qc = useQueryClient();

  return useMutation<ApiResponse<ApiUpdateProfileResponse>, Error, ApiUpdateProfileData>({
    mutationFn: async (data) => {
      const dto = await updateProfile(data);

      if (dto.token_auth) {
        const userUpdates: Record<string, unknown> = {};
        if (data.pseudo) userUpdates.pseudo = data.pseudo;
        if (data.email) {
          userUpdates.email = data.email;
          userUpdates.username = data.email.split('@')[0];
        }
        enhancedAuthService.applySessionTokens(dto, userUpdates);
      }

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

  return useMutation<TwoFactorStatus, Error, VerifyTwoFactorPayload>({
    mutationFn: ({ code }) => twoFactorService.verifyTwoFactor(code),
    onSuccess: () => {
      // le backend a activé la 2FA côté compte, on refresh /auth/me
      qc.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

export function useDisableTwoFactorMutation() {
  const qc = useQueryClient();

  return useMutation<TwoFactorStatus, Error, DisableTwoFactorPayload>({
    mutationFn: (payload) => twoFactorService.disableTwoFactor(payload),
    onSuccess: async (data) => {
      if (data.reauthRequired) {
        qc.clear();
        try {
          await enhancedAuthService.logout();
        } finally {
          useAuthStore.getState().logout();
        }
      } else {
        qc.invalidateQueries({ queryKey: profileKeys.me() });
      }
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
        await enhancedAuthService.logout();
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
          await enhancedAuthService.logout();
        } finally {
          useAuthStore.getState().logout();
        }
      } else {
        qc.invalidateQueries({ queryKey: profileKeys.me() });
      }
    },
  });
}
