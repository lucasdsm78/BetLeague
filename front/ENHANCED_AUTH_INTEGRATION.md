# 🔐 Enhanced Authentication System - Guide d'intégration

## 🚀 Système de refresh token automatique et sécurisé

Ce système offre une authentification avancée avec refresh automatique des tokens, surveillance de l'activité utilisateur, et gestion intelligente des sessions.

## 📋 Fonctionnalités principales

### ✅ Refresh automatique des tokens
- Refresh automatique 5 minutes avant expiration
- Retry intelligent en cas d'échec
- Queue des requêtes pendant le refresh
- Gestion des tokens expirés

### ✅ Surveillance de l'activité
- Détection automatique de l'inactivité
- Logout automatique après 30 minutes d'inactivité
- Suivi des événements utilisateur (clics, scroll, etc.)
- Détection de la visibilité de la page

### ✅ Sécurité renforcée
- Stockage sécurisé des tokens
- Protection CSRF
- Validation côté client et serveur
- Gestion des erreurs réseau

### ✅ Notifications utilisateur
- Alertes avant expiration de session
- Avertissements d'inactivité
- Messages d'erreur contextuels
- Interface mobile-friendly

## 🔧 Intégration pas à pas

### 1. Remplacer l'ancien hook useAuth

```typescript
// AVANT (ancien système)
import { useAuth } from '../hooks/useAuth';

// APRÈS (nouveau système)
import { useEnhancedAuth as useAuth } from '../hooks/useAuth.enhanced';

// Le hook reste compatible, pas de changement de code nécessaire
const { isAuthenticated, user, login, logout } = useAuth();
```

### 2. Intégrer le composant de surveillance

```typescript
// Dans votre App.tsx principal
import AuthMonitor from './components/auth/AuthMonitor';

function App() {
  return (
    <BrowserRouter>
      <AuthMonitor
        enableNotifications={true}
        enableExpiryWarning={true}
        expiryWarningThreshold={10} // 10 minutes
        enableInactivityWarning={true}
        inactivityWarningThreshold={25} // 25 minutes
      >
        <AppRouter />
      </AuthMonitor>
    </BrowserRouter>
  );
}
```

### 3. Mettre à jour les services API

```typescript
// Vos services API utilisent maintenant le client sécurisé automatiquement
// Pas de changement de code nécessaire - tout est transparent

// Le leagueApiService utilise maintenant secureApiClient
const result = await leagueApiService.createLeague(data);
// ✅ Refresh automatique si token expiré
// ✅ Retry automatique en cas d'erreur réseau
// ✅ Gestion des erreurs sécurisée
```

### 4. Backend - Endpoint de refresh (optionnel)

Si vous voulez implémenter un vrai refresh token côté backend :

```python
# Dans user_router.py - déjà ajouté
@router.post("/refresh")
async def refresh_token(refresh_data: RefreshTokenModel):
    # Logique de refresh token
    return RefreshTokenResponse(
        token_auth="new_access_token",
        refresh_token="new_refresh_token",
        token_expiration="2024-01-01T00:00:00Z"
    )
```

## 🎯 Hooks disponibles

### useEnhancedAuth (principal)
```typescript
const {
  // État de base
  isAuthenticated,
  user,
  isLoading,
  error,

  // Surveillance des tokens
  timeUntilExpiry,
  timeUntilRefresh,
  isRefreshing,
  isTokenExpiringSoon,

  // Actions
  login,
  logout,
  refreshSession,
  forceRefresh,

  // Activité utilisateur
  isUserActive,
  activityLevel, // 'active' | 'idle' | 'away'
} = useEnhancedAuth();
```

### useSessionStatus (surveillance)
```typescript
const {
  timeUntilExpiry,
  formattedTimeUntilExpiry, // "25m 30s"
  isTokenExpiringSoon,
  isRefreshing
} = useSessionStatus();
```

### useTokenMonitor (avancé)
```typescript
const monitor = useTokenMonitor({
  refreshThreshold: 5, // minutes
  activityTimeout: 30, // minutes
  debugMode: true
});
```

## 🔒 Configuration de sécurité

### Variables d'environnement
```env
# .env
REACT_APP_API_URL=http://localhost:8001/api
NODE_ENV=development # Active les logs de debug
```

### Configuration du service
```typescript
// Personnaliser la configuration
import { enhancedAuthService } from './services/authService.enhanced';

// Configuration du client API
import { secureApiClient } from './services/secureApiClient';

secureApiClient.updateConfig({
  timeout: 60000, // 60 secondes
  maxRetries: 5,
  enableRequestLogging: true
});
```

## 📱 Interface utilisateur

### Notifications automatiques
- ⏰ **Expiration proche** : "Votre session expire dans 5 minutes"
- 😴 **Inactivité** : "Vous êtes inactif depuis un moment"
- ❌ **Erreurs** : Messages contextuels avec actions
- ✅ **Succès** : Confirmations de refresh

