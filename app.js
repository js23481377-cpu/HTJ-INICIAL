// =========================================================
// LIFE TRADING - APP.JS (CORE DASHBOARD & JOURNAL)
// =========================================================

// 1. CREDENCIALES Y CLIENTE SUPABASE
const SUPABASE_URL = 'https://okihugbwtxbycvjiskyf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9raWh1Z2J3dHhieWN2amlza3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNDMxODQsImV4cCI6MjEwODYxOTE4NH0.tUIXj2-LHngS4pEn36XSk9kVs2GvFDXKhlZDA0tgnR8';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. ESTADO GLOBAL
let currentUser = null;
let currentViewDate = new Date(); 
let dailyChartInstance = null;
let selectedDateForTrade = null;
let userInitialBalance = 0;
let currentMonthTrades = [];

// 3. INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof lucide !== 'undefined') lucide.createIcons();

  const localData = localStorage.getItem('life_trading_user');
  if (!localData) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = JSON.parse(localData);

  updateUserProfileUI();
  setupMonthNavigation();
  setupModalEvents();
  setupPillGroupEvents();
  setupFormListeners();
  setupLogout();

  await loadDashboardData();
});

// =========================================================
// FUNCIONES DE INTERFAZ Y REFRESCO DE DATOS
// =========================================================

function updateUserProfileUI() {
  if (!currentUser) return;
  const username = (currentUser.username || currentUser.email.split('@')[0]).toUpperCase();
  const initial = username.charAt(0);

  const sidebarUserName = document.getElementById('sidebarUserName');
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  const userGreetingName = document.getElementById('userGreetingName');
  const communityUserName = document.getElementById('communityUserName');

  if (sidebarUserName) sidebarUserName.textContent = username;
  if (sidebarAvatar) sidebarAvatar.textContent = initial;
  if (userGreetingName) userGreetingName.textContent = username;
  if (communityUserName) communityUserName.textContent = username;
}

async function loadDashboardData() {
  updateMonthLabel();
  await fetchUserBalance();
  await fetchUserTrades();
  await fetchTradingPlan();
}

function updateMonthLabel() {
  const monthLabel = document.getElementById('currentMonthLabel');
  if (monthLabel) {
    const options = { month: 'long', year: 'numeric' };
    const formatted = currentViewDate.toLocaleDateString('es-ES', options);
    monthLabel.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
}

function setupMonthNavigation() {
  const prevBtn = document.getElementById('prevMonthBtn');
  const nextBtn = document.getElementById('nextMonthBtn');

  if (prevBtn) {
    prevBtn.addEventListener('click', async () => {
      currentViewDate.setMonth(currentViewDate.getMonth() - 1);
      await loadDashboardData();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', async () => {
      currentViewDate.setMonth(currentViewDate.getMonth() + 1);
      await loadDashboardData();
    });
  }
}

// =========================================================
// CONSULTAS A BASE DE DATOS
// =========================================================

async function fetchUserBalance() {
  try {
    const { data: profile } = await db
      .from('profiles')
      .select('initial_balance')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (profile && profile.initial_balance !== null && profile.initial_balance !== undefined) {
      userInitialBalance = parseFloat(profile.initial_balance) || 0;
    } else {
      userInitialBalance = 0;
      const modal = document.getElementById('initialBalanceModal');
      if (modal) modal.style.display = 'flex';
    }
  } catch (err) {
    console.error('Error al obtener capital:', err);
  }
}

async function fetchUserTrades() {
  try {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const startOfMonth = new Date(year, month, 1).toISOString();
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    const { data: trades, error } = await db
      .from('trades')
      .select('*')
      .or(`user_id.eq.${currentUser.id},email.eq.${currentUser.email}`)
      .gte('created_at', startOfMonth)
      .lte('created_at', endOfMonth)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error al consultar trades:', error);
      return;
    }

    currentMonthTrades = trades || [];
    renderKPIsAndCapital();
    renderDailyChart();
    renderCalendar();
    renderStrategyBreakdown();
  } catch (err) {
    console.error('Error al procesar operaciones:', err);
  }
}

// =========================================================
// RENDERIZADO DEL DASHBOARD Y MÉTRICAS
// =========================================================

