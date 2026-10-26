document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  const STORAGE_KEY = 'life_trading_backtesting_operations';
  const BALANCE_KEY = 'life_trading_backtesting_balance';
  const STRATEGIES_KEY = 'life_trading_backtesting_custom_strategies';
  
  let trades = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  let initialBalance = parseFloat(localStorage.getItem(BALANCE_KEY));
  let customStrategies = JSON.parse(localStorage.getItem(STRATEGIES_KEY)) || [];

  if (isNaN(initialBalance)) {
    initialBalance = 10000; // Capital simulado por defecto
    localStorage.setItem(BALANCE_KEY, initialBalance);
  }

  function saveTrades() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  }

  function saveStrategies() {
    localStorage.setItem(STRATEGIES_KEY, JSON.stringify(customStrategies));
  }

  const editBalanceBtn = document.getElementById('editBalanceBtn');
  if (editBalanceBtn) {
    editBalanceBtn.addEventListener('click', () => {
      const newBalance = prompt("Actualiza tu capital simulado inicial:", initialBalance);
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

  let currentDate = new Date(2026, 9, 1);
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

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

  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      updateDashboard();
    });
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      updateDashboard();
    });
  }

  // --- BOTONES ESTÁTICOS NORMALES (TIPO, ACTIVO, DIRECCIÓN) ---
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

  // --- BURBUJAS DE ESTRATEGIA EN BACKTESTING ---
  function renderStrategyPills(selectedStrategy = "") {
    const strategyGroup = document.getElementById('strategyGroup');
    const tradeStrategyInput = document.getElementById('tradeStrategy');
    if (!strategyGroup) return;

    strategyGroup.innerHTML = '';
    if (tradeStrategyInput) tradeStrategyInput.value = selectedStrategy;

    // 1. Burbuja "Sin estrategia"
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

    // 2. Burbujas creadas por el usuario (Límite de 5)
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

    // 3. Botón + Nueva (Máximo 5)
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
    modalTitle.textContent = `Pruebas del ${dateStr}`;
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
      tradesListContainer.innerHTML = `<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">No hay pruebas registradas este día.</p>`;
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
          <span style="font-size:10px; color:#38bdf8; font-weight:600;">Estrategia: ${trade.strategy || 'Sin estrategia'}</span>
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

  if (lightboxModal) {
    lightboxModal.addEventListener('click', () => lightboxModal.classList.remove('active'));
  }

  if (openModalBtn) openModalBtn.addEventListener('click', () => openDayModal(new Date().toISOString().split('T')[0]));
  if (closeModalBtn) closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
  if (modal) {
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
  }
  if (addNewTradeBtn) addNewTradeBtn.addEventListener('click', () => showFormView(null));
  if (backToListBtn) backToListBtn.addEventListener('click', () => showListView());

  if (tradeForm) {
    tradeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      let pnlValue = parseFloat(document.getElementById('tradePnl').value) || 0;
      const resultType = tradeResultTypeInput.value;
      const strategyInput = document.getElementById('tradeStrategy');
      const strategyVal = strategyInput ? strategyInput.value : '';

      if (resultType === 'sl' && pnlValue > 0) pnlValue = -pnlValue;
      if (resultType === 'noop' || resultType === 'be') pnlValue = 0;

      const editId = editingTradeIdInput.value;

      if (editId) {
        trades = trades.map(t => t.id == editId ? {
          ...t,
          date: tradeDateInput.value,
          asset: tradeAssetInput.value,
          direction: tradeDirectionInput.value,
          strategy: strategyVal,
          resultType: resultType,
          pnl: pnlValue,
          notes: document.getElementById('tradeNotes').value,
          photo: base64Image
        } : t);
      } else {
        trades.push({
          id: Date.now(),
          date: tradeDateInput.value,
          asset: tradeAssetInput.value,
          direction: tradeDirectionInput.value,
          strategy: strategyVal,
          resultType: resultType,
          pnl: pnlValue,
          notes: document.getElementById('tradeNotes').value,
          photo: base64Image
        });
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
    if (currentMonthLabel) {
      currentMonthLabel.textContent = `${monthNames[month]} ${year}`;
    }

    const activeTrades = trades.filter(t => t.resultType !== 'noop');
    const winningTrades = activeTrades.filter(t => t.pnl > 0);
    const losingTrades = activeTrades.filter(t => t.pnl < 0);
    
    const totalPnl = trades.reduce((acc, t) => acc + t.pnl, 0);
    const currentCapital = initialBalance + totalPnl;

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
      capitalBadgeEl.innerHTML = `${badgeSign}$${totalPnl.toFixed(2)} <span>resultado de pruebas</span>`;
    }

    document.getElementById('kpiWinRate').textContent = `${winRate}%`;
    document.getElementById('kpiProfitFactor').textContent = profitFactor;
    document.getElementById('kpiAvgWL').textContent = `+$${avgWin} / -$${avgLoss}`;
    document.getElementById('kpiStreak').textContent = `${uniqueDays.length}W`;
    document.getElementById('registeredTag').textContent = `${uniqueDays.length} días simulados`;

    renderCalendar();
    renderChart();
    renderStrategyColumns();
  }

  // --- COLUMNAS DE RENDIMIENTO POR ESTRATEGIA EN BACKTESTING ---
  function renderStrategyColumns() {
    const container = document.getElementById('strategyColumnsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (customStrategies.length === 0) {
      container.innerHTML = `<p style="grid-column: 1/-1; font-size:12px; color:var(--text-muted); text-align:center; padding:12px;">Crea estrategias desde el registro de pruebas para compararlas aquí.</p>`;
      return;
    }

    const activeTrades = trades.filter(t => t.resultType !== 'noop');

    customStrategies.forEach(stratName => {
      const stratTrades = activeTrades.filter(t => t.strategy === stratName);
      const wins = stratTrades.filter(t => t.pnl > 0).length;
      const totalPnl = stratTrades.reduce((acc, t) => acc + t.pnl, 0);
      const winRate = stratTrades.length > 0 ? Math.round((wins / stratTrades.length) * 100) : 0;

      const pnlColor = totalPnl > 0 ? '#38bdf8' : (totalPnl < 0 ? '#ef4444' : '#a1a1aa');
      const sign = totalPnl >= 0 ? '+' : '';

      const col = document.createElement('div');
      col.style.cssText = "background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;";
      
      col.innerHTML = `
        <div>
          <span style="font-size: 13px; font-weight: 700; color: var(--text-main); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${stratName}</span>
          <span style="font-size: 11px; color: var(--text-muted);">${stratTrades.length} tests | ${winRate}% Win</span>
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
        const lastTrade = dayTrades[dayTrades.length - 1];
        cell.className = `cell ${lastTrade.resultType}`;
        const sign = dayPnl >= 0 ? '+' : '';
        cell.innerHTML = `
          <span class="cell-num">${dayStr}</span>
          <div>
            <div class="cell-pnl">${sign}$${dayPnl.toFixed(0)}</div>
            <div class="cell-sub">${dayTrades.length} test</div>
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
    let runningTotal = initialBalance;
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
      if (dataPoints[i] === initialBalance && dataPoints[i-1] !== initialBalance) {
        dataPoints[i] = dataPoints[i-1];
      }
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

    if (dailyChartInstance) {
      dailyChartInstance.data.datasets[0].data = dataPoints;
      dailyChartInstance.update();
      return;
    }

    dailyChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: dataPoints,
          borderColor: '#38bdf8',
          borderWidth: 2.5,
          backgroundColor: gradient,
          fill: true,
          pointBackgroundColor: '#38bdf8',
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

  updateDashboard();
});
