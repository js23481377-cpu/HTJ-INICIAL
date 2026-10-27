// Credenciales actualizadas de Supabase
const SUPABASE_URL = 'https://okihugbwtxbycvjiskyf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9raWh1Z2J3dHhieWN2amlza3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNDMxODQsImV4cCI6MjEwODYxOTE4NH0.tUIXj2-LHngS4pEn36XSk9kVs2GvFDXKhlZDA0tgnR8';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof lucide !== 'undefined') lucide.createIcons();

  const localUserData = localStorage.getItem('life_trading_user');
  const currentUser = localUserData ? JSON.parse(localUserData) : null;

  const btnJoinRanking = document.getElementById('btnJoinRanking');
  const btnJoinText = document.getElementById('btnJoinText');
  const rankingStatusMsg = document.getElementById('rankingStatusMsg');

  // Actualizar UI Sidebar
  if (currentUser && currentUser.username) {
    const upperName = currentUser.username.toUpperCase();
    const sidebarUserName = document.getElementById('sidebarUserName');
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    if (sidebarUserName) sidebarUserName.textContent = upperName;
    if (sidebarAvatar) sidebarAvatar.textContent = upperName.charAt(0);
  }

  // Verificar estado
  async function checkUserStatus() {
    if (!currentUser) return;
    const { data: profile } = await db.from('profiles').select('is_approved').eq('id', currentUser.id).maybeSingle();
    if (profile && profile.is_approved) setButtonActiveState();
  }

  function setButtonActiveState() {
    if (btnJoinRanking) {
      btnJoinRanking.style.background = 'rgba(34, 197, 94, 0.15)';
      btnJoinRanking.style.color = '#22c55e';
      btnJoinRanking.style.border = '1px solid #22c55e';
      if (btnJoinText) btnJoinText.textContent = '✓ Ya estás en el Ranking';
    }
  }

  // BOTÓN PARTICIPAR (INSERCIÓN FORZOSA SI NO EXISTE)
  if (btnJoinRanking) {
    btnJoinRanking.addEventListener('click', async () => {
      if (!currentUser) return alert('Debes iniciar sesión primero.');
      btnJoinRanking.disabled = true;
      if (btnJoinText) btnJoinText.textContent = 'Activando...';

      try {
        // 1. Intentar actualizar si el perfil existe
        const { data: updated } = await db
          .from('profiles')
          .update({ is_approved: true })
          .eq('id', currentUser.id)
          .select();

        // 2. Si no existe, insertarlo a la fuerza
        if (!updated || updated.length === 0) {
          await db.from('profiles').insert([{
            id: currentUser.id,
            email: currentUser.email,
            username: currentUser.username || 'Trader',
            is_approved: true
          }]);
        }

        setButtonActiveState();
        if (rankingStatusMsg) {
          rankingStatusMsg.style.display = 'block';
          rankingStatusMsg.style.color = '#22c55e';
          rankingStatusMsg.textContent = '¡Perfil activado! Ya apareces en la tabla.';
        }
        await loadLeaderboard();
      } catch (err) {
        console.error("Error al participar:", err);
      } finally {
        btnJoinRanking.disabled = false;
      }
    });
  }

  // CARGAR LEADERBOARD
  async function loadLeaderboard() {
    const tbody = document.getElementById('leaderboardBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Calculando ranking del mes en vivo...</td></tr>`;

    try {
      // Pedir solo datos seguros para evitar crashes
      const { data: profiles, error: profErr } = await db
        .from('profiles')
        .select('id, username, email')
        .eq('is_approved', true);

      if (profErr) {
        console.error("Error perfiles:", profErr);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #ef4444;">Error de conexión. Revisa consola.</td></tr>`;
        return;
      }

      // Trades del mes actual
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { data: trades } = await db
        .from('trades')
        .select('*')
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      if (!profiles || profiles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Aún no hay traders participando. ¡Únete al ranking!</td></tr>`;
        return;
      }

      const BASE_CAPITAL = 1000; // Base estándar para todos

      const leaderboard = profiles.map(user => {
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
        const profitPercent = (totalPnl / BASE_CAPITAL) * 100;

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

      leaderboard.sort((a, b) => b.profitPercent - a.profitPercent);

      tbody.innerHTML = '';
      leaderboard.forEach((trader, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--card-border)';
        tr.style.height = '48px';

        if (currentUser && currentUser.id === trader.id) {
          tr.style.background = 'rgba(34, 197, 94, 0.05)';
        }

        let posDisplay = `#${index + 1}`;
        if (index === 0) posDisplay = '🥇 1';
        else if (index === 1) posDisplay = '🥈 2';
        else if (index === 2) posDisplay = '🥉 3';

        const pnlColor = trader.profitPercent >= 0 ? '#22c55e' : '#ef4444';
        const sign = trader.profitPercent > 0 ? '+' : '';

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

  // Logout Sidebar
  document.querySelectorAll('.btn-logout').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('¿Deseas cerrar sesión?')) {
        localStorage.removeItem('life_trading_user');
        window.location.href = 'login.html';
      }
    });
  });
});