function renderKPIsAndCapital() {
  const activeTrades = currentMonthTrades.filter(t => t.result !== 'NOOP');
  
  let monthPnl = 0, wins = 0, losses = 0, grossProfit = 0, grossLoss = 0;

  activeTrades.forEach(t => {
    const pnl = parseFloat(t.pnl) || 0;
    const res = (t.result || t.type || '').toUpperCase();
    monthPnl += pnl;

    if (res === 'TP' || pnl > 0) {
      wins++;
      grossProfit += pnl;
    } else if (res === 'SL' || pnl < 0) {
      losses++;
      grossLoss += Math.abs(pnl);
    }
  });

  const totalOps = activeTrades.length;
  const winRate = totalOps > 0 ? Math.round((wins / totalOps) * 100) : 0;
  
  let profitFactor = '0.00';
  if (grossLoss === 0) {
    profitFactor = grossProfit > 0 ? 'MAX' : '0.00';
  } else {
    profitFactor = (grossProfit / grossLoss).toFixed(2);
  }

  const avgWin = wins > 0 ? (grossProfit / wins).toFixed(0) : '0';
  const avgLoss = losses > 0 ? (grossLoss / losses).toFixed(0) : '0';

  const currentCapital = userInitialBalance + monthPnl;
  const capitalAmountEl = document.getElementById('capitalAmount');
  const capitalBadgeEl = document.getElementById('capitalBadge');

  if (capitalAmountEl) capitalAmountEl.textContent = `$${currentCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (capitalBadgeEl) {
    const sign = monthPnl >= 0 ? '+' : '';
    const badgeColor = monthPnl >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
    const textColor = monthPnl >= 0 ? '#22c55e' : '#ef4444';
    capitalBadgeEl.style.background = badgeColor;
    capitalBadgeEl.style.color = textColor;
    capitalBadgeEl.innerHTML = `${sign}$${monthPnl.toFixed(2)} <span>resultado del mes</span>`;
  }

  const kpiWinRate = document.getElementById('kpiWinRate');
  const kpiProfitFactor = document.getElementById('kpiProfitFactor');
  const kpiAvgWL = document.getElementById('kpiAvgWL');
  const kpiStreak = document.getElementById('kpiStreak');

  if (kpiWinRate) kpiWinRate.textContent = `${winRate}%`;
  if (kpiProfitFactor) kpiProfitFactor.textContent = profitFactor;
  if (kpiAvgWL) kpiAvgWL.textContent = `+$${avgWin} / -$${avgLoss}`;
  if (kpiStreak) kpiStreak.textContent = `${wins}W`;

  const communityOps = document.getElementById('communityOps');
  const communityWinRate = document.getElementById('communityWinRate');
  if (communityOps) communityOps.textContent = totalOps;
  if (communityWinRate) communityWinRate.textContent = `${winRate}%`;
}

function renderDailyChart() {
  const canvas = document.getElementById('dailyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (dailyChartInstance) dailyChartInstance.destroy();

  const daysInMonth = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 0).getDate();
  const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  let cumulativePnl = 0;
  const dataPoints = labels.map(day => {
    const dayTrades = currentMonthTrades.filter(t => new Date(t.created_at).getDate() === day);
    cumulativePnl += dayTrades.reduce((acc, t) => acc + (parseFloat(t.pnl) || 0), 0);
    return cumulativePnl;
  });

  dailyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Acumulado ($)',
        data: dataPoints,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.05)',
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#a1a1aa', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#a1a1aa', font: { size: 10 } } }
      }
    }
  });
}

function renderCalendar() {
  const container = document.getElementById('calendar-cells');
  const registeredTag = document.getElementById('registeredTag');
  if (!container) return;
  container.innerHTML = '';

  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const tradesByDay = {};
  currentMonthTrades.forEach(t => {
    const dayNum = new Date(t.created_at).getDate();
    if (!tradesByDay[dayNum]) tradesByDay[dayNum] = [];
    tradesByDay[dayNum].push(t);
  });

  if (registeredTag) registeredTag.textContent = `${Object.keys(tradesByDay).length} días registrados`;

  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-cell empty';
    container.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    const dayTrades = tradesByDay[day] || [];
    let statusDotHtml = '';

    if (dayTrades.length > 0) {
      const dayPnl = dayTrades.reduce((acc, t) => acc + (parseFloat(t.pnl) || 0), 0);
      const hasTP = dayTrades.some(t => t.result === 'TP');
      const hasSL = dayTrades.some(t => t.result === 'SL');
      const hasRetirada = dayTrades.some(t => t.result === 'RETIRADA');

      let dotClass = 'be';
      if (hasRetirada) dotClass = 'retirada';
      else if (dayPnl > 0 || hasTP) dotClass = 'tp';
      else if (dayPnl < 0 || hasSL) dotClass = 'sl';
      statusDotHtml = `<span class="dot ${dotClass}"></span>`;
    }

    cell.innerHTML = `<span class="day-number">${day}</span>${statusDotHtml}`;
    cell.addEventListener('click', () => {
      const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      openDayTradesModal(formattedDate, dayTrades);
    });
    container.appendChild(cell);
  }
}

// =========================================================
// MODALES DE OPERACIÓN
// =========================================================

function openDayTradesModal(dateStr, tradesForDay = []) {
  selectedDateForTrade = dateStr;
  const modal = document.getElementById('tradeModal');
  const modalTitle = document.getElementById('modalTitle');
  
  if (modalTitle) modalTitle.textContent = `Operaciones del ${dateStr}`;
  document.getElementById('dayTradesView').style.display = 'block';
  document.getElementById('tradeForm').style.display = 'none';

  renderTradesList(tradesForDay);
  if (modal) modal.style.display = 'flex';
}

function renderTradesList(tradesForDay) {
  const container = document.getElementById('tradesListContainer');
  if (!container) return;

  if (!tradesForDay || tradesForDay.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 15px;">No hay operaciones registradas.</p>';
    return;
  }

  container.innerHTML = tradesForDay.map(trade => {
    // Lectura estricta del resultado guardado
    const resType = (trade.result || trade.type || 'TP').toUpperCase();
    const pnlVal = parseFloat(trade.pnl) || 0;
    const isPositive = resType === 'TP' || (resType !== 'SL' && pnlVal > 0);
    const pnlSign = isPositive ? '+' : (resType === 'SL' || pnlVal < 0 ? '-' : '');
    const pnlClass = isPositive ? 'text-green' : (resType === 'SL' || pnlVal < 0 ? 'text-red' : '');

    return `
      <div class="trade-item-card" style="padding: 12px; border: 1px solid var(--card-border); border-radius: 12px; margin-bottom: 8px; background: rgba(255,255,255,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="font-size: 14px;">${trade.asset || 'NAS100'} (${trade.direction || 'LONG'}) - <span class="${pnlClass}">${pnlSign}$${Math.abs(pnlVal).toFixed(2)}</span></strong>
            <div style="font-size: 11px; color: #22c55e; margin-top: 2px;">Estrategia: ${trade.strategy || 'Sin estrategia'}</div>
            <div style="font-size: 11px; color: var(--text-muted);">Tipo: ${resType}</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button onclick="window.editTrade('${trade.id}')" class="btn-icon-setting" title="Editar"><i data-lucide="edit-2"></i></button>
            <button onclick="window.deleteTrade('${trade.id}')" class="btn-icon-setting" title="Eliminar"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.editTrade = function (tradeId) {
  const trade = currentMonthTrades.find(t => t.id === tradeId);
  if (!trade) return;

  document.getElementById('dayTradesView').style.display = 'none';
  document.getElementById('tradeForm').style.display = 'flex';

  document.getElementById('editingTradeId').value = trade.id;
  document.getElementById('tradeDate').value = trade.created_at ? trade.created_at.split('T')[0] : selectedDateForTrade;
  document.getElementById('tradePnl').value = Math.abs(trade.pnl || 0);
  document.getElementById('tradeNotes').value = trade.notes || '';

  setGroupActiveValue('typeGroup', (trade.result || trade.type || 'TP').toLowerCase(), 'tradeResultType');
  setGroupActiveValue('assetGroup', trade.asset || 'NAS100', 'tradeAsset');
  setGroupActiveValue('directionGroup', trade.direction || 'LONG', 'tradeDirection');
  setGroupActiveValue('strategyGroup', trade.strategy || '', 'tradeStrategy');
};

window.deleteTrade = async function (tradeId) {
  if (!confirm('¿Seguro que deseas eliminar esta operación?')) return;
  try {
    await db.from('trades').delete().eq('id', tradeId);
    document.getElementById('tradeModal').style.display = 'none';
    await loadDashboardData();
  } catch (err) {
    console.error('Error al eliminar trade:', err);
  }
};

function setGroupActiveValue(groupId, val, hiddenInputId) {
  const group = document.getElementById(groupId);
  const hiddenInput = document.getElementById(hiddenInputId);
  if (hiddenInput) hiddenInput.value = val;

  if (group) {
    const buttons = group.querySelectorAll('.pill-btn');
    buttons.forEach(btn => {
      if (btn.getAttribute('data-value').toLowerCase() === String(val).toLowerCase()) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
}

// =========================================================
// MANEJO DE EVENTOS DEL FORMULARIO Y MODALES
// =========================================================

function setupPillGroupEvents() {
  ['typeGroup', 'assetGroup', 'directionGroup', 'strategyGroup'].forEach(groupId => {
    const group = document.getElementById(groupId);
    if (!group) return;

    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill-btn');
      if (!btn) return;
      group.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const value = btn.getAttribute('data-value');
      if (groupId === 'typeGroup') document.getElementById('tradeResultType').value = value;
      if (groupId === 'assetGroup') document.getElementById('tradeAsset').value = value;
      if (groupId === 'directionGroup') document.getElementById('tradeDirection').value = value;
      if (groupId === 'strategyGroup') document.getElementById('tradeStrategy').value = value;
    });
  });
}

function setupFormListeners() {
  const tradeForm = document.getElementById('tradeForm');
  if (tradeForm) {
    tradeForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const tradeId = document.getElementById('editingTradeId').value;
      const date = document.getElementById('tradeDate').value || selectedDateForTrade;
      const resultType = (document.getElementById('tradeResultType').value || 'TP').toUpperCase();
      const asset = document.getElementById('tradeAsset').value || 'NAS100';
      const direction = document.getElementById('tradeDirection').value || 'LONG';
      const strategy = document.getElementById('tradeStrategy').value || 'Sin estrategia';
      const notes = document.getElementById('tradeNotes').value.trim();

      // CANDADO DE PNL: Asigna el signo según el tipo de resultado seleccionado
      let rawPnl = parseFloat(document.getElementById('tradePnl').value) || 0;
      let finalPnl = rawPnl;
      if (resultType === 'SL') {
        finalPnl = -Math.abs(rawPnl);
      } else if (resultType === 'TP') {
        finalPnl = Math.abs(rawPnl);
      } else if (resultType === 'BE' || resultType === 'NOOP') {
        finalPnl = 0;
      }

      const tradeData = {
        user_id: currentUser.id,
        email: currentUser.email,
        created_at: date ? new Date(date).toISOString() : new Date().toISOString(),
        result: resultType,
        type: resultType,
        asset: asset,
        direction: direction,
        strategy: strategy,
        pnl: finalPnl,
        notes: notes
      };

      if (tradeId) {
        await db.from('trades').update(tradeData).eq('id', tradeId);
      } else {
        await db.from('trades').insert([tradeData]);
      }

      document.getElementById('tradeModal').style.display = 'none';
      await loadDashboardData();
    });
  }

  const initialBalanceForm = document.getElementById('initialBalanceForm');
  if (initialBalanceForm) {
    initialBalanceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = parseFloat(document.getElementById('initialBalanceInput').value) || 0;
      await db.from('profiles').update({ initial_balance: val }).eq('id', currentUser.id);
      userInitialBalance = val;
      document.getElementById('initialBalanceModal').style.display = 'none';
      await loadDashboardData();
    });
  }

  // Edición del Plan de Trading
  const editPlanBtn = document.getElementById('editPlanBtn');
  const planModal = document.getElementById('planModal');
  const closePlanModalBtn = document.getElementById('closePlanModalBtn');
  const cancelPlanModalBtn = document.getElementById('cancelPlanModalBtn');
  const planForm = document.getElementById('planForm');

  if (editPlanBtn && planModal) {
    editPlanBtn.addEventListener('click', async () => {
      const { data: profile } = await db.from('profiles').select('trading_plan').eq('id', currentUser.id).maybeSingle();
      const plan = (profile && profile.trading_plan) ? profile.trading_plan : [
        "Arriesgar máximo el 1% por operación",
        "Respetar el Horario Operativo (09:30 AM - 11:30 AM)",
        "Detener la sesión tras 2 Stop Loss seguidos"
      ];
      if (document.getElementById('planRule1')) document.getElementById('planRule1').value = plan[0] || '';
      if (document.getElementById('planRule2')) document.getElementById('planRule2').value = plan[1] || '';
      if (document.getElementById('planRule3')) document.getElementById('planRule3').value = plan[2] || '';
      planModal.style.display = 'flex';
    });
  }

  if (closePlanModalBtn && planModal) {
    closePlanModalBtn.addEventListener('click', () => planModal.style.display = 'none');
  }
  if (cancelPlanModalBtn && planModal) {
    cancelPlanModalBtn.addEventListener('click', () => planModal.style.display = 'none');
  }

  if (planForm) {
    planForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r1 = document.getElementById('planRule1').value.trim();
      const r2 = document.getElementById('planRule2').value.trim();
      const r3 = document.getElementById('planRule3').value.trim();
      const newPlan = [r1, r2, r3].filter(r => r.length > 0);

      await db.from('profiles').update({ trading_plan: newPlan }).eq('id', currentUser.id);
      if (planModal) planModal.style.display = 'none';
      await fetchTradingPlan();
    });
  }
}

