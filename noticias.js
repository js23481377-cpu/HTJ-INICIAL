document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  const NEWS_STORAGE_KEY = 'life_trading_macro_news';
  
  // Base de datos anual completa para el 2026 (USD / NAS100 / XAUUSD)
  let defaultNews = [
    // --- OCTUBRE 2026 ---
    { id: 1, date: '2026-10-02', time: '07:30', title: 'USD: Nóminas No Agrícolas (NFP)' },
    { id: 2, date: '2026-10-08', time: '13:00', title: 'USD: Actas del FOMC' },
    { id: 3, date: '2026-10-14', time: '07:30', title: 'USD: IPC (CPI) de EE.UU.' },
    { id: 4, date: '2026-10-15', time: '07:30', title: 'USD: Ventas Minoristas' },
    { id: 5, date: '2026-10-22', time: '13:00', title: 'USD: Libro Beige de la FED' },
    { id: 6, date: '2026-10-29', time: '13:00', title: 'USD: Tipos de Interés FED' },

    // --- NOVIEMBRE 2026 ---
    { id: 7, date: '2026-11-06', time: '07:30', title: 'USD: Nóminas No Agrícolas (NFP)' },
    { id: 8, date: '2026-11-12', time: '07:30', title: 'USD: IPC (CPI) de EE.UU.' },
    { id: 9, date: '2026-11-18', time: '07:30', title: 'USD: Ventas Minoristas' },
    { id: 10, date: '2026-11-25', time: '13:00', title: 'USD: Actas del FOMC' },

    // --- DICIEMBRE 2026 ---
    { id: 11, date: '2026-12-04', time: '07:30', title: 'USD: Nóminas No Agrícolas (NFP)' },
    { id: 12, date: '2026-12-10', time: '07:30', title: 'USD: IPC (CPI) de EE.UU.' },
    { id: 13, date: '2026-12-16', time: '13:00', title: 'USD: Tipos de Interés FED' },
    { id: 14, date: '2026-12-17', time: '13:00', title: 'USD: Conferencia de prensa FOMC' },

    // --- ENERO 2026 (Ejemplo de meses anteriores/siguientes) ---
    { id: 15, date: '2026-01-09', time: '07:30', title: 'USD: Nóminas No Agrícolas (NFP)' },
    { id: 16, date: '2026-01-14', time: '07:30', title: 'USD: IPC (CPI) de EE.UU.' },

    // --- FEBRERO 2026 ---
    { id: 17, date: '2026-02-06', time: '07:30', title: 'USD: Nóminas No Agrícolas (NFP)' },
    { id: 18, date: '2026-02-11', time: '07:30', title: 'USD: IPC (CPI) de EE.UU.' },

    // --- MARZO 2026 ---
    { id: 19, date: '2026-03-06', time: '07:30', title: 'USD: Nóminas No Agrícolas (NFP)' },
    { id: 20, date: '2026-03-18', time: '13:00', title: 'USD: Tipos de Interés FED' },

    // --- ABRIL 2026 ---
    { id: 21, date: '2026-04-03', time: '07:30', title: 'USD: Nóminas No Agrícolas (NFP)' },
    { id: 22, date: '2026-04-15', time: '07:30', title: 'USD: IPC (CPI) de EE.UU.' },

    // --- MAYO 2026 ---
    { id: 23, date: '2026-05-08', time: '07:30', title: 'USD: Nóminas No Agrícolas (NFP)' },
    { id: 24, date: '2026-05-06', time: '13:00', title: 'USD: Tipos de Interés FED' },

    // --- JUNIO 2026 ---
    { id: 25, date: '2026-06-05', time: '07:30', title: 'USD: Nóminas No Agrícolas (NFP)' },
    { id: 26, date: '2026-06-17', time: '13:00', title: 'USD: Tipos de Interés FED' },

    // --- JULIO 2026 ---
    { id: 27, date: '2026-07-02', time: '07:30', title: 'USD: Nóminas No Agrícolas (NFP)' },
    { id: 28, date: '2026-07-15', time: '07:30', title: 'USD: IPC (CPI) de EE.UU.' },

    // --- AGOSTO 2026 ---
    { id: 29, date: '2026-08-07', time: '07:30', title: 'USD: Nóminas No Agrícolas (NFP)' },
    { id: 30, date: '2026-08-12', time: '07:30', title: 'USD: IPC (CPI) de EE.UU.' },

    // --- SEPTIEMBRE 2026 ---
    { id: 31, date: '2026-09-04', time: '07:30', title: 'USD: Nóminas No Agrícolas (NFP)' },
    { id: 32, date: '2026-09-16', time: '13:00', title: 'USD: Tipos de Interés FED' }
  ];

  let newsList = JSON.parse(localStorage.getItem(NEWS_STORAGE_KEY)) || defaultNews;

  function saveNews() {
    localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(newsList));
  }

  let currentDate = new Date(2026, 9, 1); // Octubre 2026 por defecto
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const newsModal = document.getElementById('newsModal');
  const addNewsBtn = document.getElementById('addNewsBtn');
  const refreshNewsBtn = document.getElementById('refreshNewsBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const newsForm = document.getElementById('newsForm');
  const newsDateInput = document.getElementById('newsDate');

  const prevMonthBtn = document.getElementById('prevMonthBtn');
  const nextMonthBtn = document.getElementById('nextMonthBtn');
  const currentMonthLabel = document.getElementById('currentMonthLabel');

  const todayStr = new Date().toISOString().split('T')[0];
  if (newsDateInput) newsDateInput.value = todayStr;

  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar();
    });
  }

  // Botón Actualizar: recarga los datos guardados en el navegador
  if (refreshNewsBtn) {
    refreshNewsBtn.addEventListener('click', () => {
      newsList = JSON.parse(localStorage.getItem(NEWS_STORAGE_KEY)) || defaultNews;
      renderCalendar();
      
      const icon = refreshNewsBtn.querySelector('i');
      if (icon) {
        icon.style.transform = 'rotate(360deg)';
        icon.style.transition = 'transform 0.5s ease';
        setTimeout(() => { icon.style.transform = 'rotate(0deg)'; }, 500);
      }
    });
  }

  function openModal(dateStr = todayStr) {
    if (newsDateInput) newsDateInput.value = dateStr;
    if (newsModal) newsModal.classList.add('active');
  }

  function closeModal() {
    if (newsModal) newsModal.classList.remove('active');
    if (newsForm) newsForm.reset();
  }

  if (addNewsBtn) addNewsBtn.addEventListener('click', () => openModal());
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);
  if (newsModal) {
    newsModal.addEventListener('click', (e) => {
      if (e.target === newsModal) closeModal();
    });
  }

  if (newsForm) {
    newsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newNews = {
        id: Date.now(),
        date: newsDateInput.value,
        time: document.getElementById('newsTime').value,
        title: document.getElementById('newsTitle').value
      };

      newsList.push(newNews);
      saveNews();
      closeModal();
      renderCalendar();
    });
  }

  function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    if (currentMonthLabel) {
      currentMonthLabel.textContent = `${monthNames[month]} ${year}`;
    }

    const calendarCells = document.getElementById('newsCalendarCells');
    if (!calendarCells) return;
    calendarCells.innerHTML = '';

    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = new Date(year, month, 1).getDay();

    for (let i = 0; i < startOffset; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.style.visibility = 'hidden';
      calendarCells.appendChild(emptyCell);
    }

    let monthNewsCount = 0;

    for (let day = 1; day <= totalDays; day++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const dayStr = day < 10 ? '0' + day : day;
      const monthStr = (month + 1) < 10 ? '0' + (month + 1) : (month + 1);
      const fullDate = `${year}-${monthStr}-${dayStr}`;

      const dayNews = newsList.filter(n => n.date === fullDate);
      monthNewsCount += dayNews.length;

      let newsHtml = '';
      dayNews.forEach(n => {
        newsHtml += `
          <div class="news-card-badge" title="${n.title}">
            <span class="news-card-time">${n.time}</span>
            <span class="news-card-title">${n.title}</span>
          </div>
        `;
      });

      cell.innerHTML = `
        <span class="cell-num">${dayStr}</span>
        <div style="display:flex; flex-direction:column; gap:2px; overflow:hidden;">
          ${newsHtml}
        </div>
      `;

      cell.addEventListener('click', () => openModal(fullDate));
      calendarCells.appendChild(cell);
    }

    const newsCountTag = document.getElementById('newsCountTag');
    if (newsCountTag) {
      newsCountTag.textContent = `${monthNewsCount} noticias este mes`;
    }
    lucide.createIcons();
  }

  renderCalendar();
});
