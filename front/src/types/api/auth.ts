/**
 * Types API - Auth
 */

import type { ApiResponse } from './common';

export interface ApiLoginResponseData {
  readonly token_auth: string;
  readonly uuid: string;
  readonly token_expiration?: string;
  readonly two_factor_enabled?: boolean;
  readonly message?: string;
}

export interface ApiRegisterResponseData {
  readonly message: string;
}

export interface ApiRefreshTokenResponseData {
  readonly token_auth: string;
  readonly token_expiration: string;
  readonly message?: string;
}

export interface ApiValidateTokenUser {
  readonly id?: string;
  readonly email: string;
  readonly username: string;
}

export interface ApiValidateTokenResponseData {
  readonly user: ApiValidateTokenUser;
}

export type ApiLoginResponse = ApiResponse<ApiLoginResponseData>;
export type ApiRegisterResponse = ApiResponse<ApiRegisterResponseData>;
export type ApiRefreshTokenResponse = ApiResponse<ApiRefreshTokenResponseData>;
export type ApiValidateTokenResponse = ApiResponse<ApiValidateTokenResponseData>;

