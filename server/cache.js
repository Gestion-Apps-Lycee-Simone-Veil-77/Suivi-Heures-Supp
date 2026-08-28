// Petit cache mémoire (équivalent simplifié de CacheService côté Apps Script) :
// utile pour éviter de relire les onglets Config* et le statut admin à chaque
// requête. Se vide tout seul au redémarrage du serveur — sans conséquence,
// puisqu'il ne sert qu'à accélérer, jamais de source de vérité.
const store = new Map();

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { store.delete(key); return undefined; }
  return entry.value;
}

export function cacheSet(key, value, ttlSeconds) {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function cacheDel(key) {
  store.delete(key);
}

// Supprime toutes les entrées dont la clé commence par `prefix` (ex: purger
// tous les "isAdmin_xxx@yyy.fr" d'un coup sans connaître chaque email).
export function cacheDelPrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
