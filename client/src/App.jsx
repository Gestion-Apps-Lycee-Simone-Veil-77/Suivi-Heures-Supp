import { useEffect, useRef, useState, useCallback } from 'react';
import { Routes, Route, Outlet, useOutletContext, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { createApi } from './api.js';
import Menu from './pages/Menu.jsx';
import FormHSE from './pages/FormHSE.jsx';
import FormPACTE from './pages/FormPACTE.jsx';
import FormHNF from './pages/FormHNF.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Admin from './pages/Admin.jsx';
import { Logo, Topbar } from './components/Layout.jsx';

function LoginScreen() {
  const { renderButton } = useAuth();
  const ref = useRef(null);
  useEffect(() => { renderButton(ref.current); }, [renderButton]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary-50 to-slate-100 px-4">
      <div className="card flex w-full max-w-sm flex-col items-center text-center">
        <Logo className="mb-4 h-20 w-auto" />
        <h1 className="mb-1.5 text-xl font-bold text-slate-900">Suivi Heures Supp</h1>
        <p className="mb-6 text-sm text-slate-500">Connectez-vous avec votre compte de l'établissement.</p>
        <div ref={ref} />
      </div>
    </div>
  );
}

function Shell() {
  const { idToken, forceSignOut, signOut } = useAuth();
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const api = createApi(idToken, forceSignOut);
  const location = useLocation();

  const loadMe = useCallback(() => {
    api.get('/me').then(setMe).catch(err => setError(err.message));
  }, [idToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recharge l'identité (dont isAdmin) à chaque changement de page, pas
  // seulement une fois au chargement de l'appli. Sans ça, une fois connecté
  // dans l'onglet, le statut admin ne bougeait plus jusqu'au prochain F5 —
  // même après avoir modifié ConfigAdmin et attendu que le cache serveur
  // expire, le bouton "Administration" du menu restait figé sur l'ancien état.
  useEffect(() => { loadMe(); }, [loadMe, location.pathname]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-center text-red-600">
        Erreur : {error}
      </div>
    );
  }
  if (!me) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-400">Chargement...</div>;
  }
  return (
    <div className="min-h-screen bg-slate-100">
      <Topbar me={me} onSignOut={signOut} />
      <Outlet context={{ api, me }} />
    </div>
  );
}

export function useShell() {
  return useOutletContext();
}

export default function App() {
  const { idToken } = useAuth();
  if (!idToken) return <LoginScreen />;

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Menu />} />
        <Route path="/hse" element={<FormHSE />} />
        <Route path="/pacte" element={<FormPACTE />} />
        <Route path="/hnf" element={<FormHNF />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
    </Routes>
  );
}
