/**
 * Authentication Service - TypeScript version
 * Secure authentication with comprehensive error handling
 */

/** Legacy Authentication Service (restored) */
import { apiClient, ApiClientError } from './apiClient';
import type { User, LoginForm, RegisterForm, LoginResponse, RegisterResponse } from '../types';

export class AuthError extends Error { constructor(public message:string, public readonly status:number=0, public readonly code?:string, public readonly data?:unknown){ super(message); this.name='AuthError'; }
  isNetworkError(){return this.status===0;} isTimeout(){return this.status===408;} isUnauthorized(){return this.status===401;} isForbidden(){return this.status===403;} isConflict(){return this.status===409;} isTooManyRequests(){return this.status===429;} isServerError(){return this.status>=500;} isValidationError(){return this.status===422;} getDisplayMessage(){return this.message;} }

class LoginAttemptTracker { private attempts=new Map<string,{count:number;last:number;lock?:number}>(); private MAX=5; private LOCK=15*60*1000; private WINDOW=60*60*1000; isBlocked(id:string){const r=this.attempts.get(id); if(!r) return false; if(r.lock && Date.now()<r.lock) return true; if(Date.now()-r.last>this.WINDOW){this.attempts.delete(id); return false;} return r.count>=this.MAX;} record(id:string, success:boolean){ if(success){this.attempts.delete(id); return;} const now=Date.now(); const r=this.attempts.get(id)||{count:0,last:0}; r.count++; r.last=now; if(r.count>=this.MAX) r.lock=now+this.LOCK; this.attempts.set(id,r);} remaining(id:string){const r=this.attempts.get(id); return r?.lock?Math.max(0,r.lock-Date.now()):0;} }

class AuthService { private tracker=new LoginAttemptTracker(); private TOKEN_KEY='authToken'; private REFRESH_KEY='refreshToken';
  private validateEmail(email:string){const t=email.toLowerCase().trim(); const re=/^[^\s@]+@[^\s@]+\.[^\s@]+$/; if(!re.test(t)) throw new AuthError('Format d\'email invalide',400,'INVALID_EMAIL'); if(t.length>320) throw new AuthError('Email trop long',400,'EMAIL_TOO_LONG'); return t; }
  private validatePassword(p:string){ if(!p) throw new AuthError('Mot de passe requis',400,'PASSWORD_REQUIRED'); if(p.length<6) throw new AuthError('Mot de passe trop court (minimum 6 caractères)',400,'PASSWORD_TOO_SHORT'); if(p.length>128) throw new AuthError('Mot de passe trop long (maximum 128 caractères)',400,'PASSWORD_TOO_LONG'); return p; }
  private validatePseudo(p:string){ const t=p.trim(); if(!t) throw new AuthError('Pseudo requis',400,'PSEUDO_REQUIRED'); if(t.length<2) throw new AuthError('Pseudo trop court',400,'PSEUDO_TOO_SHORT'); if(t.length>50) throw new AuthError('Pseudo trop long',400,'PSEUDO_TOO_LONG'); if(!/^[a-zA-Z0-9\s\-_\.]+$/.test(t)) throw new AuthError('Pseudo contient des caractères non autorisés',400,'PSEUDO_INVALID_CHARS'); return t; }
  private storeToken(token:string, refresh?:string){ try{localStorage.setItem(this.TOKEN_KEY,token); if(refresh) localStorage.setItem(this.REFRESH_KEY,refresh);}catch(e){console.warn('Store token failed',e);} }
  private getToken(){ try{ return localStorage.getItem(this.TOKEN_KEY);}catch{return null;} }
  private getRefresh(){ try{ return localStorage.getItem(this.REFRESH_KEY);}catch{return null;} }
  private clear(){ try{localStorage.removeItem(this.TOKEN_KEY);localStorage.removeItem(this.REFRESH_KEY);}catch{}}
  private handleApiError(error:any):never { if(error instanceof ApiClientError){ throw new AuthError(error.message,error.status,error.code,error.details);} if(error instanceof Error) throw new AuthError(error.message,0,'UNKNOWN_ERROR',error); throw new AuthError('Erreur inconnue',0); }

