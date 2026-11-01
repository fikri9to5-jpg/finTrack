/**
 * FinTrack — Aplikasi Pencatatan Keuangan Pribadi
 * Frontend Application Logic (HTML + Tailwind CSS + Chart.js + Google Apps Script Integration)
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'fintrack_transactions_v1',
  CATEGORIES: 'fintrack_categories_v1',
  GAS_URL: 'fintrack_gas_webapp_url_v1',
  INITIALIZED: 'fintrack_initialized_v1',
};

// Kategori Dasar Bawaan sesuai PRD (Makan, Transportasi, Tagihan, Hiburan, Gaji, dll.)
const DEFAULT_CATEGORIES = [
  { id: 'cat-makan', name: 'Makan', type: 'Pengeluaran', color: '#f43f5e', isDefault: true },
  { id: 'cat-transportasi', name: 'Transportasi', type: 'Pengeluaran', color: '#f97316', isDefault: true },
  { id: 'cat-tagihan', name: 'Tagihan', type: 'Pengeluaran', color: '#eab308', isDefault: true },
  { id: 'cat-hiburan', name: 'Hiburan', type: 'Pengeluaran', color: '#8b5cf6', isDefault: true },
  { id: 'cat-belanja', name: 'Belanja', type: 'Pengeluaran', color: '#06b6d4', isDefault: false },
  { id: 'cat-kesehatan', name: 'Kesehatan', type: 'Pengeluaran', color: '#ec4899', isDefault: false },
  { id: 'cat-gaji', name: 'Gaji', type: 'Pemasukan', color: '#10b981', isDefault: true },
  { id: 'cat-bonus', name: 'Bonus & Freelance', type: 'Pemasukan', color: '#14b8a6', isDefault: false },
  { id: 'cat-investasi', name: 'Hasil Investasi', type: 'Pemasukan', color: '#3b82f6', isDefault: false },
];

const CHART_PALETTE = [
  '#f43f5e', '#f97316', '#eab308', '#8b5cf6', '#06b6d4',
  '#10b981', '#3b82f6', '#ec4899', '#6366f1', '#14b8a6',
];

const MONTH_NAMES = {
  '01': 'Januari',
  '02': 'Februari',
  '03': 'Maret',
  '04': 'April',
  '05': 'Mei',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'Agustus',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'Desember',
};

// State Aplikasi
const state = {
  transactions: [],
  categories: [],
  gasUrl: '',
  filterMonth: '',
  filterYear: '',
  filterType: 'all',
  searchQuery: '',
  chartType: 'doughnut', // 'doughnut' | 'bar'
  chartDataKind: 'Pengeluaran', // 'Pengeluaran' | 'Pemasukan'
  chartInstance: null,
};

// ============================================================================
// UTILITY HELPERS
// ============================================================================

function getTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatRupiah(amount) {
  const num = Number(amount) || 0;
  const isNegative = num < 0;
  const formatted = new Intl.NumberFormat('id-ID').format(Math.abs(Math.round(num)));
  return `${isNegative ? '- ' : ''}Rp ${formatted}`;
}

function formatDigitsOnly(str) {
  const digits = String(str).replace(/\D/g, '');
  if (!digits) return { raw: '', formatted: '' };
  const num = parseInt(digits, 10);
  return {
    raw: String(num),
    formatted: new Intl.NumberFormat('id-ID').format(num),
  };
}

function formatDateID(isoDate) {
  if (!isoDate) return '-';
  const parts = String(isoDate).slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthIdx = parseInt(m, 10) - 1;
  return `${parseInt(d, 10)} ${shortMonths[monthIdx] || m} ${y}`;
}

function generateId(prefix = 'tx') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClass =
    type === 'error'
      ? 'bg-rose-600 text-white'
      : type === 'info'
      ? 'bg-slate-800 text-white'
      : 'bg-emerald-600 text-white';

  toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs sm:text-sm font-semibold transition-all duration-300 ${bgClass}`;
  toast.innerHTML = `
    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
      ${
        type === 'error'
          ? '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />'
          : '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />'
      }
    </svg>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// STORAGE & GOOGLE APPS SCRIPT (GAS) SYNC
// ============================================================================

function loadLocalData() {
  try {
    const savedUrl = localStorage.getItem(STORAGE_KEYS.GAS_URL);
    state.gasUrl = savedUrl ? savedUrl.trim() : '';

    const savedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (savedCategories) {
      state.categories = JSON.parse(savedCategories);
    } else {
      state.categories = [...DEFAULT_CATEGORIES];
      saveCategoriesLocal();
    }

    const savedTx = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (savedTx) {
      state.transactions = JSON.parse(savedTx);
    } else if (!localStorage.getItem(STORAGE_KEYS.INITIALIZED)) {
      // Seed initial sample transactions on very first run so user sees live chart & dashboard immediately
      seedDemoTransactions(false);
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    }
  } catch (err) {
    console.error('Gagal memuat data lokal:', err);
    state.categories = [...DEFAULT_CATEGORIES];
    state.transactions = [];
  }
}

function saveTransactionsLocal() {
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(state.transactions));
}

function saveCategoriesLocal() {
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(state.categories));
}

function isRunningInGAS() {
  return typeof window.google !== 'undefined' && window.google.script && window.google.script.run;
}

function updateSyncStatusUI(status = 'idle') {
  const dot = document.getElementById('syncDot');
  const text = document.getElementById('syncText');
  const btnRefresh = document.getElementById('btnRefreshSync');

  const hasBackend = Boolean(state.gasUrl) || isRunningInGAS();

  if (btnRefresh) {
    btnRefresh.classList.toggle('hidden', !hasBackend);
    btnRefresh.classList.toggle('inline-flex', hasBackend);
  }

  if (!dot || !text) return;

  if (!hasBackend) {
    dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400';
    text.textContent = 'Lokal';
    return;
  }

  if (status === 'syncing') {
    dot.className = 'w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping';
    text.textContent = 'Sinkronisasi...';
  } else if (status === 'error') {
    dot.className = 'w-1.5 h-1.5 rounded-full bg-rose-500';
    text.textContent = 'Sheets Offline';
  } else {
    dot.className = 'w-1.5 h-1.5 rounded-full bg-sky-400';
    text.textContent = 'Google Sheets';
  }
}

/**
 * Mengirim request ke Google Apps Script (baik via google.script.run maupun fetch POST/GET)
 */
