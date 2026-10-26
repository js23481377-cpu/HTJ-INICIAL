// Credenciales baro ti Supabase
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
    if (sidebarUserName) sidebarUserName.textContent = currentUser.username;
    if (sidebarAvatar) sidebarAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
  }

  // --- REVISAR SI EL USUARIO YA ESTÁ ACTIVO EN EL RANKING ---
  async function checkUserStatus() {
    if (!currentUser || typeof db === 'undefined') return;

    try {
      const query = currentUser.id 
        ? db.from('profiles').select('is_approved').eq('id', currentUser.id).maybeSingle()
        : db.from('profiles').select('is_approved').eq('email', currentUser.email).maybeSingle();

      const { data: userProfile } = await query;

      if (userProfile && userProfile.is_approved) {
        setButtonActiveState();
      }
    } catch (err) {
      console.error('Error al verificar estado del perfil:', err);
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

  // --- ACTIVAR MI PERFIL AL PRESIONAR EL BOTÓN ---
  if (btnJoinRanking) {
    btnJoinRanking.addEventListener('click', async () => {
      if (!currentUser || (!currentUser.id && !currentUser.email)) {
        alert('Debes iniciar sesión primero para participar.');
        return;
      }

      btnJoinRanking.disabled = true;
      if (btnJoinText) btnJoinText.textContent = 'Activando...';

      try {
        if (currentUser.id) {
          await db
            .from('profiles')
            .update({ is_approved: true })
            .eq('id', currentUser.id);
        } else {
          await db
            .from('profiles')
            .update({ is_approved: true })
            .eq('email', currentUser.email);
        }

        setButtonActiveState();
        if (rankingStatusMsg) {
          rankingStatusMsg.style.display = 'block';
          rankingStatusMsg.style.color = '#22c55e';
          rankingStatusMsg.textContent = '¡Tu perfil ha sido activado! Ya apareces en la tabla de clasificación.';
        }

        await loadLeaderboard();

      } catch (err) {
        console.error('Error al activar perfil:', err);
        if (rankingStatusMsg) {
          rankingStatusMsg.style.display = 'block';
          rankingStatusMsg.style.color = '#ef4444';
          rankingStatusMsg.textContent = 'Hubo un problema al activar tu perfil. Intenta de nuevo.';
        }
      } finally {
        btnJoinRanking.disabled = false;
      }
    });
  }

  // --- CARGAR LEADERBOARD ORDENADO POR % DE GANANCIA ---
  async function loadLeaderboard() {
    const tbody = document.getElementById('leaderboardBody');
    if (!tbody || typeof db === 'undefined') return;

    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Cargando ranking de traders...</td></tr>`;

    try {
      // 1. Obtener perfiles que están participando
      const { data: profiles, error: profError } = await db
        .from('profiles')
        .select('id, username, email')
        .eq('is_approved', true);

      // 2. Obtener todos los trades
      const { data: trades, error: tradeError } = await db
        .from('trades')
        .select('*');

      if (profError || tradeError) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--accent-red);">Error al conectar con la base de datos.</td></tr>`;
        return;
      }

      if (!profiles || profiles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Aún no hay traders participando. ¡Sé el primero en hacer clic en "Participar en Ranking"!</td></tr>`;
        return;
      }

      const DEFAULT_BASE_CAPITAL = 1000;

      const leaderboard = profiles.map(user => {
        const userTrades = (trades || []).filter(t => (t.user_id === user.id || t.email === user.email) && t.result !== 'NOOP');
        const totalOps = userTrades.length;
        
        const winningTrades = userTrades.filter(t => t.result === 'TP' || t.pnl > 0);
        const losingTrades = userTrades.filter(t => t.result === 'SL' || t.pnl < 0);

        const winRate = totalOps > 0 ? Math.round((winningTrades.length / totalOps) * 100) : 0;
        const totalPnl = userTrades.reduce((acc, t) => acc + (parseFloat(t.pnl) || 0), 0);
        
        // % Rendimiento = (PnL Total / Base Capital) * 100
        const profitPercent = (totalPnl / DEFAULT_BASE_CAPITAL) * 100;

        const grossProfit = winningTrades.reduce((acc, t) => acc + (parseFloat(t.pnl) || 0), 0);
        const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + (parseFloat(t.pnl) || 0), 0));
        const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 'MAX' : '0.00') : (grossProfit / grossLoss).toFixed(2);

        return {
          id: user.id,
          email: user.email,
          username: user.username || user.email?.split('@')[0] || 'Trader',
          totalOps,
          winRate,
          totalPnl,
          profitPercent,
          profitFactor
        };
      });

      // ORDENAR DE MAYOR A MENOR SEGÚN % RENDIMIENTO
      leaderboard.sort((a, b) => b.profitPercent - a.profitPercent);

      // Renderizar tabla
      tbody.innerHTML = '';
      leaderboard.forEach((trader, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--card-border)';
        tr.style.height = '48px';

        if (currentUser && (currentUser.id === trader.id || currentUser.email === trader.email)) {
          tr.style.background = 'rgba(34, 197, 94, 0.05)';
        }

        let positionDisplay = `#${index + 1}`;
        if (index === 0) positionDisplay = '🥇 1';
        else if (index === 1) positionDisplay = '🥈 2';
        else if (index === 2) positionDisplay = '🥉 3';

        const pnlColor = trader.profitPercent >= 0 ? '#22c55e' : '#ef4444';
        const sign = trader.profitPercent >= 0 ? '+' : '';

        tr.innerHTML = `
          <td style="padding: 10px; font-weight: 700;">${positionDisplay}</td>
          <td style="padding: 10px; font-weight: 600; color: var(--text-main);">${trader.username}</td>
          <td style="padding: 10px; font-weight: 800; color: ${pnlColor};">${sign}${trader.profitPercent.toFixed(2)}%</td>
          <td style="padding: 10px;">${trader.winRate}%</td>
          <td style="padding: 10px;">${trader.totalOps}</td>
          <td style="padding: 10px; font-weight: 700; color: #22c55e;">${trader.profitFactor}</td>
        `;
        tbody.appendChild(tr);
      });

    } catch (err) {
      console.error("Error al procesar el ranking:", err);
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--accent-red);">Error al procesar el ranking.</td></tr>`;
    }
  }

  await checkUserStatus();
  await loadLeaderboard();
});