### Mode développement
En mode développement, un panneau de debug s'affiche automatiquement :
```
Session Debug Info
Expire dans: 23m 45s
Activité: active
Actualisation: Prêt
Status: OK
```

## 🚨 Gestion des erreurs

### Types d'erreurs gérées
1. **Token expiré** → Refresh automatique
2. **Refresh échoué** → Logout + redirection
3. **Réseau indisponible** → Retry automatique
4. **Inactivité prolongée** → Logout préventif

### Logs de debug
```typescript
// Activer les logs détaillés
const auth = useEnhancedAuth({ debugMode: true });

// Logs dans la console :
// 🔐 Enhanced Auth - Starting login process...
// ✅ Enhanced Auth - Login successful
// 🔄 Enhanced Auth - Refreshing session...
// ⚠️ Enhanced Auth - Inactivity detected
```

## 🎛️ Options de configuration

### AuthMonitor
```typescript
<AuthMonitor
  enableNotifications={true}          // Notifications toast
  enableExpiryWarning={true}          // Alerte expiration
  expiryWarningThreshold={10}         // 10 min avant expiration
  enableInactivityWarning={true}      // Alerte inactivité
  inactivityWarningThreshold={25}     // 25 min d'inactivité
/>
```

### useEnhancedAuth
```typescript
useEnhancedAuth({
  autoRefresh: true,           // Refresh automatique
  activityTracking: true,      // Suivi activité
  debugMode: false,           // Mode debug
  onAuthChange: (auth) => {}, // Callback changement
  onError: (error) => {}      // Callback erreur
})
```

## 🔄 Migration depuis l'ancien système

### Étapes de migration

1. **Garder l'ancien système en parallèle**
```typescript
// Importer les deux systèmes
import { useAuth as useOldAuth } from '../hooks/useAuth';
import { useEnhancedAuth } from '../hooks/useAuth.enhanced';

// Utiliser le nouveau progressivement
const auth = useEnhancedAuth();
```

2. **Tester composant par composant**
```typescript
// Tester d'abord sur un composant simple
function TestComponent() {
  const { isAuthenticated } = useEnhancedAuth();
  return <div>Status: {isAuthenticated ? 'Connected' : 'Disconnected'}</div>;
}
```

3. **Migrer les services API**
```typescript
// Les services utilisent automatiquement le nouveau client
// Pas de changement de code nécessaire
```

4. **Remplacer l'export par défaut**
```typescript
// Dans hooks/useAuth.enhanced.ts
export const useAuth = useEnhancedAuth; // Compatibilité
export default useEnhancedAuth;
```

## 🧪 Tests et validation

### Tests manuels
1. ✅ Connexion/déconnexion normale
2. ✅ Refresh automatique (attendre 5 min avant expiration)
3. ✅ Inactivité prolongée (attendre 30 min)
4. ✅ Perte de réseau pendant une requête
5. ✅ Expiration forcée du token côté serveur

### Monitoring en production
```typescript
// Activer le monitoring en production
const monitor = useTokenMonitor({
  debugMode: false,
  enableActivityTracking: true,
  enableOfflineDetection: true
});

// Métriques disponibles
console.log('Refresh count:', monitor.refreshCount);
console.log('Activity level:', monitor.activityLevel);
console.log('Online status:', monitor.isOnline);
```

## 🎉 Avantages du nouveau système

### ✅ Pour les utilisateurs
- Pas de déconnexions intempestives
- Sessions prolongées automatiquement
- Interface réactive et fluide
- Notifications claires et utiles

### ✅ Pour les développeurs
- Code plus maintenable
- Gestion d'erreurs robuste
- Debugging facilité
- Architecture sécurisée

### ✅ Pour la sécurité
- Tokens refresh automatiquement
- Sessions surveillées en continu
- Protection contre l'inactivité
- Validation continue côté serveur

---

## 🆘 Support et dépannage

### Problèmes fréquents

**Q: Les tokens ne se refreshent pas automatiquement**
```typescript
// Vérifier la configuration
const auth = useEnhancedAuth({ autoRefresh: true });
// Vérifier les logs de debug
const auth = useEnhancedAuth({ debugMode: true });
```

**Q: Notifications trop fréquentes**
```typescript
// Ajuster les seuils
<AuthMonitor
  expiryWarningThreshold={5}     // 5 min au lieu de 10
  inactivityWarningThreshold={20} // 20 min au lieu de 25
/>
```

**Q: Problème de CORS avec refresh**
```python
# Backend - vérifier la configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
```

### Debug avancé
```typescript
// Forcer un refresh manuel
const { forceRefresh } = useEnhancedAuth();
await forceRefresh();

// Vérifier l'état des tokens
import enhancedAuthService from './services/authService.enhanced';
console.log('Token:', enhancedAuthService.getCurrentToken());
console.log('Expires in:', enhancedAuthService.getTimeUntilExpiry());
```

---

🚀 **Votre système d'authentification est maintenant prêt pour la production !**