async function callGasBackend(action, payload = {}) {
  // 1. Jika di-host langsung di dalam HtmlService Google Apps Script
  if (isRunningInGAS()) {
    updateSyncStatusUI('syncing');
    return new Promise((resolve, reject) => {
      window.google.script.run
        .withSuccessHandler((res) => {
          updateSyncStatusUI('ok');
          resolve(res);
        })
        .withFailureHandler((err) => {
          updateSyncStatusUI('error');
          reject(err);
        })
        .handleClientRequest({ action, payload });
    });
  }

  // 2. Jika menggunakan URL Web App GAS eksternal
  if (!state.gasUrl) return null;

  updateSyncStatusUI('syncing');
  try {
    const response = await fetch(state.gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Menghindari CORS preflight pada GAS Web App
      },
      body: JSON.stringify({ action, payload }),
    });
    const data = await response.json();
    updateSyncStatusUI('ok');
    return data;
  } catch (err) {
    console.warn('Sinkronisasi GAS gagal, menggunakan penyimpanan lokal:', err);
    updateSyncStatusUI('error');
    return null;
  }
}

async function syncFromBackend() {
  if (!state.gasUrl && !isRunningInGAS()) return;

  const res = await callGasBackend('getAll');
  if (res && res.success) {
    if (Array.isArray(res.transactions)) {
      state.transactions = res.transactions;
      saveTransactionsLocal();
    }
    if (Array.isArray(res.categories) && res.categories.length > 0) {
      state.categories = res.categories;
      saveCategoriesLocal();
    }
    populateYearFilter();
    renderCategoryOptions();
    renderAll();
    showToast('Data berhasil disinkronkan dari Google Sheets', 'info');
  }
}

// ============================================================================
// DEMO DATA SEEDER
// ============================================================================

function seedDemoTransactions(notify = true) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');

  const sample = [
    {
      id: generateId('tx'),
      date: `${y}-${m}-01`,
      type: 'Pemasukan',
      category: 'Gaji',
      amount: 8500000,
      note: 'Gaji bulanan kantor',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId('tx'),
      date: `${y}-${m}-02`,
      type: 'Pengeluaran',
      category: 'Tagihan',
      amount: 650000,
      note: 'Tagihan listrik & internet WiFi',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId('tx'),
      date: `${y}-${m}-03`,
      type: 'Pengeluaran',
      category: 'Makan',
      amount: 45000,
      note: 'Makan siang ayam bakar & es teh',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId('tx'),
      date: `${y}-${m}-04`,
      type: 'Pengeluaran',
      category: 'Transportasi',
      amount: 120000,
      note: 'Isi bensin Pertamax & parkir',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId('tx'),
      date: `${y}-${m}-05`,
      type: 'Pengeluaran',
      category: 'Hiburan',
      amount: 185000,
      note: 'Langganan streaming & nonton bioskop',
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId('tx'),
      date: getTodayISO(),
      type: 'Pengeluaran',
      category: 'Makan',
      amount: 38000,
      note: 'Kopi susu & roti pagi',
      createdAt: new Date().toISOString(),
    },
  ];

  state.transactions = sample;
  saveTransactionsLocal();
  populateYearFilter();
  renderAll();
  if (notify) {
    showToast('Data contoh berhasil dimuat!');
  }
}