function setupModalEvents() {
  const openModalBtn = document.getElementById('openModalBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const addNewTradeBtn = document.getElementById('addNewTradeBtn');
  const backToListBtn = document.getElementById('backToListBtn');
  const tradeModal = document.getElementById('tradeModal');

  if (openModalBtn) {
    openModalBtn.addEventListener('click', () => {
      const today = new Date().toISOString().split('T')[0];
      const todayTrades = currentMonthTrades.filter(t => t.created_at && t.created_at.startsWith(today));
      openDayTradesModal(today, todayTrades);
    });
  }
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      if (tradeModal) tradeModal.style.display = 'none';
    });
  }
  if (addNewTradeBtn) {
    addNewTradeBtn.addEventListener('click', () => {
      document.getElementById('dayTradesView').style.display = 'none';
      document.getElementById('tradeForm').style.display = 'flex';
      document.getElementById('editingTradeId').value = '';
      document.getElementById('tradeDate').value = selectedDateForTrade || new Date().toISOString().split('T')[0];
      document.getElementById('tradePnl').value = '';
      document.getElementById('tradeNotes').value = '';
    });
  }
  if (backToListBtn) {
    backToListBtn.addEventListener('click', () => {
      document.getElementById('tradeForm').style.display = 'none';
      document.getElementById('dayTradesView').style.display = 'block';
    });
  }

  const editBalanceBtn = document.getElementById('editBalanceBtn');
  if (editBalanceBtn) {
    editBalanceBtn.addEventListener('click', () => {
      const modal = document.getElementById('initialBalanceModal');
      const input = document.getElementById('initialBalanceInput');
      if (input) input.value = userInitialBalance;
      if (modal) modal.style.display = 'flex';
    });
  }
}

