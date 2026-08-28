// Bandeau d'identité + bandeau d'erreur communs aux 3 formulaires, et le
// bandeau de statut d'envoi (chargement / succès / erreur).
export function IdentityBox({ identite }) {
  if (!identite) return <p className="mb-4 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm">Chargement...</p>;
  if (!identite.personnel) {
    return (
      <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        ⚠️ Votre adresse mail n'est pas reconnue dans l'annuaire. Contactez un administrateur pour être ajouté.
      </p>
    );
  }
  return (
    <p className="mb-4 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm">
      Vous êtes connecté en tant que : <strong>{identite.personnel}</strong>
    </p>
  );
}

export function StatusBanner({ status }) {
  if (!status) return null;
  const styles = {
    loading: 'bg-primary-50 text-primary-700 border-primary-100',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    error: 'bg-red-50 text-red-700 border-red-300'
  };
  return (
    <p className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${styles[status.type]}`}>
      {status.text}
    </p>
  );
}

export function Field({ label, children }) {
  return (
    <label className="mb-4 block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

// Réexporté pour compat : utilisez plutôt la classe "input" directement.
export const inputClass = 'input';
