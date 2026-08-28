import { Link } from 'react-router-dom';

// Conteneur commun à toutes les pages internes : pleine largeur avec marges
// réduites sur mobile, largeur maximale confortable sur desktop. `wide` élargit
// le conteneur (Admin, Dashboard : tableaux) ; sinon le contenu est regroupé
// dans une carte blanche (formulaires, menu).
export default function Layout({ children, back, wide }) {
  return (
    <div className={`mx-auto w-full px-3 py-6 sm:px-6 sm:py-10 ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}>
      {back && (
        <Link to={back} className="btn-secondary mb-4 inline-flex items-center gap-1.5">
          ← Retour au menu
        </Link>
      )}
      {wide ? children : <div className="card">{children}</div>}
    </div>
  );
}

// Logo de l'établissement, servi par /api/logo (voir server/routes.js et
// server/drive.js). S'efface silencieusement si le fichier est introuvable /
// LOGO_FILE_ID absent, plutôt que d'afficher une icône d'image cassée.
export function Logo({ className = 'h-20 w-auto' }) {
  return (
    <img
      src="/api/logo"
      alt="Logo"
      className={className}
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
}

// Bandeau du haut, persistant sur toutes les pages une fois connecté : logo +
// nom de l'appli à gauche, email + déconnexion à droite. Remplace la version
// précédente où chaque page réaffichait son propre logo centré.
export function Topbar({ me, onSignOut }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <Logo className="h-8 w-auto shrink-0" />
          <span className="truncate text-sm font-bold text-slate-800 sm:text-base">Suivi Heures Supp</span>
        </Link>
        {me && (
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden max-w-[220px] truncate text-xs text-slate-500 sm:inline">{me.email}</span>
            <button onClick={onSignOut} className="btn-secondary !px-3 !py-1.5 text-xs">
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
