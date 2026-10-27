// Credenciales actualizadas de Supabase
const SUPABASE_URL = 'https://okihugbwtxbycvjiskyf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9raWh1Z2J3dHhieWN2amlza3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNDMxODQsImV4cCI6MjEwODYxOTE4NH0.tUIXj2-LHngS4pEn36XSk9kVs2GvFDXKhlZDA0tgnR8';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // --- OBTENER TRADER AUTENTICADO ---
  const localUserData = localStorage.getItem('life_trading_user');
  const currentUser = localUserData ? JSON.parse(localUserData) : null;

  const btnJoinRanking = document.getElementById('btnJoinRanking');
  const btnJoinText = document.getElementById('btnJoinText');
  const rankingStatusMsg = document.getElementById('rankingStatusMsg');
  const sidebarUserName = document.getElementById('sidebarUserName');
  const sidebarAvatar = document.getElementById('sidebarAvatar');

  if (currentUser && currentUser.username) {
    const upperName = currentUser.username.toUpperCase();
    if (sidebarUserName) sidebarUserName.textContent = upperName;
    if (sidebarAvatar) sidebarAvatar.textContent = upperName.charAt(0);
  }

  // --- REVISAR ESTADO EN EL RANKING ---
  async function checkUserStatus() {
    if (!currentUser || typeof db === 'undefined') return;
    try {
      const { data: profile } = await db.from('profiles').select('is_approved').eq('id', currentUser.id).maybeSingle();
      if (profile && profile.is_approved) {
        setButtonActiveState();
      }
    } catch (err) {
      console.error('Error al verificar estado:', err);
    }
  }

  function setButtonActiveState() {
    if (btnJoinRanking) {
      btnJoinRanking.style.background = 'rgba(34, 197, 94, 0.15)';
      btnJoinRanking.style.color = '#22c55e';
      btnJoinRanking.style.border = '1px solid #22c55e';
      if (btnJoinText) btnJoinText.textContent = '✓ Ya estás en el Ranking';
    }
  }

  // --- BOTÓN PARA PARTICIPAR ---
  if (btnJoinRanking) {
    btnJoinRanking.addEventListener('click', async () => {
      if (!currentUser) return alert('Debes iniciar sesión primero.');
      btnJoinRanking.disabled = true;
      if (btnJoinText) btnJoinText.textContent = 'Activando...';

      try {
        await db.from('profiles').update({ is_approved: true }).eq('id', currentUser.id);
        setButtonActiveState();
        if (rankingStatusMsg) {
          rankingStatusMsg.style.display = 'block';
          rankingStatusMsg.style.color = '#22c55e';
          rankingStatusMsg.textContent = '¡Perfil activado! Ya apareces en la tabla de clasificación.';
        }
        await loadLeaderboard();
      } catch (err) {
        console.error(err);
      } finally {
        btnJoinRanking.disabled = false;
      }
    });
  }

  // --- CARGAR TABLA LEADERBOARD (FILTRADA SOLO MES ACTUAL) ---
  async function loadLeaderboard() {
    const tbody = document.getElementById('leaderboardBody');
    if (!tbody || typeof db === 'undefined') return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Calculando ranking del mes en vivo...</td></tr>`;

    try {
      // 1. Obtener perfiles que participan y su capital inicial
      const { data: profiles } = await db
        .from('profiles')
        .select('id, username, email, initial_balance')
        .eq('is_approved', true);

      // 2. Obtener SOLO trades de este mes (Sincronizado con el Dashboard)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { data: trades } = await db
        .from('trades')
        .select('*')
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      if (!profiles || profiles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Aún no hay traders participando.</td></tr>`;
        return;
      }

      const leaderboard = profiles.map(user => {
        // Filtrar y limpiar data
        const userTrades = (trades || []).filter(t => {
          const matchUser = (t.user_id === user.id || t.email === user.email);
          const res = (t.result || t.type || '').toUpperCase();
          return matchUser && res !== 'NOOP';
        });

        const totalOps = userTrades.length;
        let wins = 0, losses = 0, grossProfit = 0, grossLoss = 0, totalPnl = 0;

        userTrades.forEach(t => {
          const pnl = parseFloat(t.pnl) || 0;
          const res = (t.result || t.type || '').toUpperCase();
          totalPnl += pnl;

          if (res === 'TP' || pnl > 0) {
            wins++; grossProfit += pnl;
          } else if (res === 'SL' || pnl < 0) {
            losses++; grossLoss += Math.abs(pnl);
          }
        });

        const winRate = totalOps > 0 ? Math.round((wins / totalOps) * 100) : 0;
        const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 'MAX' : '0.00') : (grossProfit / grossLoss).toFixed(2);
        
        // Capital del usuario (O $1,000 por defecto si no lo configuró)
        const baseCapital = parseFloat(user.initial_balance) > 0 ? parseFloat(user.initial_balance) : 1000;
        const profitPercent = (totalPnl / baseCapital) * 100;

        return {
          id: user.id,
          username: user.username || 'Trader',
          totalOps,
          winRate,
          totalPnl,
          profitPercent,
          profitFactor
        };
      });

      // ORDENAR: Primero el % mayor
      leaderboard.sort((a, b) => b.profitPercent - a.profitPercent);

      // Renderizar la tabla
      tbody.innerHTML = '';
      leaderboard.forEach((trader, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--card-border)';
        tr.style.height = '48px';

        // Resaltar al usuario logueado
        if (currentUser && currentUser.id === trader.id) {
          tr.style.background = 'rgba(34, 197, 94, 0.05)';
        }

        let posDisplay = `#${index + 1}`;
        if (index === 0) posDisplay = '🥇 1';
        else if (index === 1) posDisplay = '🥈 2';
        else if (index === 2) posDisplay = '🥉 3';

        const pnlColor = trader.profitPercent >= 0 ? '#22c55e' : '#ef4444';
        const sign = trader.profitPercent > 0 ? '+' : '';

        // Se agregó la columna de (+$0.00) en gris para claridad
        tr.innerHTML = `
          <td style="padding: 10px; font-weight: 700;">${posDisplay}</td>
          <td style="padding: 10px; font-weight: 600; color: var(--text-main);">${trader.username}</td>
          <td style="padding: 10px; font-weight: 800; color: ${pnlColor};">
            ${sign}${trader.profitPercent.toFixed(2)}% 
            <span style="font-size: 11px; font-weight: 500; color: var(--text-muted); margin-left: 4px;">(${sign}$${trader.totalPnl.toFixed(2)})</span>
          </td>
          <td style="padding: 10px;">${trader.winRate}%</td>
          <td style="padding: 10px;">${trader.totalOps}</td>
          <td style="padding: 10px; font-weight: 700; color: #22c55e;">${trader.profitFactor}</td>
        `;
        tbody.appendChild(tr);
      });

    } catch (err) {
      console.error(err);
    }
  }

  await checkUserStatus();
  await loadLeaderboard();

  // Logout para el Sidebar de Comunidad
  const logoutBtns = document.querySelectorAll('.btn-logout');
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('¿Deseas cerrar sesión?')) {
        localStorage.removeItem('life_trading_user');
        window.location.href = 'login.html';
      }
    });
  });
});
