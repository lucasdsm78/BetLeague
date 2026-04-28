export interface ApiDeleteMyAccountRequest {
  current_password: string;
  two_fa_code?: string;
}

export interface ApiDeleteMyAccountResponse {
  message: string;
}

