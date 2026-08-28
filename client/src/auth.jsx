import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AuthContext = createContext(null);

// Intègre Google Identity Services (le script est chargé dans index.html).
// Le jeton d'identité (JWT) obtenu après connexion est envoyé au serveur dans
// l'en-tête Authorization de chaque appel API (voir api.js) — c'est lui qui
// remplace Session.getActiveUser().getEmail() côté Apps Script.
export function AuthProvider({ children }) {
  const [idToken, setIdToken] = useState(() => sessionStorage.getItem('idToken') || null);

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
    <AuthContext.Provider value={{ idToken, renderButton, signOut, forceSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
