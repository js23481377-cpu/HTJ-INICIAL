// =========================================================
// GUARDIÁN ESTRICTO (NIVEL COMERCIAL) - LIFE TRADING
// =========================================================

// 1. CANDADO VISUAL: Ocultar toda la página inmediatamente
document.documentElement.style.visibility = 'hidden';

// 2. BLOQUEO TOTAL ANTI-INSPECCIÓN (Mac & Windows/Linux)
document.addEventListener('contextmenu', e => e.preventDefault()); // Bloquea click derecho

document.addEventListener('keydown', (e) => {
  const isCmdOrCtrl = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  // Bloquear F12
  if (e.key === 'F12') {
    e.preventDefault();
  }

  // Bloquear Ctrl+U / Cmd+U (Ver código), Ctrl+S / Cmd+S (Guardar), Ctrl+P / Cmd+P (Imprimir)
  if (isCmdOrCtrl && (key === 'u' || key === 's' || key === 'p' || key === 'f')) {
    e.preventDefault();
  }

  // Bloquear Ctrl+Shift+I, C, J (Windows/Linux) y Cmd+Shift+C (Mac)
  if (isCmdOrCtrl && e.shiftKey && (key === 'i' || key === 'c' || key === 'j')) {
    e.preventDefault();
  }

  // Bloquear Cmd+Option+I, Cmd+Option+J, Cmd+Option+C (Exclusivo Mac)
  if (e.metaKey && e.altKey && (key === 'i' || key === 'c' || key === 'j')) {
    e.preventDefault();
  }
});

// TRAMPA DE DEPURADOR: Congela la pestaña si abren la consola
setInterval(() => {
  debugger;
}, 100);

(function initGuard() {
  const LOGIN_PAGE = 'login.html';

  function enforceKick() {
    localStorage.removeItem('life_trading_user');
    window.location.replace(LOGIN_PAGE);
  }

  // 3. VERIFICACIÓN LOCAL INMEDIATA
  const currentUser = localStorage.getItem('life_trading_user');
  if (!currentUser) {
    enforceKick();
    return;
  }

  // Si pasa la revisión local, hacemos visible la página
  document.documentElement.style.visibility = 'visible';

  // 4. CAZADOR DEL BOTÓN "ATRÁS" (BFCache)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted || !localStorage.getItem('life_trading_user')) {
      if (!localStorage.getItem('life_trading_user')) {
        enforceKick();
      }
    }
  });

  // 5. VERIFICACIÓN EN LA NUBE
  document.addEventListener('DOMContentLoaded', async () => {
    let userData = null;

    try {
      userData = JSON.parse(currentUser);
      
      const userNameEl = document.querySelector('.user-profile .user-name');
      const avatarEl = document.querySelector('.user-profile .avatar');
      if (userNameEl && userData.username) userNameEl.textContent = userData.username.toUpperCase();
      if (avatarEl && userData.username) avatarEl.textContent = userData.username.charAt(0).toUpperCase();
    } catch (e) {
      enforceKick();
      return;
    }

    if (typeof supabase !== 'undefined' && userData) {
      try {
        // CREDENCIALES ACTUALIZADAS DE SUPABASE
        const SUPABASE_URL = 'https://okihugbwtxbycvjiskyf.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9raWh1Z2J3dHhieWN2amlza3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNDMxODQsImV4cCI6MjEwODYxOTE4NH0.tUIXj2-LHngS4pEn36XSk9kVs2GvFDXKhlZDA0tgnR8';
        
        const localDb = (typeof window.db !== 'undefined') ? window.db : supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        const query = userData.id 
          ? localDb.from('profiles').select('id, is_approved').eq('id', userData.id).maybeSingle()
          : localDb.from('profiles').select('id, is_approved').eq('email', userData.email).maybeSingle();

        const { data: profile, error } = await query;

        if (error || !profile || profile.is_approved === false) {
          enforceKick();
          return;
        }
      } catch (err) {
        console.error('Error del Guardián:', err);
      }
    }

    // 6. BOTÓN DE CERRAR SESIÓN SEGURO
    const logoutBtns = document.querySelectorAll('.btn-logout');
    logoutBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('¿Deseas cerrar sesión de forma segura?')) {
          enforceKick();
        }
      });
    });
  });
})();
