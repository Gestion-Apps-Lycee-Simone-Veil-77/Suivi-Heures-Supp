import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AuthContext = createContext(null);

// Intègre Google Identity Services (le script est chargé dans index.html).
// Le jeton d'identité (JWT) obtenu après connexion est envoyé au serveur dans
// l'en-tête Authorization de chaque appel API (voir api.js) — c'est lui qui
// remplace Session.getActiveUser().getEmail() côté Apps Script.
export function AuthProvider({ children }) {
  const [idToken, setIdToken] = useState(() => sessionStorage.getItem('idToken') || null);
  // Passe à true seulement une fois initialize() effectivement appelé. Sans
  // ça, LoginScreen pouvait tenter d'afficher le bouton avant que le script
  // Google soit prêt (condition de course, plus visible en prod qu'en local
  // selon la vitesse de chargement du script) : "Failed to render button
  // before calling initialize()" et bouton absent.
  const [gisReady, setGisReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function init() {
      if (cancelled) return;
      if (!window.google?.accounts?.id) { setTimeout(init, 150); return; }
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
        callback: (resp) => {
          sessionStorage.setItem('idToken', resp.credential);
          setIdToken(resp.credential);
        },
        auto_select: true
      });
      setGisReady(true);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const renderButton = useCallback((el) => {
    if (el && window.google?.accounts?.id) {
      el.innerHTML = '';
      window.google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', width: 280, locale: 'fr' });
    }
  }, []);

  const signOut = useCallback(() => {
    sessionStorage.removeItem('idToken');
    setIdToken(null);
    window.google?.accounts?.id?.disableAutoSelect();
  }, []);

  // Appelé par api.js quand le serveur renvoie 401 (jeton expiré/invalide) :
  // on force une reconnexion propre plutôt que de rester bloqué sur des erreurs.
  const forceSignOut = signOut;

  return (
    <AuthContext.Provider value={{ idToken, renderButton, signOut, forceSignOut, gisReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
