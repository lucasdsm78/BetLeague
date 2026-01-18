/**
 * Types API - Auth
 */

import type { ApiResponse } from './common';

export interface ApiLoginResponseData {
  readonly token_auth: string;
  readonly uuid: string;
  readonly token_expiration?: string;
  readonly two_factor_enabled?: boolean;
}

export interface ApiRegisterResponseData {
  readonly token_auth: string;
  readonly uuid: string;
  readonly token_expiration?: string;
  readonly two_factor_enabled?: boolean;
}

export type ApiLoginResponse = ApiResponse<ApiLoginResponseData>;
export type ApiRegisterResponse = ApiResponse<ApiRegisterResponseData>;

