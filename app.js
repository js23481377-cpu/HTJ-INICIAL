// =======================================================
// 1. CONFIGURACIÓN E INICIALIZACIÓN DE SUPABASE Y EMAILJS
// =======================================================
const SUPABASE_URL = 'https://okihugbwtxbycvjiskyf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9raWh1Z2J3dHhieWN2amlza3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNDMxODQsImV4cCI6MjEwODYxOTE4NH0.tUIXj2-LHngS4pEn36XSk9kVs2GvFDXKhlZDA0tgnR8';

// Inicializar cliente de Supabase
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configuración de EmailJS
const EMAILJS_PUBLIC_KEY = '4YWvGd62dXMQwTMuj';
const EMAILJS_SERVICE_ID = 'service_dtim3ij';
const EMAILJS_TEMPLATE_ID = 'template_6d7x41c';

if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY !== 'TU_EMAILJS_PUBLIC_KEY') {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

// =======================================================
// 2. LÓGICA PRINCIPAL DE LA APLICACIÓN
// =======================================================
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();

  const STORAGE_KEY = 'life_trading_operations';
  const BALANCE_KEY = 'life_trading_initial_balance';
  const PLAN_STORAGE_KEY = 'life_trading_plan_rules';
  const STRATEGIES_KEY = 'life_trading_custom_strategies';

  // --- OBTENER USUARIO AUTENTICADO DESDE SUPABASE / LOCALSTORAGE ---
  const localUserData = localStorage.getItem('life_trading_user');
  const currentUser = localUserData ? JSON.parse(localUserData) : null;

  // --- ACTUALIZAR DATOS Y APODO DE USUARIO EN LA INTERFAZ ---
  if (currentUser && currentUser.username) {
    const username = currentUser.username;
    const firstLetter = username.charAt(0).toUpperCase();

    const greetingEl = document.getElementById('userGreetingName');
    const sidebarEl = document.getElementById('sidebarUserName');
    const avatarEl = document.getElementById('sidebarAvatar');
    const communityEl = document.getElementById('communityUserName');

    if (greetingEl) greetingEl.textContent = username;
    if (sidebarEl) sidebarEl.textContent = username;
    if (avatarEl) avatarEl.textContent = firstLetter;
    if (communityEl) communityEl.textContent = username;
  }

  let trades = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  let initialBalance = parseFloat(localStorage.getItem(BALANCE_KEY));

  let planRules = JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY)) || [
    "Máximo 2 trades por día.",
    "Arriesgar máximo 1% por trade.",
    "Respetar Stop Loss siempre."
  ];

  let customStrategies = JSON.parse(localStorage.getItem(STRATEGIES_KEY)) || [];

  // --- SOLICITAR CÓDIGO DE ACCESO (REGISTRO + EMAILJS) ---
  const requestCodeForm = document.getElementById('requestCodeForm') || document.querySelector('form');
  if (requestCodeForm) {
    requestCodeForm.addEventListener('submit', async (e) => {
      const emailInput = requestCodeForm.querySelector('input[type="email"]');
      const usernameInput = requestCodeForm.querySelector('input[placeholder*="Apodo"]') || requestCodeForm.querySelector('input[type="text"]');
      const passwordInput = requestCodeForm.querySelector('input[type="password"]');

      if (!emailInput || !passwordInput) return;

      e.preventDefault();
      const email = emailInput.value.trim();
      const username = usernameInput ? usernameInput.value.trim() : 'Trader';
      const password = passwordInput.value;

      try {
        const accessCode = Math.floor(100000 + Math.random() * 900000).toString();

        const { data, error } = await db.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              full_name: username,
              access_code: accessCode
            }
          }
        });

        if (error) throw error;

        if (typeof emailjs !== 'undefined') {
          const templateParams = {
            to_email: email,
            user_name: username,
            access_code: accessCode
          };
          await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
        }

        alert('¡Código de acceso generado! Revisa tu correo electrónico.');

      } catch (err) {
        console.error('Error al solicitar código:', err);
        alert('Error: ' + err.message);
      }
    });
  }

  // --- FUNCIONES DE SINCRONIZACIÓN CON SUPABASE (CANDADO DE LECTURA) ---
  async function fetchTradesFromCloud() {
    if (!currentUser || !currentUser.id || typeof db === 'undefined') return;

    try {
      const { data, error } = await db
        .from('trades')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error al cargar trades desde Supabase:', error.message);
        return;
      }

      if (data && data.length > 0) {
        trades = data.map(t => {
          const exactResult = (t.result || t.type || 'tp').toLowerCase();
          let rawPnl = parseFloat(t.pnl) || 0;

          // BLINDAJE DE LECTURA: Asegura que el signo refleje estrictamente el tipo guardado
          if (exactResult === 'sl' && rawPnl > 0) rawPnl = -rawPnl;
          if (exactResult === 'tp' && rawPnl < 0) rawPnl = Math.abs(rawPnl);

          return {
            id: t.id,
            date: t.created_at ? t.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            asset: t.asset,
            direction: t.type || 'LONG',
            strategy: t.notes && t.notes.includes('Estrategia:') ? t.notes.split('|')[0].replace('Estrategia:', '').trim() : '',
            resultType: exactResult,
            pnl: rawPnl,
            notes: t.notes || '',
            photo: ''
          };
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
      }
    } catch (err) {
      console.error('Error de conexión con Supabase:', err);
    }
  }

  async function syncTradeToCloud(tradeData) {
    if (!currentUser || !currentUser.id || typeof db === 'undefined') return;

    try {
      const { data, error } = await db.from('trades').insert([
        {
          user_id: currentUser.id,
          email: currentUser.email || null,
          asset: tradeData.asset,
          type: tradeData.direction,
          entry_price: 0,
          pnl: tradeData.pnl,
          result: tradeData.resultType.toUpperCase(),
          notes: `Estrategia: ${tradeData.strategy || 'Sin estrategia'} | ${tradeData.notes || ''}`
        }
      ]);

      if (error) console.error('Error al guardar en Supabase:', error.message);
    } catch (err) {
      console.error('Error al enviar trade a la nube:', err);
    }
  }

  async function deleteTradeFromCloud(tradeId) {
    if (!currentUser || !currentUser.id || typeof db === 'undefined') return;

    try {
      const { error } = await db.from('trades').delete().eq('id', tradeId);
      if (error) console.error('Error al eliminar trade de Supabase:', error.message);
    } catch (err) {
      console.error('Error de eliminación en la nube:', err);
    }
  }

  function saveTrades() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  }

  function savePlanRules() {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(planRules));
  }

  function saveStrategies() {
    localStorage.setItem(STRATEGIES_KEY, JSON.stringify(customStrategies));
  }

  // --- MODAL SALDO INICIAL ---
  const initialBalanceModal = document.getElementById('initialBalanceModal');
  const initialBalanceForm = document.getElementById('initialBalanceForm');
  const initialBalanceInput = document.getElementById('initialBalanceInput');

  if (isNaN(initialBalance) && initialBalanceModal) {
    initialBalanceModal.classList.add('active');
  }

  if (initialBalanceForm) {
    initialBalanceForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = parseFloat(initialBalanceInput.value);
      if (!isNaN(val)) {
        initialBalance = val;
        localStorage.setItem(BALANCE_KEY, initialBalance);
        if (initialBalanceModal) initialBalanceModal.classList.remove('active');
        updateDashboard();
      }
    });
  }

  // --- EDITAR SALDO ---
  const editBalanceBtn = document.getElementById('editBalanceBtn');
  if (editBalanceBtn) {
    editBalanceBtn.addEventListener('click', () => {
      const newBalance = prompt("Actualiza tu saldo inicial:", initialBalance || 0);
      if (newBalance !== null) {
        const val = parseFloat(newBalance);
        if (!isNaN(val)) {
          initialBalance = val;
          localStorage.setItem(BALANCE_KEY, initialBalance);
          updateDashboard();
        } else {
          alert("Por favor, ingresa un número válido.");
        }
      }
    });
  }

  // --- PLAN DE TRADING ---
  const planModal = document.getElementById('planModal');
  const editPlanBtn = document.getElementById('editPlanBtn');
  const closePlanModalBtn = document.getElementById('closePlanModalBtn');
  const cancelPlanModalBtn = document.getElementById('cancelPlanModalBtn');
  const planForm = document.getElementById('planForm');
  const planListContainer = document.getElementById('planListContainer');

  function renderPlan() {
    if (!planListContainer) return;
    planListContainer.innerHTML = '';
    planRules.forEach(rule => {
      const li = document.createElement('li');
      li.textContent = rule;
      planListContainer.appendChild(li);
    });
  }

  function openPlanModal() {
    document.getElementById('planRule1').value = planRules[0] || '';
    document.getElementById('planRule2').value = planRules[1] || '';
    document.getElementById('planRule3').value = planRules[2] || '';
    if (planModal) planModal.classList.add('active');
  }

  function closePlanModal() {
    if (planModal) planModal.classList.remove('active');
  }

  if (editPlanBtn) editPlanBtn.addEventListener('click', openPlanModal);
  if (closePlanModalBtn) closePlanModalBtn.addEventListener('click', closePlanModal);
  if (cancelPlanModalBtn) cancelPlanModalBtn.addEventListener('click', closePlanModal);
  if (planModal) {
    planModal.addEventListener('click', (e) => {
      if (e.target === planModal) closePlanModal();
    });
  }

  if (planForm) {
    planForm.addEventListener('submit', (e) => {
      e.preventDefault();
      planRules = [
        document.getElementById('planRule1').value,
        document.getElementById('planRule2').value,
        document.getElementById('planRule3').value
      ];
      savePlanRules();
      renderPlan();
      closePlanModal();
    });
  }

  renderPlan();

  // --- NAVEGACIÓN Y VARIABLES DEL MODAL ---
  let currentDate = new Date(2026, 9, 1);
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const modal = document.getElementById('tradeModal');
  const openModalBtn = document.getElementById('openModalBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const tradeForm = document.getElementById('tradeForm');
  const tradeDateInput = document.getElementById('tradeDate');
  const tradePhotoInput = document.getElementById('tradePhotoInput');
  const photoFileName = document.getElementById('photoFileName');
  
  const dayTradesView = document.getElementById('dayTradesView');
  const tradesListContainer = document.getElementById('tradesListContainer');
  const addNewTradeBtn = document.getElementById('addNewTradeBtn');
  const backToListBtn = document.getElementById('backToListBtn');
  const modalTitle = document.getElementById('modalTitle');
  const editingTradeIdInput = document.getElementById('editingTradeId');

  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');

  const prevMonthBtn = document.getElementById('prevMonthBtn');
  const nextMonthBtn = document.getElementById('nextMonthBtn');
  const currentMonthLabel = document.getElementById('currentMonthLabel');

  let base64Image = '';
  let selectedDateForModal = new Date().toISOString().split('T')[0];

  if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); updateDashboard(); });
  if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); updateDashboard(); });

  // --- BOTONES ESTÁTICOS NORMALES ---
  const typeButtons = document.querySelectorAll('#typeGroup .pill-btn');
  const tradeResultTypeInput = document.getElementById('tradeResultType');
  typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      typeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tradeResultTypeInput.value = btn.getAttribute('data-value');
    });
  });

  const assetButtons = document.querySelectorAll('#assetGroup .pill-btn');
  const tradeAssetInput = document.getElementById('tradeAsset');
  assetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      assetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tradeAssetInput.value = btn.getAttribute('data-value');
    });
  });

  const dirButtons = document.querySelectorAll('#directionGroup .pill-btn');
  const tradeDirectionInput = document.getElementById('tradeDirection');
  dirButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      dirButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tradeDirectionInput.value = btn.getAttribute('data-value');
    });
  });

  // --- BURBUJAS DE ESTRATEGIA (DINÁMICAS Y AISLADAS) ---
  function renderStrategyPills(selectedStrategy = "") {
    const strategyGroup = document.getElementById('strategyGroup');
    const tradeStrategyInput = document.getElementById('tradeStrategy');
    if (!strategyGroup) return;

    strategyGroup.innerHTML = '';
    if (tradeStrategyInput) tradeStrategyInput.value = selectedStrategy;

    const noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = `strategy-bubble ${selectedStrategy === '' ? 'active' : ''}`;
    noneBtn.textContent = "Sin estrategia";
    noneBtn.onclick = (e) => {
      e.preventDefault();
      strategyGroup.querySelectorAll('.strategy-bubble').forEach(b => b.classList.remove('active'));
      noneBtn.classList.add('active');
      if (tradeStrategyInput) tradeStrategyInput.value = '';
    };
    strategyGroup.appendChild(noneBtn);

    customStrategies.forEach(strat => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `strategy-bubble ${strat === selectedStrategy ? 'active' : ''}`;
      btn.textContent = strat;

      btn.onclick = (e) => {
        e.preventDefault();
        strategyGroup.querySelectorAll('.strategy-bubble').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (tradeStrategyInput) tradeStrategyInput.value = strat;
      };

      btn.oncontextmenu = (e) => {
        e.preventDefault();
        if (confirm(`¿Eliminar la burbuja de estrategia "${strat}"?`)) {
          customStrategies = customStrategies.filter(s => s !== strat);
          saveStrategies();
          renderStrategyPills(tradeStrategyInput.value === strat ? '' : tradeStrategyInput.value);
          updateDashboard();
        }
      };

      strategyGroup.appendChild(btn);
    });

    if (customStrategies.length < 5) {
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'strategy-bubble strategy-bubble-add';
      addBtn.textContent = "+ Nueva";

      addBtn.onclick = (e) => {
        e.preventDefault();
        const newStrat = prompt(`Nombre de la nueva estrategia (${customStrategies.length}/5):`);
        if (newStrat && newStrat.trim() !== '') {
          const formatted = newStrat.trim();
          if (!customStrategies.includes(formatted)) {
            customStrategies.push(formatted);
            saveStrategies();
            renderStrategyPills(formatted);
            updateDashboard();
          }
        }
      };
      strategyGroup.appendChild(addBtn);
    }
  }

  if (tradePhotoInput) {
    tradePhotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        photoFileName.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (ev) => { base64Image = ev.target.result; };
        reader.readAsDataURL(file);
      }
    });
  }

  function openDayModal(dateStr) {
    selectedDateForModal = dateStr;
    modalTitle.textContent = `Operaciones del ${dateStr}`;
    renderDayTradesList(dateStr);
    showListView();
    modal.classList.add('active');
  }

  function showListView() {
    dayTradesView.style.display = 'block';
    tradeForm.style.display = 'none';
    tradeForm.reset();
    editingTradeIdInput.value = '';
    base64Image = '';
    photoFileName.textContent = 'Adjuntar foto';
  }

  function showFormView(tradeToEdit = null) {
    dayTradesView.style.display = 'none';
    tradeForm.style.display = 'flex';
    tradeDateInput.value = selectedDateForModal;

    if (tradeToEdit) {
      editingTradeIdInput.value = tradeToEdit.id;
      tradeAssetInput.value = tradeToEdit.asset;
      tradeResultTypeInput.value = tradeToEdit.resultType;
      tradeDirectionInput.value = tradeToEdit.direction || 'LONG';
      document.getElementById('tradePnl').value = Math.abs(tradeToEdit.pnl);
      document.getElementById('tradeNotes').value = tradeToEdit.notes || '';
      base64Image = tradeToEdit.photo || '';
      photoFileName.textContent = base64Image ? 'Foto cargada (Cambiar)' : 'Adjuntar foto';

      typeButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-value') === tradeToEdit.resultType));
      assetButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-value') === tradeToEdit.asset));
      dirButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-value') === (tradeToEdit.direction || 'LONG')));
      
      renderStrategyPills(tradeToEdit.strategy || '');
    } else {
      editingTradeIdInput.value = '';
      tradeForm.reset();

      // Los campos hidden deben coincidir con los botones activos.
      // reset() no restaura estos valores tras modificarlos con .value.
      tradeResultTypeInput.value = 'tp';
      tradeAssetInput.value = 'NAS100';
      tradeDirectionInput.value = 'LONG';

      tradeDateInput.value = selectedDateForModal;
      base64Image = '';
      photoFileName.textContent = 'Adjuntar foto';
      typeButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-value') === 'tp'));
      assetButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-value') === 'NAS100'));
      dirButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-value') === 'LONG'));
      
      renderStrategyPills('');
    }
    lucide.createIcons();
  }

  function renderDayTradesList(dateStr) {
    tradesListContainer.innerHTML = '';
    const dayTrades = trades.filter(t => t.date === dateStr);

    if (dayTrades.length === 0) {
      tradesListContainer.innerHTML = `<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">No hay operaciones registradas este día.</p>`;
      return;
    }

    dayTrades.forEach(trade => {
      const row = document.createElement('div');
      row.className = 'trade-row-item';
      
      const sign = trade.pnl >= 0 ? '+' : '';
      const pnlColor = trade.pnl > 0 ? 'text-green' : (trade.pnl < 0 ? 'text-red' : '');
      let photoThumbnail = trade.photo ? `<img src="${trade.photo}" class="thumbnail-preview" data-photo="${trade.photo}" title="Ver foto">` : '';

      row.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:2px;">
          <span style="font-size:13px; font-weight:700;">${trade.asset} (${trade.direction || 'LONG'}) - <span class="${pnlColor}">${sign}$${trade.pnl.toFixed(2)}</span></span>
          <span style="font-size:10px; color:var(--accent-green); font-weight:600;">Estrategia: ${trade.strategy || 'Sin estrategia'}</span>
          <span style="font-size:10px; color:var(--text-muted);">Tipo: ${trade.resultType.toUpperCase()} | ${trade.notes || 'Sin notas'}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          ${photoThumbnail}
          <button type="button" class="btn-action-icon edit-btn" title="Editar"><i data-lucide="edit-2" style="width:16px;height:16px;"></i></button>
          <button type="button" class="btn-action-icon delete delete-btn" title="Eliminar"><i data-lucide="trash-2" style="width:16px;height:16px;"></i></button>
        </div>
      `;

      row.querySelector('.edit-btn').addEventListener('click', () => showFormView(trade));
      row.querySelector('.delete-btn').addEventListener('click', () => {
        deleteTradeFromCloud(trade.id);
        trades = trades.filter(t => t.id !== trade.id);
        saveTrades();
        renderDayTradesList(dateStr);
        updateDashboard();
      });

      const thumb = row.querySelector('.thumbnail-preview');
      if (thumb) {
        thumb.addEventListener('click', (e) => {
          lightboxImg.src = e.target.getAttribute('data-photo');
          lightboxModal.classList.add('active');
        });
      }

      tradesListContainer.appendChild(row);
    });
    lucide.createIcons();
  }

  if (lightboxModal) lightboxModal.addEventListener('click', () => lightboxModal.classList.remove('active'));
  if (openModalBtn) openModalBtn.addEventListener('click', () => openDayModal(new Date().toISOString().split('T')[0]));
  if (closeModalBtn) closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
  if (addNewTradeBtn) addNewTradeBtn.addEventListener('click', () => showFormView(null));
  if (backToListBtn) backToListBtn.addEventListener('click', () => showListView());

  if (tradeForm) {
    tradeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const rawPnl = parseFloat(document.getElementById('tradePnl').value) || 0;
      const resultType = tradeResultTypeInput.value.toLowerCase(); // 'tp', 'sl', etc.
      const strategyInput = document.getElementById('tradeStrategy');
      const strategyVal = strategyInput ? strategyInput.value : '';

      // --- CANDADO MATEMÁTICO BLINDADO ---
      let pnlValue = rawPnl;
      if (resultType === 'sl') {
        pnlValue = -Math.abs(rawPnl); // Fuerza siempre negativo para SL
      } else if (resultType === 'tp') {
        pnlValue = Math.abs(rawPnl);  // Fuerza siempre positivo para TP
      } else if (resultType === 'noop' || resultType === 'be') {
        pnlValue = 0;
      }
      // -----------------------------------

      const editId = editingTradeIdInput.value;

      const tradeObject = {
        id: editId || Date.now(),
        date: tradeDateInput.value,
        asset: tradeAssetInput.value,
        direction: tradeDirectionInput.value,
        strategy: strategyVal,
        resultType: resultType,
        pnl: pnlValue,
        notes: document.getElementById('tradeNotes').value,
        photo: base64Image
      };

      if (editId) {
        trades = trades.map(t => t.id == editId ? tradeObject : t);
      } else {
        trades.push(tradeObject);
        await syncTradeToCloud(tradeObject);
      }

      saveTrades();
      updateDashboard();
      openDayModal(selectedDateForModal);
    });
  }

  let dailyChartInstance = null;

  function updateDashboard() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    if (currentMonthLabel) currentMonthLabel.textContent = `${monthNames[month]} ${year}`;

    const activeTrades = trades.filter(t => t.resultType !== 'noop');
    const winningTrades = activeTrades.filter(t => t.pnl > 0);
    const losingTrades = activeTrades.filter(t => t.pnl < 0);
    
    const totalPnl = trades.reduce((acc, t) => acc + t.pnl, 0);
    const currentCapital = (isNaN(initialBalance) ? 0 : initialBalance) + totalPnl;

    const winRate = activeTrades.length > 0 ? Math.round((winningTrades.length / activeTrades.length) * 100) : 0;
    const grossProfit = winningTrades.reduce((acc, t) => acc + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + t.pnl, 0));
    const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 'MAX' : '0') : (grossProfit / grossLoss).toFixed(2);

    const avgWin = winningTrades.length > 0 ? (grossProfit / winningTrades.length).toFixed(0) : 0;
    const avgLoss = losingTrades.length > 0 ? (grossLoss / losingTrades.length).toFixed(0) : 0;
    const uniqueDays = [...new Set(trades.filter(t => t.resultType !== 'noop').map(t => t.date))];

    const capitalAmountEl = document.getElementById('capitalAmount');
    const capitalBadgeEl = document.getElementById('capitalBadge');

    if (capitalAmountEl) capitalAmountEl.textContent = `$${currentCapital.toFixed(2)}`;
    if (capitalBadgeEl) {
      const badgeSign = totalPnl >= 0 ? '+' : '';
      capitalBadgeEl.innerHTML = `${badgeSign}$${totalPnl.toFixed(2)} <span>resultado del mes</span>`;
    }

    const kpiWinRate = document.getElementById('kpiWinRate');
    const kpiProfitFactor = document.getElementById('kpiProfitFactor');
    const kpiAvgWL = document.getElementById('kpiAvgWL');
    const kpiStreak = document.getElementById('kpiStreak');
    const communityOps = document.getElementById('communityOps');
    const communityWinRate = document.getElementById('communityWinRate');
    const registeredTag = document.getElementById('registeredTag');

    if (kpiWinRate) kpiWinRate.textContent = `${winRate}%`;
    if (kpiProfitFactor) kpiProfitFactor.textContent = profitFactor;
    if (kpiAvgWL) kpiAvgWL.textContent = `+$${avgWin} / -$${avgLoss}`;
    if (kpiStreak) kpiStreak.textContent = `${uniqueDays.length}W`;
    if (communityOps) communityOps.textContent = activeTrades.length;
    if (communityWinRate) communityWinRate.textContent = `${winRate}%`;
    if (registeredTag) registeredTag.textContent = `${uniqueDays.length} días registrados`;

    renderCalendar();
    renderChart();
    renderStrategyColumns();
  }

  function renderStrategyColumns() {
    const container = document.getElementById('strategyColumnsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (customStrategies.length === 0) {
      container.innerHTML = `<p style="grid-column: 1/-1; font-size:12px; color:var(--text-muted); text-align:center; padding:12px;">Crea estrategias desde el registro de operaciones para compararlas aquí.</p>`;
      return;
    }

    const activeTrades = trades.filter(t => t.resultType !== 'noop');

    customStrategies.forEach(stratName => {
      const stratTrades = activeTrades.filter(t => t.strategy === stratName);
      const wins = stratTrades.filter(t => t.pnl > 0).length;
      const totalPnl = stratTrades.reduce((acc, t) => acc + t.pnl, 0);
      const winRate = stratTrades.length > 0 ? Math.round((wins / stratTrades.length) * 100) : 0;

      const pnlColor = totalPnl > 0 ? '#22c55e' : (totalPnl < 0 ? '#ef4444' : '#a1a1aa');
      const sign = totalPnl >= 0 ? '+' : '';

      const col = document.createElement('div');
      col.style.cssText = "background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;";
      
      col.innerHTML = `
        <div>
          <span style="font-size: 13px; font-weight: 700; color: var(--text-main); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${stratName}</span>
          <span style="font-size: 11px; color: var(--text-muted);">${stratTrades.length} trades | ${winRate}% Win</span>
        </div>
        <div>
          <span style="font-size: 15px; font-weight: 800; color: ${pnlColor}; display: block;">${sign}$${totalPnl.toFixed(2)}</span>
        </div>
      `;
      container.appendChild(col);
    });
  }

  function renderCalendar() {
    const calendarCells = document.getElementById('calendar-cells');
    if (!calendarCells) return;
    calendarCells.innerHTML = '';
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = new Date(year, month, 1).getDay();

    for (let i = 0; i < startOffset; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.style.visibility = 'hidden';
      calendarCells.appendChild(emptyCell);
    }

    for (let day = 1; day <= totalDays; day++) {
      const cell = document.createElement('div');
      const dayStr = day < 10 ? '0' + day : day;
      const monthStr = (month + 1) < 10 ? '0' + (month + 1) : (month + 1);
      const fullDate = `${year}-${monthStr}-${dayStr}`;

      const dayTrades = trades.filter(t => t.date === fullDate);
      const dayPnl = dayTrades.reduce((acc, t) => acc + t.pnl, 0);

      if (dayTrades.length > 0) {
        const dayResult = dayPnl > 0 ? 'tp' : dayPnl < 0 ? 'sl' : 'be';
        cell.className = `cell ${dayResult}`;
        const sign = dayPnl >= 0 ? '+' : '';
        cell.innerHTML = `
          <span class="cell-num">${dayStr}</span>
          <div>
            <div class="cell-pnl">${sign}$${dayPnl.toFixed(0)}</div>
            <div class="cell-sub">${dayTrades.length} reg</div>
          </div>
        `;
      } else {
        cell.className = `cell`;
        cell.innerHTML = `
          <span class="cell-num">${dayStr}</span>
          <span class="cell-sub">—</span>
        `;
      }

      cell.addEventListener('click', () => openDayModal(fullDate));
      calendarCells.appendChild(cell);
    }
  }

  function renderChart() {
    const canvasEl = document.getElementById('dailyChart');
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');

    const labels = ['00', '07', '14', '21', '28', '31'];
    let runningTotal = isNaN(initialBalance) ? 0 : initialBalance;
    const sortedTrades = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let dataPoints = [runningTotal, runningTotal, runningTotal, runningTotal, runningTotal, runningTotal];
    sortedTrades.forEach(t => {
      runningTotal += t.pnl;
      const dayNum = parseInt(t.date.split('-')[2]);
      if (dayNum <= 7) dataPoints[1] = runningTotal;
      else if (dayNum <= 14) dataPoints[2] = runningTotal;
      else if (dayNum <= 21) dataPoints[3] = runningTotal;
      else if (dayNum <= 28) dataPoints[4] = runningTotal;
      else dataPoints[5] = runningTotal;
    });

    for (let i = 1; i < dataPoints.length; i++) {
      if (dataPoints[i] === (isNaN(initialBalance) ? 0 : initialBalance) && dataPoints[i-1] !== (isNaN(initialBalance) ? 0 : initialBalance)) {
        dataPoints[i] = dataPoints[i-1];
      }
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(34, 197, 94, 0.25)');
    gradient.addColorStop(1, 'rgba(34, 197, 94, 0.0)');

    if (dailyChartInstance) {
      dailyChartInstance.data.datasets[0].data = dataPoints;
      dailyChartInstance.update();
      return;
    }

    if (typeof Chart !== 'undefined') {
      dailyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            data: dataPoints,
            borderColor: '#22c55e',
            borderWidth: 2.5,
            backgroundColor: gradient,
            fill: true,
            pointBackgroundColor: '#22c55e',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            tension: 0.2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#71717a', font: { size: 10 } } },
            y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#71717a', font: { size: 10 }, callback: (val) => '$' + val } }
          }
        }
      });
    }
  }

  await fetchTradesFromCloud();
  updateDashboard();
});
