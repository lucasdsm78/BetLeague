// Typage explicite du profil utilisateur retourné par l'API
export interface UserProfile {
  id?: string;
  email?: string;
  username?: string;
  pseudo?: string;
  two_factor_enabled?: boolean; // snake_case depuis backend
  twoFactorEnabled?: boolean;   // camelCase alternative
  roles?: string[];
  permissions?: string[];
}

export default UserProfile;

