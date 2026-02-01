// DTOs API: users

export interface ApiUserSearchResult {
  id: number;
  pseudo: string;
  email: string;
}

export interface ApiUsersSearchResponse {
  users: ApiUserSearchResult[];
  total: number;
  query: string;
}

