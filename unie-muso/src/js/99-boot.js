/* =========================================================================
   Démarrage
   ========================================================================= */
document.addEventListener('submit', (e) => { if (!e.target.closest('#modal') && e.target.id !== 'lg-form') e.preventDefault(); });
function boot() {
  loadAll();
  restoreFromNative();
  if (!store.raw(KEYS.db)) { saveDB(); }
  try {
    const s = JSON.parse(store.raw(KEYS.session) || 'null');
    if (s && ((s.type === 'user' && USERS[s.id]) || (s.type === 'member' && getMember(s.code) && getMember(s.code).statut !== 'Inactif'))) SESSION = s;
  } catch (_e) { /* session ignorée */ }
  if (SESSION) STATE.page = currentRole() === 'membre' || currentRole() === 'comite' ? 'moncompte' : 'dashboard';
  render();
  if (SESSION && typeof goOnline === 'function') goOnline();
  checkPendingImports();
  setInterval(checkAlarms, 30000); checkAlarms();
  // Une autre fenêtre ou l'application native a modifié les données
  window.addEventListener('storage', (e) => { if (e.key === KEYS.db) { loadAll(); if (!document.getElementById('modal')) render(); } });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