// ============================================================================
// FILTERING & PERIOD MANAGEMENT
// ============================================================================

function initPeriodFilters() {
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentYear = String(now.getFullYear());

  state.filterMonth = currentMonth;
  state.filterYear = currentYear;

  const monthSelect = document.getElementById('filterMonth');
  if (monthSelect) {
    monthSelect.value = state.filterMonth;
  }

  populateYearFilter();
}

function populateYearFilter() {
  const yearSelect = document.getElementById('filterYear');
  if (!yearSelect) return;

  const currentYear = new Date().getFullYear();
  const yearsSet = new Set([String(currentYear), String(currentYear - 1)]);

  state.transactions.forEach((tx) => {
    if (tx.date && tx.date.length >= 4) {
      yearsSet.add(tx.date.slice(0, 4));
    }
  });

  const sortedYears = Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
  yearSelect.innerHTML =
    `<option value="all" class="bg-slate-900">Semua Tahun</option>` +
    sortedYears
      .map((yr) => `<option value="${yr}" class="bg-slate-900">${yr}</option>`)
      .join('');

  if (sortedYears.includes(state.filterYear) || state.filterYear === 'all') {
    yearSelect.value = state.filterYear;
  } else {
    state.filterYear = String(currentYear);
    yearSelect.value = state.filterYear;
  }
}

/**
 * Mengambil transaksi untuk periode (Bulan & Tahun) yang aktif di Dashboard
 */
function getPeriodTransactions() {
  return state.transactions.filter((tx) => {
    if (!tx.date) return false;
    const [txYear, txMonth] = tx.date.split('-');
    const matchYear = state.filterYear === 'all' || txYear === state.filterYear;
    const matchMonth = state.filterMonth === 'all' || txMonth === state.filterMonth;
    return matchYear && matchMonth;
  });
}

/**
 * Mengambil transaksi untuk Tabel Riwayat (termasuk filter Jenis & Pencarian Catatan/Kategori)
 */
function getFilteredTableTransactions() {
  const periodTx = getPeriodTransactions();
  const q = state.searchQuery.trim().toLowerCase();

  return periodTx
    .filter((tx) => {
      const matchType = state.filterType === 'all' || tx.type === state.filterType;
      const matchSearch =
        !q ||
        (tx.note && tx.note.toLowerCase().includes(q)) ||
        (tx.category && tx.category.toLowerCase().includes(q));
      return matchType && matchSearch;
    })
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
}

// ============================================================================
// RENDER DASHBOARD SUMMARY, CHART & TABLE
// ============================================================================

function renderAll() {
  renderDashboardSummary();
  renderCategoryChart();
  renderTransactionHistory();
}

function renderDashboardSummary() {
  const periodTx = getPeriodTransactions();

  let totalIncome = 0;
  let totalExpense = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  periodTx.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'Pemasukan') {
      totalIncome += amt;
      incomeCount++;
    } else {
      totalExpense += amt;
      expenseCount++;
    }
  });

  const netBalance = totalIncome - totalExpense;
  const expenseRatio = totalIncome > 0 ? Math.min(999, Math.round((totalExpense / totalIncome) * 100)) : 0;

  // Update Period Header Label
  const periodLabel = document.getElementById('periodLabel');
  if (periodLabel) {
    const mName = state.filterMonth === 'all' ? 'Semua Bulan' : MONTH_NAMES[state.filterMonth] || '';
    const yName = state.filterYear === 'all' ? 'Semua Tahun' : state.filterYear;
    periodLabel.textContent = `Ringkasan Periode: ${mName} ${yName}`;
  }

  document.getElementById('summaryIncome').textContent = formatRupiah(totalIncome);
  document.getElementById('summaryIncomeCount').textContent = `${incomeCount} transaksi masuk`;

  document.getElementById('summaryExpense').textContent = formatRupiah(totalExpense);
  document.getElementById('summaryExpenseCount').textContent = `${expenseCount} transaksi keluar`;

  const balanceEl = document.getElementById('summaryBalance');
  balanceEl.textContent = formatRupiah(netBalance);
  balanceEl.className = `text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 ${
    netBalance < 0 ? 'text-rose-400' : 'text-white'
  }`;

  document.getElementById('summaryRatioText').textContent =
    totalIncome > 0 ? `Alokasi pengeluaran: ${expenseRatio}% dari pemasukan` : 'Belum ada pemasukan periode ini';
  document.getElementById('summaryTxCount').textContent = `${periodTx.length} transaksi`;
}