  async login(credentials:LoginForm):Promise<LoginResponse>{ const email=this.validateEmail(credentials.email); const password=this.validatePassword(credentials.password); if(this.tracker.isBlocked(email)){ const minutes=Math.ceil(this.tracker.remaining(email)/60000); throw new AuthError(`Compte temporairement bloqué. Réessayez dans ${minutes} minute(s).`,429,'ACCOUNT_LOCKED'); }
    try { const payload={ email, password, code: credentials.code?credentials.code.trim():'' }; const resp:any=await apiClient.post('/auth/login',payload); if(!resp.success||!resp.data) throw new AuthError('Réponse invalide du serveur',500); if(!resp.data.token_auth||!resp.data.uuid){ if(resp.data?.detail && /2fa/i.test(resp.data.detail)) throw new AuthError('Deuxième facteur requis',400,'TWO_FACTOR_REQUIRED'); throw new AuthError('Données de connexion incomplètes',500); } this.storeToken(resp.data.token_auth); this.tracker.record(email,true); return resp; } catch(e:any){ if(credentials.email) this.tracker.record(email,false); if(e instanceof ApiClientError && e.status===400){ const lower=(e.message||'').toLowerCase(); if(lower.includes('2fa')&&lower.includes('required')) throw new AuthError('Deuxième facteur requis',400,'TWO_FACTOR_REQUIRED'); if(lower.includes('invalid')&&lower.includes('2fa')) throw new AuthError('Code 2FA invalide',400,'INVALID_2FA_CODE'); } this.handleApiError(e); }
  }

  async register(credentials:RegisterForm):Promise<RegisterResponse>{ const email=this.validateEmail(credentials.email); const password=this.validatePassword(credentials.password); const pseudo=this.validatePseudo(credentials.pseudo); if(password!==credentials.confirmPassword) throw new AuthError('Les mots de passe ne correspondent pas',400,'PASSWORDS_MISMATCH'); if(!credentials.acceptTerms) throw new AuthError('Vous devez accepter les conditions d\'utilisation',400,'TERMS_NOT_ACCEPTED'); try { const payload={ pseudo, email, password }; const resp:any=await apiClient.post('/auth/register',payload); if(!resp.success||!resp.data) throw new AuthError('Réponse invalide du serveur',500); if(!resp.data.token_auth||!resp.data.uuid) throw new AuthError('Données d\'inscription incomplètes',500); this.storeToken(resp.data.token_auth); return resp; } catch(e){ this.handleApiError(e);} }

  async validateToken(){ const token=this.getToken(); if(!token) throw new AuthError('Aucun token trouvé',401,'NO_TOKEN'); try { const payload=JSON.parse(atob(token.split('.')[1])); const user:User={ id:payload.id||payload.user_id, email:payload.sub||payload.email, username:payload.username||payload.pseudo, pseudo:payload.pseudo }; return { user, valid:true, expires_at:new Date(payload.exp*1000).toISOString() }; } catch{ throw new AuthError('Token invalide',401,'INVALID_TOKEN'); } }
  async refreshToken(){ const r=this.getRefresh(); if(!r) throw new AuthError('Aucun refresh token trouvé',401,'NO_REFRESH_TOKEN'); try{ const resp:any=await apiClient.post('/auth/refresh',{refresh_token:r}); if(!resp.success||!resp.data) throw new AuthError('Actualisation du token échouée',401,'REFRESH_FAILED'); this.storeToken(resp.data.token_auth); return resp.data; }catch(e){ this.clear(); this.handleApiError(e);} }
  async logout(){ try{ const t=this.getToken(); if(t){ try{await apiClient.post('/auth/logout');}catch{}} this.clear(); } catch(e){ this.clear(); }
  }
  isAuthenticated(){ return !!this.getToken(); }
  getCurrentToken(){ return this.getToken(); }
  checkPasswordStrength(password:string){ const feedback:string[]=[]; let score=0; if(password.length>=8)score++; else feedback.push('Au moins 8 caractères'); if(/[a-z]/.test(password))score++; else feedback.push('Au moins une minuscule'); if(/[A-Z]/.test(password))score++; else feedback.push('Au moins une majuscule'); if(/\d/.test(password))score++; else feedback.push('Au moins un chiffre'); if(/[^a-zA-Z\d]/.test(password))score++; else feedback.push('Au moins un caractère spécial'); return {score,feedback,isStrong:score>=4}; }
}
export const authService=new AuthService();
export default authService;
