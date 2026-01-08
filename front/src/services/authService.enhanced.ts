/**
 * Enhanced Authentication Service - Secure Token Management with Auto-Refresh
 * Optimized for performance, security, and UX
 */

import { useAuthStore } from '../store/authStore';
import type { User, LoginForm, RegisterForm } from '../types';

export interface TokenPair { accessToken: string; refreshToken?: string; expiresAt: number; }
export interface RefreshResponse { token_auth: string; refresh_token: string; token_expiration: string; message: string; }
export interface AuthServiceConfig { baseURL: string; tokenRefreshBuffer: number; maxRefreshRetries: number; refreshCooldown: number; requestTimeout: number; }

export class AuthError extends Error {
  constructor(public message: string, public readonly status: number = 0, public readonly code?: string, public readonly retryable: boolean = false) { super(message); this.name='AuthError'; }
  isNetworkError(){return this.status===0;} isUnauthorized(){return this.status===401;} isForbidden(){return this.status===403;} isTooManyRequests(){return this.status===429;} isConflict(){return this.status===409;} isServerError(){return this.status>=500;} getDisplayMessage(){return this.message;}
}

class EnhancedAuthService {
  private config: AuthServiceConfig;
  private refreshPromise: Promise<TokenPair>|null=null; private lastRefreshAttempt=0; private refreshRetryCount=0;
  private readonly ACCESS_TOKEN_KEY='auth_access_token'; private readonly REFRESH_TOKEN_KEY='auth_refresh_token'; private readonly TOKEN_EXPIRY_KEY='auth_token_expiry';
  constructor(config: Partial<AuthServiceConfig> = {}) { this.config={ baseURL: process.env.REACT_APP_API_URL||'http://localhost:8001/api', tokenRefreshBuffer:5*60*1000, maxRefreshRetries:3, refreshCooldown:30*1000, requestTimeout:10000, ...config}; }
  private secureStorage={ set:(k:string,v:string)=>{try{localStorage.setItem(k,v);}catch(e){console.warn('Failed store',k,e);} }, get:(k:string):string|null=>{try{return localStorage.getItem(k);}catch(e){return null;}}, remove:(k:string)=>{try{localStorage.removeItem(k);}catch(e){console.warn('Failed remove',k,e);}}, clear:()=>{this.secureStorage.remove(this.ACCESS_TOKEN_KEY);this.secureStorage.remove(this.REFRESH_TOKEN_KEY);this.secureStorage.remove(this.TOKEN_EXPIRY_KEY);} };
  private storeTokenPair(tp:TokenPair){
    this.secureStorage.set(this.ACCESS_TOKEN_KEY,tp.accessToken);
    if (tp.refreshToken) {
      this.secureStorage.set(this.REFRESH_TOKEN_KEY,tp.refreshToken);
    } else {
      this.secureStorage.remove(this.REFRESH_TOKEN_KEY);
    }
    this.secureStorage.set(this.TOKEN_EXPIRY_KEY,tp.expiresAt.toString());
  }
  private getStoredTokenPair():TokenPair|null{
    const a=this.secureStorage.get(this.ACCESS_TOKEN_KEY);
    const r=this.secureStorage.get(this.REFRESH_TOKEN_KEY);
    const e=this.secureStorage.get(this.TOKEN_EXPIRY_KEY);
    if(!a||!e) return null;
    return {accessToken:a, refreshToken:r||undefined, expiresAt:parseInt(e,10)};
  }
  private async makeRequest<T=any>(endpoint:string,options:RequestInit={}):Promise<T>{
    const url=`${this.config.baseURL}${endpoint}`;
    const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/register');
    if(!isAuthEndpoint) await this.ensureValidToken();
    const token=this.getCurrentAccessToken();
    const headers={ 'Content-Type':'application/json','Accept':'application/json', ...(token&&!isAuthEndpoint&&{'X-Authentication':`Bearer ${token}`,'Authorization':`Bearer ${token}`}), ...(options.headers||{})};
    const controller=new AbortController();
    const timeout=setTimeout(()=>{controller.abort();}, this.config.requestTimeout);
    const cfg={...options,headers,signal:controller.signal};
    try{
      const resp=await fetch(url,cfg);
      clearTimeout(timeout);
      // Pour login/register, ne PAS tenter de refresh sur 401 - propager l'erreur directement
      if(resp.status===401 && !isAuthEndpoint){
        const refreshed=await this.refreshTokenIfNeeded(true);
        if(refreshed){
          const newToken=this.getCurrentAccessToken();
          const retryHeaders={...headers, ...(newToken&&{'X-Authentication':`Bearer ${newToken}`,'Authorization':`Bearer ${newToken}`})};
          const retryResp=await fetch(url,{...cfg,headers:retryHeaders});
          return this.handleResponse<T>(retryResp, endpoint);
        } else {
          throw new AuthError('Authentication required',401,'TOKEN_EXPIRED');
        }
      }
      return this.handleResponse<T>(resp, endpoint);
    }catch(err:any){
      clearTimeout(timeout);
      if(err?.name==='AbortError'){ throw new AuthError('Délai dépassé, serveur injoignable',0,'NETWORK_TIMEOUT',true);}
      if(err instanceof AuthError)throw err;
      throw new AuthError('Network error',0,'NETWORK_ERROR',true);
    }
  }
  private async handleResponse<T>(response:Response, endpoint?:string):Promise<T>{ if(!response.ok){ let msg:any='Request failed'; let code='REQUEST_FAILED'; let raw:any=null; try{ raw=await response.json(); const detail=raw?.detail??raw; if(typeof detail==='object'&&detail){ msg=detail.message||detail.detail||msg; code=detail.code||code; if(!code && detail.two_factor_required) code='TWO_FACTOR_REQUIRED'; } else { msg=detail?.message||detail||msg; code=raw?.code||code; }}catch{ msg=response.statusText||msg; }
      // Mapping explicite pour /auth/login en 401
      if(response.status===401){ const isLoginEndpoint = typeof endpoint==='string' && /\/auth\/login$/.test(endpoint);
        if(isLoginEndpoint){ code = code && code !== 'REQUEST_FAILED' ? code : 'INVALID_CREDENTIALS'; msg = typeof msg==='string' && msg.trim().length>0 ? msg : 'Email ou mot de passe incorrect.'; }
      }
      const headerCode=response.headers.get('X-Error-Code'); if(headerCode && (!code || code==='REQUEST_FAILED')) code=headerCode; if(Array.isArray(msg)){ msg=msg.map((e:any)=>{const loc=Array.isArray(e?.loc)?e.loc.filter((x:any)=>x!=='body').join('.'):''; return `${loc||'champ'}: ${e?.msg||e?.type||'Erreur'}`;}).join(' | ');} else if(typeof msg==='object'){ if(msg.errors && typeof msg.errors==='object'){const parts:string[]=[]; for(const k of Object.keys(msg.errors)){const arr=msg.errors[k]; if(Array.isArray(arr)) parts.push(`${k}: ${arr.join(', ')}`);} msg=parts.length?parts.join(' | '):'Données invalides';} else msg=JSON.stringify(msg);} if(response.status===422 && !code){ code='UNPROCESSABLE_ENTITY'; if(!msg || msg==='Request failed') msg='Données invalides (422). Vérifiez les champs.';} const lower=String(msg).toLowerCase(); if(response.status===400 && (!code || code==='REQUEST_FAILED')){ if(lower.includes('2fa')&&lower.includes('required')) code='TWO_FACTOR_REQUIRED'; else if(lower.includes('invalid')&&lower.includes('2fa')) code='INVALID_2FA_CODE'; } const retryable=response.status>=500||response.status===429; throw new AuthError(String(msg),response.status,code,retryable);} try{return await response.json();}catch{return {} as T;} }
  private getCurrentAccessToken():string|null{const p=this.getStoredTokenPair();return p?.accessToken||null;}
  private isTokenExpired(expiresAt:number){return Date.now() >= (expiresAt - this.config.tokenRefreshBuffer);} private shouldRefreshToken(){const p=this.getStoredTokenPair(); if(!p) return false; return this.isTokenExpired(p.expiresAt);} private async ensureValidToken(){ if(this.shouldRefreshToken()) await this.refreshTokenIfNeeded(); }
  private async refreshTokenIfNeeded(force=false):Promise<boolean>{
    const p=this.getStoredTokenPair();
    if(!p) return false;
    if(!p.refreshToken || p.refreshToken.trim().length===0) {
      // Pas de refresh token => on ne peut pas rafraîchir
      return !force && !this.shouldRefreshToken();
    }
    if(!force && !this.shouldRefreshToken()) return true;
    if(this.refreshPromise){try{await this.refreshPromise; return true;}catch{return false;}}
    const now=Date.now();
    if(now - this.lastRefreshAttempt < this.config.refreshCooldown){return false;}
    if(this.refreshRetryCount >= this.config.maxRefreshRetries){ this.logout(); return false;}
    this.lastRefreshAttempt=now; this.refreshRetryCount++;
    this.refreshPromise=this.performTokenRefresh(p.refreshToken);
    try{
      const newPair=await this.refreshPromise;
      this.storeTokenPair(newPair);
      const authStore=useAuthStore.getState();
      if (authStore.user) {
        authStore.login(authStore.user, newPair.accessToken);
      }
      this.refreshRetryCount=0; return true;
    }catch(err){ if(err instanceof AuthError && err.isUnauthorized()) this.logout(); return false;}
    finally { this.refreshPromise=null; }
  }
  private async performTokenRefresh(refreshToken:string):Promise<TokenPair>{ const resp=await fetch(`${this.config.baseURL}/auth/refresh`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refreshToken})}); if(!resp.ok){ const errData=await resp.json().catch(()=>({})); throw new AuthError(errData.detail||'Token refresh failed',resp.status,'REFRESH_FAILED'); } const data:RefreshResponse=await resp.json(); const expiresAt=data.token_expiration?new Date(data.token_expiration).getTime():Date.now()+24*60*60*1000; return {accessToken:data.token_auth,refreshToken:data.refresh_token,expiresAt}; }
  async login(credentials:LoginForm):Promise<{user:User;token:string}>{
    try {
      const payload:any={ email:credentials.email, password:credentials.password };
      if(credentials.code && credentials.code.toString().trim().length>0){ payload.code = credentials.code.toString().trim(); }
      const response=await this.makeRequest<any>('/auth/login',{method:'POST',body:JSON.stringify(payload)});
      let tokenAuth = response.token_auth || response.token || response.access_token || response.accessToken;
      let userId = response.uuid || response.user_id || response.id || response.id_user || response.userId;
      if(!tokenAuth || !userId){ if(response.two_factor_required || response.code==='TWO_FACTOR_REQUIRED') throw new AuthError('Deuxième facteur requis',400,'TWO_FACTOR_REQUIRED'); throw new AuthError('Réponse de connexion invalide (token manquant)',500,'INVALID_RESPONSE'); }
      const user:User={ id:userId, email:credentials.email, pseudo:credentials.email.split('@')[0], username:credentials.email.split('@')[0], twoFactorEnabled:!!response.two_factor_enabled };
      let expiresAt=Date.now()+24*60*60*1000; if(response.token_expiration){ try { const parsed=new Date(response.token_expiration).getTime(); if(!isNaN(parsed)) expiresAt=parsed; } catch{} }
      if(tokenAuth){ try{ const tokenPayload=JSON.parse(atob(tokenAuth.split('.')[1])); if(tokenPayload.exp) expiresAt=tokenPayload.exp*1000; }catch(e){} }
      const refreshToken = response.refresh_token || response.refreshToken || response.refresh || response.token_refresh;
      const tokenPair:TokenPair={accessToken:tokenAuth, refreshToken: refreshToken || undefined, expiresAt};
      this.storeTokenPair(tokenPair);
      useAuthStore.getState().login(user, tokenPair.accessToken);
      return {user, token:tokenPair.accessToken};
    } catch(error){
      if(error instanceof AuthError){
        const msg=(error.message||'').toLowerCase();
        if(error.status===400){
          if(msg.includes('code required')) throw new AuthError('Deuxième facteur requis',400,'TWO_FACTOR_REQUIRED');
          if(msg.includes('invalid 2fa code')||msg.includes('invalid 2fa')) throw new AuthError('Code 2FA invalide',400,'INVALID_2FA_CODE');
        }
        const isTwoFa=error.code==='TWO_FACTOR_REQUIRED'||(error.status===401 && (msg.includes('2fa')||(msg.includes('two')&&msg.includes('factor'))));
        if(isTwoFa) throw new AuthError('Deuxième facteur requis',error.status||400,'TWO_FACTOR_REQUIRED');
        if(error.status===422) throw new AuthError(error.message||'Données invalides',422,'UNPROCESSABLE_ENTITY');
      }
      // Normalisation: si 401 sans code explicite, renvoyer INVALID_CREDENTIALS
      if(!(error instanceof AuthError)) throw new AuthError('Login failed');
      if((error as AuthError).isUnauthorized() && (!(error as AuthError).code || (error as AuthError).code==='REQUEST_FAILED')){
        throw new AuthError('Email ou mot de passe incorrect.',401,'INVALID_CREDENTIALS');
      }
      throw error;
    }
  }
  async register(credentials:RegisterForm):Promise<{user:User;token:string}>{
    try {
      const response=await this.makeRequest<any>('/auth/register',{method:'POST',body:JSON.stringify({ pseudo:credentials.pseudo, email:credentials.email, password:credentials.password })});
      if(!response.token_auth || !response.uuid) throw new AuthError('Invalid registration response',500,'INVALID_RESPONSE');
      const user:User={id:response.uuid,email:credentials.email,pseudo:credentials.pseudo,username:credentials.pseudo};
      let expiresAt=Date.now()+24*60*60*1000;
      if(response.token_expiration){ try { const parsed=new Date(response.token_expiration).getTime(); if(!isNaN(parsed)) expiresAt=parsed; } catch{} }
      if(response.token_auth){ try{ const tokenPayload=JSON.parse(atob(response.token_auth.split('.')[1])); if(tokenPayload.exp) expiresAt=tokenPayload.exp*1000;}catch{} }
      const refreshToken=response.refresh_token || response.refreshToken;
      const tokenPair:TokenPair={accessToken:response.token_auth, refreshToken: refreshToken || undefined, expiresAt};
      this.storeTokenPair(tokenPair);
      useAuthStore.getState().login(user, tokenPair.accessToken);
      return {user, token:tokenPair.accessToken};
    } catch(error){ console.error('❌ Registration failed:',error); throw error instanceof AuthError?error:new AuthError('Registration failed'); }
  }
  async validateToken():Promise<{user:User}>{ const token=this.getCurrentAccessToken(); if(!token) throw new AuthError('No token available',401,'NO_TOKEN'); try { const tokenPayload=JSON.parse(atob(token.split('.')[1])); const user={ id:tokenPayload.id||tokenPayload.user_id, email:tokenPayload.sub||tokenPayload.email, username:tokenPayload.username||tokenPayload.pseudo, pseudo:tokenPayload.pseudo }; return {user}; } catch(err){ throw new AuthError('Invalid token format',401,'INVALID_TOKEN'); } }
  async logout():Promise<void>{ try { await this.makeRequest('/auth/logout',{method:'POST'}); } catch(e){ console.warn('Server logout failed:',e); } finally { this.secureStorage.clear(); this.refreshPromise=null; this.refreshRetryCount=0; localStorage.removeItem('auth_token');localStorage.removeItem('refresh_token');localStorage.removeItem('user_data');localStorage.removeItem('token_expiry'); sessionStorage.clear(); (window as any).__AUTH_INITIALIZED__=false; useAuthStore.getState().logout(); } }
  isAuthenticated():boolean{ const p=this.getStoredTokenPair(); if(!p) return false; return !this.isTokenExpired(p.expiresAt); }
  getCurrentToken():string|null{ return this.getCurrentAccessToken(); }
  getTokenExpiryTime():number|null{ const p=this.getStoredTokenPair(); return p?.expiresAt||null; }
  getTimeUntilExpiry():number{ const exp=this.getTokenExpiryTime(); if(!exp) return 0; return Math.max(0, exp - Date.now()); }
  async forceRefresh():Promise<boolean>{ return this.refreshTokenIfNeeded(true);} }

export const enhancedAuthService=new EnhancedAuthService();
export default enhancedAuthService;