function setupLogout() {
  const logoutBtn = document.querySelector('.btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('¿Deseas cerrar sesión?')) {
        localStorage.removeItem('life_trading_user');
        window.location.href = 'login.html';
      }
    });
  }
}

// =========================================================
// PLAN Y ESTRATEGIA
// =========================================================

async function fetchTradingPlan() {
  const container = document.getElementById('planListContainer');
  if (!container) return;
  try {
    const { data: profile } = await db.from('profiles').select('trading_plan').eq('id', currentUser.id).maybeSingle();
    const plan = (profile && profile.trading_plan) ? profile.trading_plan : [
      "Arriesgar máximo el 1% por operación",
      "Respetar el Horario Operativo (09:30 AM - 11:30 AM)",
      "Detener la sesión tras 2 Stop Loss seguidos"
    ];
    container.innerHTML = plan.map((rule, idx) => `<li><strong>0${idx + 1}.</strong> ${rule}</li>`).join('');
  } catch (err) {
    console.error('Error al cargar plan:', err);
  }
}

function renderStrategyBreakdown() {
  const container = document.getElementById('strategyColumnsContainer');
  if (!container) return;

  const strategiesMap = {};
  currentMonthTrades.forEach(t => {
    if (t.result === 'NOOP') return;
    const strat = t.strategy || 'Sin estrategia';
    if (!strategiesMap[strat]) strategiesMap[strat] = { total: 0, wins: 0, pnl: 0 };
    strategiesMap[strat].total++;
    const pnl = parseFloat(t.pnl) || 0;
    strategiesMap[strat].pnl += pnl;
    if (t.result === 'TP' || pnl > 0) strategiesMap[strat].wins++;
  });

  const keys = Object.keys(strategiesMap);
  if (keys.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; grid-column: 1 / -1;">No hay métricas de estrategia para este mes.</p>';
    return;
  }

  container.innerHTML = keys.slice(0, 5).map(strat => {
    const data = strategiesMap[strat];
    const winRate = data.total > 0 ? Math.round((data.wins / data.total) * 100) : 0;
    const sign = data.pnl >= 0 ? '+' : '';
    const pnlClass = data.pnl >= 0 ? 'text-green' : 'text-red';
    return `
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); padding: 12px; border-radius: 12px;">
        <span style="font-size: 12px; font-weight: 700; color: var(--text-main); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${strat}</span>
        <div style="font-size: 16px; font-weight: 800; margin-top: 4px;" class="${pnlClass}">${sign}$${data.pnl.toFixed(2)}</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">WR: ${winRate}% (${data.total} ops)</div>
      </div>
    `;
  }).join('');
}