function renderCategoryChart() {
  const periodTx = getPeriodTransactions().filter((tx) => tx.type === state.chartDataKind);
  const canvas = document.getElementById('categoryChart');
  const emptyState = document.getElementById('chartEmptyState');
  const breakdownContainer = document.getElementById('categoryBreakdownList');

  if (!canvas || !breakdownContainer) return;

  // Agregasi per kategori
  const totalsByCategory = {};
  let grandTotal = 0;

  periodTx.forEach((tx) => {
    const cat = tx.category || 'Lainnya';
    const amt = Number(tx.amount) || 0;
    totalsByCategory[cat] = (totalsByCategory[cat] || 0) + amt;
    grandTotal += amt;
  });

  const sortedEntries = Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1]);

  if (sortedEntries.length === 0 || grandTotal === 0) {
    if (state.chartInstance) {
      state.chartInstance.destroy();
      state.chartInstance = null;
    }
    canvas.classList.add('opacity-0');
    emptyState.classList.remove('hidden');
    breakdownContainer.innerHTML = `
      <div class="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
        <p class="text-xs font-medium text-slate-500">Belum ada data ${state.chartDataKind.toLowerCase()} pada periode ini.</p>
      </div>
    `;
    return;
  }

  canvas.classList.remove('opacity-0');
  emptyState.classList.add('hidden');

  const labels = sortedEntries.map(([cat]) => cat);
  const values = sortedEntries.map(([, total]) => total);
  const colors = labels.map((catName, idx) => {
    const found = state.categories.find((c) => c.name === catName);
    return (found && found.color) || CHART_PALETTE[idx % CHART_PALETTE.length];
  });

  // Render Chart.js
  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  const isBar = state.chartType === 'bar';

  state.chartInstance = new Chart(canvas, {
    type: isBar ? 'bar' : 'doughnut',
    data: {
      labels,
      datasets: [
        {
          label: state.chartDataKind,
          data: values,
          backgroundColor: colors,
          borderColor: isBar ? colors : '#ffffff',
          borderWidth: isBar ? 0 : 2,
          borderRadius: isBar ? 8 : 0,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: isBar ? undefined : '64%',
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label(context) {
              const val = context.parsed.y !== undefined && isBar ? context.parsed.y : context.parsed;
              const pct = grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(1) : 0;
              return ` ${context.label}: ${formatRupiah(val)} (${pct}%)`;
            },
          },
        },
      },
      scales: isBar
        ? {
            y: {
              beginAtZero: true,
              grid: { color: '#f1f5f9' },
              ticks: {
                font: { size: 10 },
                callback: (val) => {
                  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}jt`;
                  if (val >= 1000) return `${(val / 1000).toFixed(0)}rb`;
                  return val;
                },
              },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 11 } },
            },
          }
        : {},
    },
  });

  // Render daftar rincian kategori & persentase
  breakdownContainer.innerHTML = sortedEntries
    .map(([catName, amount], idx) => {
      const pct = grandTotal > 0 ? ((amount / grandTotal) * 100).toFixed(1) : '0.0';
      const color = colors[idx];
      return `
        <div class="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100">
          <div class="flex items-center justify-between text-xs mb-1.5">
            <div class="flex items-center gap-2 font-semibold text-slate-800">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${color}"></span>
              <span class="truncate">${escapeHtml(catName)}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="font-bold text-slate-900">${formatRupiah(amount)}</span>
              <span class="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">${pct}%</span>
            </div>
          </div>
          <div class="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500" style="width: ${Math.max(3, Number(pct))}%; background-color: ${color}"></div>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderTransactionHistory() {
  const transactions = getFilteredTableTransactions();
  const tbody = document.getElementById('transactionTableBody');
  const mobileList = document.getElementById('transactionMobileList');
  const emptyState = document.getElementById('tableEmptyState');

  if (!tbody || !mobileList || !emptyState) return;

  if (transactions.length === 0) {
    tbody.innerHTML = '';
    mobileList.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  // Desktop Table Rows
  tbody.innerHTML = transactions
    .map((tx) => {
      const isIncome = tx.type === 'Pemasukan';
      const badgeClass = isIncome
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';
      const amountClass = isIncome ? 'text-emerald-600' : 'text-rose-600';
      const sign = isIncome ? '+' : '-';

      return `
        <tr class="hover:bg-slate-50/80 transition group">
          <td class="py-3.5 px-3 whitespace-nowrap font-medium text-slate-700">${formatDateID(tx.date)}</td>
          <td class="py-3.5 px-3 whitespace-nowrap">
            <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800">
              ${escapeHtml(tx.category)}
            </span>
          </td>
          <td class="py-3.5 px-3 text-slate-600 max-w-xs truncate">${
            tx.note ? escapeHtml(tx.note) : '<span class="text-slate-300 italic">Tanpa catatan</span>'
          }</td>
          <td class="py-3.5 px-3 whitespace-nowrap">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badgeClass}">
              ${escapeHtml(tx.type)}
            </span>
          </td>
          <td class="py-3.5 px-3 whitespace-nowrap text-right font-bold ${amountClass}">
            ${sign} ${formatRupiah(tx.amount)}
          </td>
          <td class="py-3.5 px-3 whitespace-nowrap text-right no-print">
            <div class="inline-flex items-center justify-end gap-1">
              <button type="button" data-edit-id="${escapeHtml(tx.id)}" class="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition" title="Edit Transaksi">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button type="button" data-delete-id="${escapeHtml(tx.id)}" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition" title="Hapus Transaksi">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  // Mobile Card List Rows
  mobileList.innerHTML = transactions
    .map((tx) => {
      const isIncome = tx.type === 'Pemasukan';
      const amountClass = isIncome ? 'text-emerald-600' : 'text-rose-600';
      const sign = isIncome ? '+' : '-';

      return `
        <div class="py-3.5 flex items-center justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-800">${escapeHtml(
                tx.category
              )}</span>
              <span class="text-xs text-slate-400">${formatDateID(tx.date)}</span>
            </div>
            <p class="text-xs text-slate-600 truncate mt-1">${
              tx.note ? escapeHtml(tx.note) : '<span class="text-slate-300 italic">Tanpa catatan</span>'
            }</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-sm font-bold ${amountClass}">${sign} ${formatRupiah(tx.amount)}</p>
            <div class="flex items-center justify-end gap-2 mt-1 no-print">
              <button type="button" data-edit-id="${escapeHtml(tx.id)}" class="text-[11px] font-semibold text-slate-400 hover:text-emerald-600">Edit</button>
              <span class="text-slate-300">&bull;</span>
              <button type="button" data-delete-id="${escapeHtml(tx.id)}" class="text-[11px] font-semibold text-slate-400 hover:text-rose-600">Hapus</button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

// ============================================================================
// TRANSACTION FORM & CRUD ACTIONS
// ============================================================================

function setTransactionTypeUI(type) {
  const hiddenInput = document.getElementById('txType');
  if (hiddenInput) hiddenInput.value = type;

  document.querySelectorAll('.tx-type-btn').forEach((btn) => {
    const btnType = btn.getAttribute('data-type');
    if (btnType === type) {
      if (type === 'Pengeluaran') {
        btn.className =
          'tx-type-btn py-2.5 px-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1.5 bg-rose-600 text-white shadow-sm';
      } else {
        btn.className =
          'tx-type-btn py-2.5 px-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1.5 bg-emerald-600 text-white shadow-sm';
      }
    } else {
      btn.className =
        'tx-type-btn py-2.5 px-3 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1.5 text-slate-600 hover:text-slate-900';
    }
  });

  renderCategoryOptions(type);
}

function renderCategoryOptions(selectedType = null, selectedCategoryName = null) {
  const type = selectedType || document.getElementById('txType')?.value || 'Pengeluaran';
  const select = document.getElementById('txCategory');
  if (!select) return;

  const filtered = state.categories.filter((c) => c.type === type);
  if (filtered.length === 0) {
    select.innerHTML = `<option value="Lainnya">Lainnya</option>`;
    return;
  }

  select.innerHTML = filtered
    .map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`)
    .join('');

  if (selectedCategoryName && filtered.some((c) => c.name === selectedCategoryName)) {
    select.value = selectedCategoryName;
  }
}

function resetTransactionForm() {
  document.getElementById('txId').value = '';
  document.getElementById('txAmountDisplay').value = '';
  document.getElementById('txAmount').value = '';
  document.getElementById('txDate').value = getTodayISO();
  document.getElementById('txNote').value = '';
  document.getElementById('formTitle').textContent = 'Catat Transaksi Cepat';
  document.getElementById('btnSubmitText').textContent = 'Simpan Transaksi';
  document.getElementById('btnCancelEdit').classList.add('hidden');
  hideFormError();
  setTransactionTypeUI('Pengeluaran');
}

function showFormError(msg) {
  const errEl = document.getElementById('formError');
  if (!errEl) return;
  errEl.textContent = msg;
  errEl.classList.remove('hidden');
}

function hideFormError() {
  const errEl = document.getElementById('formError');
  if (!errEl) return;
  errEl.textContent = '';
  errEl.classList.add('hidden');
}

async function handleTransactionSubmit(e) {
  e.preventDefault();
  hideFormError();

  const id = document.getElementById('txId').value.trim();
  const type = document.getElementById('txType').value;
  const amountRaw = Number(document.getElementById('txAmount').value);
  const date = document.getElementById('txDate').value;
  const category = document.getElementById('txCategory').value;
  const note = document.getElementById('txNote').value.trim();

  // Validasi Form sesuai PRD
  if (!amountRaw || amountRaw <= 0) {
    showFormError('Nominal wajib diisi dengan angka lebih dari Rp 0.');
    document.getElementById('txAmountDisplay').focus();
    return;
  }
  if (!date) {
    showFormError('Tanggal transaksi wajib diisi.');
    document.getElementById('txDate').focus();
    return;
  }
  if (!category) {
    showFormError('Silakan pilih kategori terlebih dahulu.');
    document.getElementById('txCategory').focus();
    return;
  }

  const isEdit = Boolean(id);
  const txRecord = {
    id: isEdit ? id : generateId('tx'),
    date,
    type,
    category,
    amount: amountRaw,
    note,
    createdAt: isEdit
      ? state.transactions.find((t) => t.id === id)?.createdAt || new Date().toISOString()
      : new Date().toISOString(),
  };

  if (isEdit) {
    const idx = state.transactions.findIndex((t) => t.id === id);
    if (idx !== -1) {
      state.transactions[idx] = txRecord;
    }
  } else {
    state.transactions.unshift(txRecord);
  }

  saveTransactionsLocal();

  // Pastikan filter periode mengikuti bulan/tahun transaksi yang baru diinput agar langsung terlihat
  const [txYear, txMonth] = date.split('-');
  if (state.filterYear !== 'all' && state.filterYear !== txYear) {
    state.filterYear = txYear;
  }
  if (state.filterMonth !== 'all' && state.filterMonth !== txMonth) {
    state.filterMonth = txMonth;
    document.getElementById('filterMonth').value = txMonth;
  }

  populateYearFilter();
  resetTransactionForm();
  renderAll();

  showToast(isEdit ? 'Transaksi berhasil diperbarui!' : 'Transaksi berhasil disimpan!');

  // Sinkronkan ke Google Sheets di belakang layar jika terhubung
  await callGasBackend(isEdit ? 'updateTransaction' : 'addTransaction', txRecord);
}

function startEditTransaction(id) {
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) return;

  document.getElementById('txId').value = tx.id;
  setTransactionTypeUI(tx.type);
  renderCategoryOptions(tx.type, tx.category);

  const { raw, formatted } = formatDigitsOnly(tx.amount);
  document.getElementById('txAmount').value = raw;
  document.getElementById('txAmountDisplay').value = formatted;
  document.getElementById('txDate').value = tx.date;
  document.getElementById('txNote').value = tx.note || '';

  document.getElementById('formTitle').textContent = 'Edit Transaksi';
  document.getElementById('btnSubmitText').textContent = 'Perbarui Transaksi';
  document.getElementById('btnCancelEdit').classList.remove('hidden');
  hideFormError();

  document.getElementById('transactionForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteTransaction(id) {
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) return;

  state.transactions = state.transactions.filter((t) => t.id !== id);
  saveTransactionsLocal();
  renderAll();
  showToast('Transaksi dihapus', 'info');

  await callGasBackend('deleteTransaction', { id });
}

// ============================================================================
// CATEGORY MANAGEMENT MODAL
// ============================================================================

function openCategoryModal() {
  const modal = document.getElementById('categoryModal');
  if (!modal) return;
  resetCategoryForm();
  renderCategoryManagerList();
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeCategoryModal() {
  const modal = document.getElementById('categoryModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function resetCategoryForm() {
  document.getElementById('editCategoryOldName').value = '';
  document.getElementById('newCategoryName').value = '';
  document.getElementById('btnSaveCategory').textContent = 'Tambah';
}

function renderCategoryManagerList() {
  const listEl = document.getElementById('categoryManagerList');
  if (!listEl) return;

  listEl.innerHTML = state.categories
    .map((cat) => {
      const badgeColor =
        cat.type === 'Pemasukan'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-rose-50 text-rose-700 border-rose-200';

      return `
        <div class="px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-3 h-3 rounded-full shrink-0" style="background-color: ${cat.color || '#10b981'}"></span>
            <span class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(cat.name)}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeColor}">
              ${escapeHtml(cat.type)}
            </span>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" data-edit-cat="${escapeHtml(cat.name)}" class="text-xs font-semibold text-slate-500 hover:text-emerald-600 px-2 py-1 rounded-lg hover:bg-emerald-50">
              Ubah
            </button>
            <button type="button" data-delete-cat="${escapeHtml(cat.name)}" class="text-xs font-semibold text-slate-400 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50">
              Hapus
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

async function handleCategorySubmit(e) {
  e.preventDefault();
  const oldName = document.getElementById('editCategoryOldName').value.trim();
  const newName = document.getElementById('newCategoryName').value.trim();
  const type = document.getElementById('newCategoryType').value;

  if (!newName) return;

  // Cek duplikasi nama kategori
  const duplicate = state.categories.find(
    (c) => c.name.toLowerCase() === newName.toLowerCase() && c.name !== oldName
  );
  if (duplicate) {
    showToast('Nama kategori sudah ada!', 'error');
    return;
  }

  if (oldName) {
    // Update nama/jenis kategori & perbarui referensi transaksi yang memakai nama lama
    const idx = state.categories.findIndex((c) => c.name === oldName);
    if (idx !== -1) {
      state.categories[idx].name = newName;
      state.categories[idx].type = type;
    }
    state.transactions.forEach((tx) => {
      if (tx.category === oldName) {
        tx.category = newName;
      }
    });
    saveTransactionsLocal();
    showToast(`Kategori "${oldName}" diubah menjadi "${newName}"`);
  } else {
    const color = CHART_PALETTE[state.categories.length % CHART_PALETTE.length];
    state.categories.push({
      id: generateId('cat'),
      name: newName,
      type,
      color,
      isDefault: false,
    });
    showToast(`Kategori "${newName}" ditambahkan!`);
  }

  saveCategoriesLocal();
  resetCategoryForm();
  renderCategoryManagerList();
  renderCategoryOptions();
  renderAll();

  await callGasBackend('saveCategories', { categories: state.categories });
}

// ============================================================================
// EXPORT CSV & PRINT PDF
// ============================================================================

function exportToCSV() {
  const rows = getFilteredTableTransactions();
  if (rows.length === 0) {
    showToast('Tidak ada data transaksi untuk diekspor', 'error');
    return;
  }

  const headers = ['ID', 'Tanggal', 'Jenis Transaksi', 'Kategori', 'Nominal (Rp)', 'Catatan'];
  const csvLines = [
    headers.join(','),
    ...rows.map((tx) =>
      [
        `"${tx.id}"`,
        `"${tx.date}"`,
        `"${tx.type}"`,
        `"${String(tx.category).replace(/"/g, '""')}"`,
        tx.amount,
        `"${String(tx.note || '').replace(/"/g, '""')}"`,
      ].join(',')
    ),
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Laporan-FinTrack-${state.filterYear}-${state.filterMonth}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Laporan CSV berhasil diunduh!');
}

// ============================================================================
// EVENT LISTENERS & INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  loadLocalData();
  initPeriodFilters();
  resetTransactionForm();
  updateSyncStatusUI();
  renderAll();

  // Jika ada koneksi GAS, sinkronkan saat aplikasi dibuka
  if (state.gasUrl || isRunningInGAS()) {
    syncFromBackend();
  }

  // Toggle Jenis Transaksi di Form Input
  document.querySelectorAll('.tx-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const selectedType = btn.getAttribute('data-type');
      setTransactionTypeUI(selectedType);
    });
  });

  // Live Rupiah Formatting pada Input Nominal
  const amountDisplay = document.getElementById('txAmountDisplay');
  const amountHidden = document.getElementById('txAmount');
  if (amountDisplay && amountHidden) {
    amountDisplay.addEventListener('input', (e) => {
      const { raw, formatted } = formatDigitsOnly(e.target.value);
      amountHidden.value = raw;
      amountDisplay.value = formatted;
    });
  }

  // Tombol Quick Nominal (15rb, 25rb, 50rb, dst.)
  document.querySelectorAll('.quick-amount-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-quick-amount');
      const { raw, formatted } = formatDigitsOnly(val);
      amountHidden.value = raw;
      amountDisplay.value = formatted;
    });
  });

  // Submit Form Transaksi
  document.getElementById('transactionForm')?.addEventListener('submit', handleTransactionSubmit);

  // Batal Edit Transaksi
  document.getElementById('btnCancelEdit')?.addEventListener('click', resetTransactionForm);

  // Filter Bulan & Tahun
  document.getElementById('filterMonth')?.addEventListener('change', (e) => {
    state.filterMonth = e.target.value;
    renderAll();
  });

  document.getElementById('filterYear')?.addEventListener('change', (e) => {
    state.filterYear = e.target.value;
    renderAll();
  });

  // Filter Jenis & Search di Tabel Riwayat
  document.getElementById('filterType')?.addEventListener('change', (e) => {
    state.filterType = e.target.value;
    renderTransactionHistory();
  });

  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderTransactionHistory();
  });

  // Toggle Tipe Grafik (Pie / Bar) & Data Grafik (Pengeluaran / Pemasukan)
  document.getElementById('chartDataKind')?.addEventListener('change', (e) => {
    state.chartDataKind = e.target.value;
    renderCategoryChart();
  });

  document.querySelectorAll('.chart-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.chartType = btn.getAttribute('data-chart-type');
      document.querySelectorAll('.chart-type-btn').forEach((b) => {
        const active = b.getAttribute('data-chart-type') === state.chartType;
        b.className = active
          ? 'chart-type-btn px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-slate-900 shadow-sm transition'
          : 'chart-type-btn px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition';
      });
      renderCategoryChart();
    });
  });

  // Delegasi Klik Edit & Hapus pada Tabel dan Mobile List
  const handleRowActionClick = (e) => {
    const editBtn = e.target.closest('[data-edit-id]');
    if (editBtn) {
      startEditTransaction(editBtn.getAttribute('data-edit-id'));
      return;
    }
    const delBtn = e.target.closest('[data-delete-id]');
    if (delBtn) {
      deleteTransaction(delBtn.getAttribute('data-delete-id'));
    }
  };
  document.getElementById('transactionTableBody')?.addEventListener('click', handleRowActionClick);
  document.getElementById('transactionMobileList')?.addEventListener('click', handleRowActionClick);

  // Export CSV & Cetak PDF
  document.getElementById('btnExportCsv')?.addEventListener('click', exportToCSV);
  document.getElementById('btnPrintPdf')?.addEventListener('click', () => window.print());

  // Modal Manajemen Kategori
  document.getElementById('btnOpenCategories')?.addEventListener('click', openCategoryModal);
  document.getElementById('btnQuickAddCategory')?.addEventListener('click', openCategoryModal);
  document.getElementById('btnCloseCategories')?.addEventListener('click', closeCategoryModal);
  document.getElementById('btnDoneCategories')?.addEventListener('click', closeCategoryModal);
  document.getElementById('categoryForm')?.addEventListener('submit', handleCategorySubmit);

  document.getElementById('categoryManagerList')?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit-cat]');
    if (editBtn) {
      const catName = editBtn.getAttribute('data-edit-cat');
      const cat = state.categories.find((c) => c.name === catName);
      if (cat) {
        document.getElementById('editCategoryOldName').value = cat.name;
        document.getElementById('newCategoryName').value = cat.name;
        document.getElementById('newCategoryType').value = cat.type;
        document.getElementById('btnSaveCategory').textContent = 'Simpan';
        document.getElementById('newCategoryName').focus();
      }
      return;
    }

    const delBtn = e.target.closest('[data-delete-cat]');
    if (delBtn) {
      const catName = delBtn.getAttribute('data-delete-cat');
      if (state.categories.length <= 1) {
        showToast('Minimal harus ada 1 kategori tersisa', 'error');
        return;
      }
      state.categories = state.categories.filter((c) => c.name !== catName);
      saveCategoriesLocal();
      renderCategoryManagerList();
      renderCategoryOptions();
      showToast(`Kategori "${catName}" dihapus`, 'info');
      await callGasBackend('saveCategories', { categories: state.categories });
    }
  });

  document.getElementById('btnResetCategories')?.addEventListener('click', async () => {
    state.categories = [...DEFAULT_CATEGORIES];
    saveCategoriesLocal();
    renderCategoryManagerList();
    renderCategoryOptions();
    renderAll();
    showToast('Kategori dikembalikan ke bawaan');
    await callGasBackend('saveCategories', { categories: state.categories });
  });

  // Modal Pengaturan Google Sheets (GAS)
  const settingsModal = document.getElementById('settingsModal');
  const openSettings = () => {
    document.getElementById('gasUrlInput').value = state.gasUrl;
    settingsModal.classList.remove('hidden');
    settingsModal.classList.add('flex');
  };
  const closeSettings = () => {
    settingsModal.classList.add('hidden');
    settingsModal.classList.remove('flex');
  };

  document.getElementById('btnOpenSettings')?.addEventListener('click', openSettings);
  document.getElementById('btnCloseSettings')?.addEventListener('click', closeSettings);

  document.getElementById('btnSaveSettings')?.addEventListener('click', async () => {
    const url = document.getElementById('gasUrlInput').value.trim();
    state.gasUrl = url;
    localStorage.setItem(STORAGE_KEYS.GAS_URL, url);
    updateSyncStatusUI();
    closeSettings();
    showToast(url ? 'URL Google Apps Script disimpan!' : 'Beralih ke mode penyimpanan lokal');
    if (url) {
      await syncFromBackend();
    }
  });

  document.getElementById('btnRefreshSync')?.addEventListener('click', syncFromBackend);

  document.getElementById('btnSeedDemoData')?.addEventListener('click', () => {
    seedDemoTransactions(true);
    closeSettings();
  });

  document.getElementById('btnClearAllData')?.addEventListener('click', () => {
    state.transactions = [];
    saveTransactionsLocal();
    renderAll();
    closeSettings();
    showToast('Semua data transaksi lokal telah dihapus', 'info');
  });
});
