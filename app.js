/**
 * FinTrack — Aplikasi Pencatatan Keuangan Pribadi
 * Frontend Application Logic (HTML + Tailwind CSS + Chart.js + Google Apps Script Integration)
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'fintrack_transactions_v1',
  CATEGORIES: 'fintrack_categories_v1',
  ASSETS: 'fintrack_assets_v1',
  GAS_URL: 'fintrack_gas_webapp_url_v1',
  INITIALIZED: 'fintrack_initialized_v1',
  ASSETS_INITIALIZED: 'fintrack_assets_initialized_v1',
};

const ASSET_CATEGORY_META = {
  'Kas & Bank': { color: '#0ea5e9', badgeBg: 'bg-sky-50 text-sky-700 border-sky-200', isLiquid: true },
  'E-Wallet': { color: '#06b6d4', badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200', isLiquid: true },
  'Investasi': { color: '#10b981', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200', isLiquid: false },
  'Emas & Logam Mulia': { color: '#f59e0b', badgeBg: 'bg-amber-50 text-amber-700 border-amber-200', isLiquid: false },
  'Aset Fisik & Properti': { color: '#8b5cf6', badgeBg: 'bg-violet-50 text-violet-700 border-violet-200', isLiquid: false },
  'Lainnya': { color: '#64748b', badgeBg: 'bg-slate-100 text-slate-700 border-slate-200', isLiquid: false },
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
  assets: [],
  gasUrl: '',
  filterMonth: '',
  filterYear: '',
  filterType: 'all',
  filterAssetCategory: 'all',
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

    const savedAssets = localStorage.getItem(STORAGE_KEYS.ASSETS);
    if (savedAssets) {
      state.assets = JSON.parse(savedAssets);
    } else if (!localStorage.getItem(STORAGE_KEYS.ASSETS_INITIALIZED)) {
      seedDemoAssets();
      localStorage.setItem(STORAGE_KEYS.ASSETS_INITIALIZED, 'true');
    }
  } catch (err) {
    console.error('Gagal memuat data lokal:', err);
    state.categories = [...DEFAULT_CATEGORIES];
    state.transactions = [];
    state.assets = [];
  }
}

function saveTransactionsLocal() {
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(state.transactions));
}

function saveCategoriesLocal() {
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(state.categories));
}

function saveAssetsLocal() {
  localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(state.assets));
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
    if (Array.isArray(res.assets)) {
      state.assets = res.assets;
      saveAssetsLocal();
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

function seedDemoAssets() {
  const today = getTodayISO();
  state.assets = [
    {
      id: generateId('ast'),
      name: 'Tabungan BCA',
      category: 'Kas & Bank',
      value: 18500000,
      note: 'Rekening operasional & dana darurat',
      updatedAt: today,
    },
    {
      id: generateId('ast'),
      name: 'GoPay & ShopeePay',
      category: 'E-Wallet',
      value: 1250000,
      note: 'Saldo dompet digital harian',
      updatedAt: today,
    },
    {
      id: generateId('ast'),
      name: 'Reksa Dana Bibit',
      category: 'Investasi',
      value: 25000000,
      note: 'Reksa dana pasar uang & obligasi',
      updatedAt: today,
    },
    {
      id: generateId('ast'),
      name: 'Emas Antam (10 gram)',
      category: 'Emas & Logam Mulia',
      value: 14200000,
      note: 'Simpanan logam mulia jangka panjang',
      updatedAt: today,
    },
    {
      id: generateId('ast'),
      name: 'MacBook Air M2',
      category: 'Aset Fisik & Properti',
      value: 15500000,
      note: 'Perangkat kerja produktif',
      updatedAt: today,
    },
  ];
  saveAssetsLocal();
}

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
  if (notify) {
    seedDemoAssets();
  }
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
  renderAssetsSection();
  renderAssetFormOptions();
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
    } else if (tx.type === 'Pengeluaran') {
      totalExpense += amt;
      expenseCount++;
    } else if (tx.type === 'Transfer') {
      // Mutasi antar aset tidak menambah pemasukan/pengeluaran, kecuali jika ada biaya admin transfer
      const fee = Number(tx.adminFee) || 0;
      if (fee > 0) {
        totalExpense += fee;
      }
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
  const allPeriodTx = getPeriodTransactions();
  const canvas = document.getElementById('categoryChart');
  const emptyState = document.getElementById('chartEmptyState');
  const breakdownContainer = document.getElementById('categoryBreakdownList');

  if (!canvas || !breakdownContainer) return;

  // Agregasi per kategori
  const totalsByCategory = {};
  let grandTotal = 0;

  allPeriodTx.forEach((tx) => {
    if (tx.type === state.chartDataKind) {
      const cat = tx.category || 'Lainnya';
      const amt = Number(tx.amount) || 0;
      totalsByCategory[cat] = (totalsByCategory[cat] || 0) + amt;
      grandTotal += amt;
    } else if (tx.type === 'Transfer' && state.chartDataKind === 'Pengeluaran') {
      const fee = Number(tx.adminFee) || 0;
      if (fee > 0) {
        const feeCat = 'Biaya Admin Transfer';
        totalsByCategory[feeCat] = (totalsByCategory[feeCat] || 0) + fee;
        grandTotal += fee;
      }
    }
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
      const isTransfer = tx.type === 'Transfer';

      const badgeClass = isTransfer
        ? 'bg-sky-50 text-sky-700 border-sky-200'
        : isIncome
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';

      const amountClass = isTransfer
        ? 'text-sky-600'
        : isIncome
        ? 'text-emerald-600'
        : 'text-rose-600';

      const sign = isTransfer ? '⇄' : isIncome ? '+' : '-';
      const adminFee = Number(tx.adminFee) || 0;

      // Info aset terkait (untuk Pemasukan / Pengeluaran)
      const linkedAsset = tx.assetId ? state.assets.find((a) => a.id === tx.assetId) : null;
      const assetBadgeHtml = linkedAsset
        ? `<span class="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80">${escapeHtml(
            linkedAsset.name
          )}</span>`
        : tx.assetName
        ? `<span class="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80">${escapeHtml(
            tx.assetName
          )}</span>`
        : '';

      return `
        <tr class="hover:bg-slate-50/80 transition group">
          <td class="py-3.5 px-3 whitespace-nowrap font-medium text-slate-700">${formatDateID(tx.date)}</td>
          <td class="py-3.5 px-3 whitespace-nowrap">
            <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
              isTransfer ? 'bg-sky-50 text-sky-900 border border-sky-200' : 'bg-slate-100 text-slate-800'
            }">
              ${escapeHtml(tx.category)}
            </span>
            ${!isTransfer ? assetBadgeHtml : ''}
          </td>
          <td class="py-3.5 px-3 text-slate-600 max-w-xs truncate">${
            tx.note ? escapeHtml(tx.note) : '<span class="text-slate-300 italic">Tanpa catatan</span>'
          }</td>
          <td class="py-3.5 px-3 whitespace-nowrap">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badgeClass}">
              ${isTransfer ? 'Transfer Aset' : escapeHtml(tx.type)}
            </span>
          </td>
          <td class="py-3.5 px-3 whitespace-nowrap text-right">
            <div class="font-bold ${amountClass}">${sign} ${formatRupiah(tx.amount)}</div>
            ${
              isTransfer && adminFee > 0
                ? `<div class="text-[11px] text-rose-500 font-medium">Biaya Admin: -${formatRupiah(adminFee)}</div>`
                : ''
            }
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
      const isTransfer = tx.type === 'Transfer';
      const amountClass = isTransfer ? 'text-sky-600' : isIncome ? 'text-emerald-600' : 'text-rose-600';
      const sign = isTransfer ? '⇄' : isIncome ? '+' : '-';
      const adminFee = Number(tx.adminFee) || 0;
      const linkedAsset = tx.assetId ? state.assets.find((a) => a.id === tx.assetId) : null;
      const assetLabel = linkedAsset ? linkedAsset.name : tx.assetName || '';

      return `
        <div class="py-3.5 flex items-center justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="px-2 py-0.5 rounded-md text-xs font-bold ${
                isTransfer ? 'bg-sky-50 text-sky-900 border border-sky-200' : 'bg-slate-100 text-slate-800'
              }">${escapeHtml(tx.category)}</span>
              ${
                !isTransfer && assetLabel
                  ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">${escapeHtml(
                      assetLabel
                    )}</span>`
                  : ''
              }
              <span class="text-xs text-slate-400">${formatDateID(tx.date)}</span>
            </div>
            <p class="text-xs text-slate-600 truncate mt-1">${
              tx.note ? escapeHtml(tx.note) : '<span class="text-slate-300 italic">Tanpa catatan</span>'
            }</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-sm font-bold ${amountClass}">${sign} ${formatRupiah(tx.amount)}</p>
            ${
              isTransfer && adminFee > 0
                ? `<p class="text-[10px] text-rose-500 font-medium">Admin -${formatRupiah(adminFee)}</p>`
                : ''
            }
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
// TRANSACTION FORM & CRUD ACTIONS (TERMASUK TRANSFER ANTAR ASET)
// ============================================================================

function renderAssetFormOptions() {
  const txAssetSelect = document.getElementById('txAssetId');
  const fromSelect = document.getElementById('txFromAssetId');
  const toSelect = document.getElementById('txToAssetId');

  const currentAssetVal = txAssetSelect ? txAssetSelect.value : '';
  const currentFromVal = fromSelect ? fromSelect.value : '';
  const currentToVal = toSelect ? toSelect.value : '';

  const assetOptionsHtml = state.assets
    .map(
      (a) =>
        `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)} (${formatRupiah(a.value)})</option>`
    )
    .join('');

  if (txAssetSelect) {
    txAssetSelect.innerHTML =
      `<option value="">-- Tanpa potong/tambah saldo aset --</option>` + assetOptionsHtml;
    if (currentAssetVal && state.assets.some((a) => a.id === currentAssetVal)) {
      txAssetSelect.value = currentAssetVal;
    }
  }

  if (fromSelect && toSelect) {
    if (state.assets.length === 0) {
      const emptyOpt = `<option value="">-- Belum ada aset terdaftar --</option>`;
      fromSelect.innerHTML = emptyOpt;
      toSelect.innerHTML = emptyOpt;
    } else {
      fromSelect.innerHTML = assetOptionsHtml;
      toSelect.innerHTML = assetOptionsHtml;

      if (currentFromVal && state.assets.some((a) => a.id === currentFromVal)) {
        fromSelect.value = currentFromVal;
      } else {
        fromSelect.value = state.assets[0].id;
      }

      if (currentToVal && state.assets.some((a) => a.id === currentToVal)) {
        toSelect.value = currentToVal;
      } else if (state.assets.length > 1) {
        toSelect.value = state.assets[1].id;
      } else {
        toSelect.value = state.assets[0].id;
      }
    }
  }
}

function setTransactionTypeUI(type) {
  const hiddenInput = document.getElementById('txType');
  if (hiddenInput) hiddenInput.value = type;

  document.querySelectorAll('.tx-type-btn').forEach((btn) => {
    const btnType = btn.getAttribute('data-type');
    if (btnType === type) {
      if (type === 'Pengeluaran') {
        btn.className =
          'tx-type-btn py-2.5 px-2 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-1 bg-rose-600 text-white shadow-sm';
      } else if (type === 'Pemasukan') {
        btn.className =
          'tx-type-btn py-2.5 px-2 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-1 bg-emerald-600 text-white shadow-sm';
      } else {
        btn.className =
          'tx-type-btn py-2.5 px-2 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-1 bg-sky-600 text-white shadow-sm';
      }
    } else {
      btn.className =
        'tx-type-btn py-2.5 px-2 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-1 text-slate-600 hover:text-slate-900';
    }
  });

  const isTransfer = type === 'Transfer';
  const standardCategoryField = document.getElementById('standardCategoryField');
  const standardAssetField = document.getElementById('standardAssetField');
  const transferFieldsContainer = document.getElementById('transferFieldsContainer');
  const txAssetLabel = document.getElementById('txAssetLabel');

  if (standardCategoryField) standardCategoryField.classList.toggle('hidden', isTransfer);
  if (standardAssetField) standardAssetField.classList.toggle('hidden', isTransfer);
  if (transferFieldsContainer) transferFieldsContainer.classList.toggle('hidden', !isTransfer);

  if (txAssetLabel) {
    txAssetLabel.innerHTML =
      type === 'Pemasukan'
        ? 'Masuk ke Aset / Rekening <span class="text-slate-400 font-normal lowercase">(opsional)</span>'
        : 'Potong dari Aset / Rekening <span class="text-slate-400 font-normal lowercase">(opsional)</span>';
  }

  renderAssetFormOptions();
  if (!isTransfer) {
    renderCategoryOptions(type);
  }
}

/**
 * Menerapkan atau membatalkan (rollback) efek transaksi terhadap saldo Aset
 * @param {Object} tx - Objek transaksi
 * @param {number} direction - 1 untuk terapkan, -1 untuk batalkan (rollback)
 * @returns {Array} Daftar aset yang mengalami perubahan saldo
 */
function applyTransactionEffectOnAssets(tx, direction = 1) {
  if (!tx) return [];
  const modifiedAssets = [];
  const amt = Number(tx.amount) || 0;
  const fee = Number(tx.adminFee) || 0;

  if (tx.type === 'Transfer') {
    const fromAsset = state.assets.find((a) => a.id === tx.fromAssetId);
    const toAsset = state.assets.find((a) => a.id === tx.toAssetId);

    if (fromAsset) {
      fromAsset.value = (Number(fromAsset.value) || 0) - direction * (amt + fee);
      fromAsset.updatedAt = getTodayISO();
      modifiedAssets.push(fromAsset);
    }
    if (toAsset) {
      toAsset.value = (Number(toAsset.value) || 0) + direction * amt;
      toAsset.updatedAt = getTodayISO();
      modifiedAssets.push(toAsset);
    }
  } else if (tx.assetId) {
    const targetAsset = state.assets.find((a) => a.id === tx.assetId);
    if (targetAsset) {
      const sign = tx.type === 'Pemasukan' ? 1 : -1;
      targetAsset.value = (Number(targetAsset.value) || 0) + direction * sign * amt;
      targetAsset.updatedAt = getTodayISO();
      modifiedAssets.push(targetAsset);
    }
  }

  if (modifiedAssets.length > 0) {
    saveAssetsLocal();
  }
  return modifiedAssets;
}

function renderCategoryOptions(selectedType = null, selectedCategoryName = null) {
  const type = selectedType || document.getElementById('txType')?.value || 'Pengeluaran';
  const select = document.getElementById('txCategory');
  if (!select || type === 'Transfer') return;

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
  const assetSelect = document.getElementById('txAssetId');
  if (assetSelect) assetSelect.value = '';
  const adminFeeDisplay = document.getElementById('txAdminFeeDisplay');
  const adminFeeHidden = document.getElementById('txAdminFee');
  if (adminFeeDisplay) adminFeeDisplay.value = '';
  if (adminFeeHidden) adminFeeHidden.value = '0';

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
  const note = document.getElementById('txNote').value.trim();

  // Validasi Umum
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

  let category = '';
  let assetId = '';
  let assetName = '';
  let fromAssetId = '';
  let toAssetId = '';
  let adminFee = 0;

  if (type === 'Transfer') {
    if (state.assets.length < 2) {
      showFormError('Minimal harus ada 2 aset terdaftar untuk melakukan transfer antar aset.');
      return;
    }
    fromAssetId = document.getElementById('txFromAssetId').value;
    toAssetId = document.getElementById('txToAssetId').value;
    adminFee = Number(document.getElementById('txAdminFee').value) || 0;

    if (!fromAssetId || !toAssetId) {
      showFormError('Pilih aset asal dan aset tujuan terlebih dahulu.');
      return;
    }
    if (fromAssetId === toAssetId) {
      showFormError('Aset asal dan aset tujuan tidak boleh sama.');
      return;
    }

    const fromObj = state.assets.find((a) => a.id === fromAssetId);
    const toObj = state.assets.find((a) => a.id === toAssetId);
    category = `${fromObj ? fromObj.name : 'Aset Asal'} → ${toObj ? toObj.name : 'Aset Tujuan'}`;
  } else {
    category = document.getElementById('txCategory').value;
    if (!category) {
      showFormError('Silakan pilih kategori terlebih dahulu.');
      document.getElementById('txCategory').focus();
      return;
    }
    assetId = document.getElementById('txAssetId')?.value || '';
    if (assetId) {
      const foundAsset = state.assets.find((a) => a.id === assetId);
      assetName = foundAsset ? foundAsset.name : '';
    }
  }

  const isEdit = Boolean(id);
  const oldTx = isEdit ? state.transactions.find((t) => t.id === id) : null;

  // Jika mode edit, batalkan (rollback) efek transaksi lama terhadap saldo aset terlebih dahulu
  const affectedAssetsMap = new Map();
  if (oldTx) {
    const rolledBack = applyTransactionEffectOnAssets(oldTx, -1);
    rolledBack.forEach((a) => affectedAssetsMap.set(a.id, a));
  }

  const txRecord = {
    id: isEdit ? id : generateId('tx'),
    date,
    type,
    category,
    amount: amountRaw,
    note,
    assetId,
    assetName,
    fromAssetId,
    toAssetId,
    adminFee,
    createdAt: oldTx?.createdAt || new Date().toISOString(),
  };

  // Terapkan efek transaksi baru terhadap saldo aset
  const applied = applyTransactionEffectOnAssets(txRecord, 1);
  applied.forEach((a) => affectedAssetsMap.set(a.id, a));

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

  showToast(
    isEdit
      ? 'Transaksi & saldo aset berhasil diperbarui!'
      : type === 'Transfer'
      ? 'Perpindahan aset berhasil dicatat!'
      : 'Transaksi berhasil disimpan!'
  );

  // Sinkronkan ke Google Sheets di belakang layar jika terhubung
  await callGasBackend(isEdit ? 'updateTransaction' : 'addTransaction', txRecord);
  for (const updatedAsset of affectedAssetsMap.values()) {
    await callGasBackend('updateAsset', updatedAsset);
  }
}

function startEditTransaction(id) {
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) return;

  document.getElementById('txId').value = tx.id;
  setTransactionTypeUI(tx.type);

  const { raw, formatted } = formatDigitsOnly(tx.amount);
  document.getElementById('txAmount').value = raw;
  document.getElementById('txAmountDisplay').value = formatted;
  document.getElementById('txDate').value = tx.date;
  document.getElementById('txNote').value = tx.note || '';

  if (tx.type === 'Transfer') {
    if (tx.fromAssetId) document.getElementById('txFromAssetId').value = tx.fromAssetId;
    if (tx.toAssetId) document.getElementById('txToAssetId').value = tx.toAssetId;
    const feeObj = formatDigitsOnly(tx.adminFee || 0);
    document.getElementById('txAdminFee').value = feeObj.raw || '0';
    document.getElementById('txAdminFeeDisplay').value = feeObj.formatted || '';
  } else {
    renderCategoryOptions(tx.type, tx.category);
    const assetSelect = document.getElementById('txAssetId');
    if (assetSelect) assetSelect.value = tx.assetId || '';
  }

  document.getElementById('formTitle').textContent =
    tx.type === 'Transfer' ? 'Edit Transfer Aset' : 'Edit Transaksi';
  document.getElementById('btnSubmitText').textContent = 'Perbarui Transaksi';
  document.getElementById('btnCancelEdit').classList.remove('hidden');
  hideFormError();

  document.getElementById('transactionForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteTransaction(id) {
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) return;

  // Kembalikan (rollback) saldo aset jika transaksi ini terkait dengan aset
  const affectedAssets = applyTransactionEffectOnAssets(tx, -1);

  state.transactions = state.transactions.filter((t) => t.id !== id);
  saveTransactionsLocal();
  renderAll();
  showToast(
    affectedAssets.length > 0
      ? 'Transaksi dihapus & saldo aset telah dikembalikan'
      : 'Transaksi dihapus',
    'info'
  );

  await callGasBackend('deleteTransaction', { id });
  for (const updatedAsset of affectedAssets) {
    await callGasBackend('updateAsset', updatedAsset);
  }
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
// ASSET & NET WORTH MODULE (ALL-TIME)
// ============================================================================

function renderAssetsSection() {
  const totalValueEl = document.getElementById('assetTotalValue');
  if (!totalValueEl) return;

  // 1. Hitung Total Aset, Likuid vs Non-Likuid, dan Agregasi per Kategori Aset
  let totalAssetsValue = 0;
  let liquidValue = 0;
  let nonLiquidValue = 0;
  const byCategory = {};

  state.assets.forEach((asset) => {
    const val = Number(asset.value) || 0;
    const cat = asset.category || 'Lainnya';
    totalAssetsValue += val;
    byCategory[cat] = (byCategory[cat] || 0) + val;

    const meta = ASSET_CATEGORY_META[cat] || ASSET_CATEGORY_META['Lainnya'];
    if (meta.isLiquid) {
      liquidValue += val;
    } else {
      nonLiquidValue += val;
    }
  });

  // 2. Hitung Akumulasi Kas Transaksi Selama Ini (All-Time)
  let allTimeIncome = 0;
  let allTimeExpense = 0;
  state.transactions.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'Pemasukan') {
      allTimeIncome += amt;
    } else if (tx.type === 'Pengeluaran') {
      allTimeExpense += amt;
    } else if (tx.type === 'Transfer') {
      allTimeExpense += Number(tx.adminFee) || 0;
    }
  });
  const allTimeNet = allTimeIncome - allTimeExpense;

  // 3. Render Summary Cards Aset
  totalValueEl.textContent = formatRupiah(totalAssetsValue);
  document.getElementById('assetCountLabel').textContent = `${state.assets.length} item aset tercatat`;

  const sortedAssetCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const topCatBadge = document.getElementById('assetTopCategoryBadge');
  if (sortedAssetCats.length > 0 && totalAssetsValue > 0) {
    const [topCatName, topCatVal] = sortedAssetCats[0];
    const topPct = Math.round((topCatVal / totalAssetsValue) * 100);
    topCatBadge.textContent = `Terbesar: ${topCatName} (${topPct}%)`;
  } else {
    topCatBadge.textContent = 'Belum ada aset';
  }

  document.getElementById('assetLiquidValue').textContent = formatRupiah(liquidValue);
  document.getElementById('assetNonLiquidValue').textContent = formatRupiah(nonLiquidValue);
  const liquidPct = totalAssetsValue > 0 ? Math.round((liquidValue / totalAssetsValue) * 100) : 0;
  document.getElementById('assetLiquidRatioText').textContent =
    totalAssetsValue > 0
      ? `Komposisi: ${liquidPct}% aset likuid & ${100 - liquidPct}% investasi/fisik`
      : 'Komposisi likuiditas: 0% likuid';

  const allTimeEl = document.getElementById('allTimeNetCashflow');
  allTimeEl.textContent = formatRupiah(allTimeNet);
  allTimeEl.className = `text-xl sm:text-2xl font-extrabold tracking-tight mt-2 ${
    allTimeNet < 0 ? 'text-rose-600' : 'text-slate-900'
  }`;
  document.getElementById('allTimeCashflowSubtext').textContent = `Masuk ${formatRupiah(
    allTimeIncome
  )} • Keluar ${formatRupiah(allTimeExpense)}`;

  // 4. Render Bar Proporsi Portofolio Aset
  const allocationContainer = document.getElementById('assetAllocationContainer');
  const allocationBar = document.getElementById('assetAllocationBar');
  const allocationLegend = document.getElementById('assetAllocationLegend');

  if (totalAssetsValue <= 0 || sortedAssetCats.length === 0) {
    allocationContainer.classList.add('hidden');
  } else {
    allocationContainer.classList.remove('hidden');
    allocationBar.innerHTML = sortedAssetCats
      .map(([catName, val]) => {
        const pct = ((val / totalAssetsValue) * 100).toFixed(1);
        const color = (ASSET_CATEGORY_META[catName] || ASSET_CATEGORY_META['Lainnya']).color;
        return `<div class="h-full transition-all duration-500" style="width: ${Math.max(
          2,
          Number(pct)
        )}%; background-color: ${color}" title="${escapeHtml(catName)}: ${formatRupiah(val)} (${pct}%)"></div>`;
      })
      .join('');

    allocationLegend.innerHTML = sortedAssetCats
      .map(([catName, val]) => {
        const pct = ((val / totalAssetsValue) * 100).toFixed(1);
        const color = (ASSET_CATEGORY_META[catName] || ASSET_CATEGORY_META['Lainnya']).color;
        return `
          <div class="inline-flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${color}"></span>
            <span class="font-semibold text-slate-700">${escapeHtml(catName)}</span>
            <span class="text-slate-400">(${pct}%)</span>
          </div>
        `;
      })
      .join('');
  }

  // 5. Render Grid Daftar Aset
  const gridEl = document.getElementById('assetCardsGrid');
  const emptyEl = document.getElementById('assetEmptyState');

  const filteredAssets = state.assets
    .filter((a) => state.filterAssetCategory === 'all' || a.category === state.filterAssetCategory)
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));

  if (filteredAssets.length === 0) {
    gridEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  gridEl.innerHTML = filteredAssets
    .map((asset) => {
      const val = Number(asset.value) || 0;
      const pct = totalAssetsValue > 0 ? ((val / totalAssetsValue) * 100).toFixed(1) : '0.0';
      const meta = ASSET_CATEGORY_META[asset.category] || ASSET_CATEGORY_META['Lainnya'];

      return `
        <div class="rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 p-4 flex flex-col justify-between transition shadow-2xs">
          <div>
            <div class="flex items-start justify-between gap-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.badgeBg}">
                ${escapeHtml(asset.category)}
              </span>
              <div class="flex items-center gap-1 no-print">
                <button type="button" data-edit-asset="${escapeHtml(asset.id)}" class="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition" title="Update Nilai / Edit Aset">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button type="button" data-delete-asset="${escapeHtml(asset.id)}" class="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition" title="Hapus Aset">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <h3 class="font-bold text-slate-900 text-sm sm:text-base mt-2 truncate">${escapeHtml(asset.name)}</h3>
            <p class="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">${formatRupiah(val)}</p>
            <p class="text-xs text-slate-500 mt-1 line-clamp-1">${
              asset.note ? escapeHtml(asset.note) : '<span class="text-slate-300 italic">Tanpa keterangan</span>'
            }</p>
          </div>

          <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Diperbarui: ${formatDateID(asset.updatedAt || getTodayISO())}</span>
            <span class="font-semibold text-slate-600">${pct}% dari total aset</span>
          </div>
        </div>
      `;
    })
    .join('');
}

function openAssetModal(editAsset = null) {
  const modal = document.getElementById('assetModal');
  if (!modal) return;

  const errEl = document.getElementById('assetFormError');
  if (errEl) errEl.classList.add('hidden');

  if (editAsset) {
    document.getElementById('assetModalTitle').textContent = 'Perbarui Aset';
    document.getElementById('assetId').value = editAsset.id;
    document.getElementById('assetName').value = editAsset.name;
    document.getElementById('assetCategory').value = editAsset.category || 'Kas & Bank';
    const { raw, formatted } = formatDigitsOnly(editAsset.value);
    document.getElementById('assetValue').value = raw;
    document.getElementById('assetValueDisplay').value = formatted;
    document.getElementById('assetNote').value = editAsset.note || '';
  } else {
    document.getElementById('assetModalTitle').textContent = 'Tambah Aset Baru';
    document.getElementById('assetId').value = '';
    document.getElementById('assetName').value = '';
    document.getElementById('assetCategory').value = 'Kas & Bank';
    document.getElementById('assetValue').value = '';
    document.getElementById('assetValueDisplay').value = '';
    document.getElementById('assetNote').value = '';
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => document.getElementById('assetName')?.focus(), 50);
}

function closeAssetModal() {
  const modal = document.getElementById('assetModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function handleAssetSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('assetId').value.trim();
  const name = document.getElementById('assetName').value.trim();
  const category = document.getElementById('assetCategory').value;
  const value = Number(document.getElementById('assetValue').value);
  const note = document.getElementById('assetNote').value.trim();
  const errEl = document.getElementById('assetFormError');

  if (!name) {
    errEl.textContent = 'Nama aset wajib diisi.';
    errEl.classList.remove('hidden');
    return;
  }
  if (isNaN(value) || value <= 0) {
    errEl.textContent = 'Nilai aset wajib diisi lebih dari Rp 0.';
    errEl.classList.remove('hidden');
    return;
  }

  const isEdit = Boolean(id);
  const record = {
    id: isEdit ? id : generateId('ast'),
    name,
    category,
    value,
    note,
    updatedAt: getTodayISO(),
  };

  if (isEdit) {
    const idx = state.assets.findIndex((a) => a.id === id);
    if (idx !== -1) state.assets[idx] = record;
  } else {
    state.assets.push(record);
  }

  saveAssetsLocal();
  closeAssetModal();
  renderAll();
  showToast(isEdit ? `Aset "${name}" berhasil diperbarui!` : `Aset "${name}" berhasil ditambahkan!`);

  await callGasBackend(isEdit ? 'updateAsset' : 'addAsset', record);
}

async function deleteAsset(id) {
  const target = state.assets.find((a) => a.id === id);
  if (!target) return;

  state.assets = state.assets.filter((a) => a.id !== id);
  saveAssetsLocal();
  renderAll();
  showToast(`Aset "${target.name}" dihapus`, 'info');

  await callGasBackend('deleteAsset', { id });
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

  // Live Rupiah Formatting pada Input Biaya Admin Transfer & Quick Admin Chips
  const adminFeeDisplay = document.getElementById('txAdminFeeDisplay');
  const adminFeeHidden = document.getElementById('txAdminFee');
  if (adminFeeDisplay && adminFeeHidden) {
    adminFeeDisplay.addEventListener('input', (e) => {
      const { raw, formatted } = formatDigitsOnly(e.target.value);
      adminFeeHidden.value = raw || '0';
      adminFeeDisplay.value = formatted;
    });
  }

  document.querySelectorAll('.quick-admin-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-admin-fee');
      if (val === '0') {
        if (adminFeeHidden) adminFeeHidden.value = '0';
        if (adminFeeDisplay) adminFeeDisplay.value = '';
      } else {
        const { raw, formatted } = formatDigitsOnly(val);
        if (adminFeeHidden) adminFeeHidden.value = raw;
        if (adminFeeDisplay) adminFeeDisplay.value = formatted;
      }
    });
  });

  // Tombol Tukar Aset Asal & Tujuan pada Form Transfer
  document.getElementById('btnSwapTransferAssets')?.addEventListener('click', () => {
    const fromSelect = document.getElementById('txFromAssetId');
    const toSelect = document.getElementById('txToAssetId');
    if (fromSelect && toSelect) {
      const temp = fromSelect.value;
      fromSelect.value = toSelect.value;
      toSelect.value = temp;
    }
  });

  // Tombol Pintasan Tambah Aset & Transfer Aset
  document.getElementById('btnQuickManageAsset')?.addEventListener('click', () => openAssetModal(null));
  document.getElementById('btnQuickTransferFromAsset')?.addEventListener('click', () => {
    resetTransactionForm();
    setTransactionTypeUI('Transfer');
    document.getElementById('transactionForm')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => document.getElementById('txAmountDisplay')?.focus(), 300);
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

  // Modal & Aksi Manajemen Aset (All-Time)
  document.getElementById('btnOpenAssetModal')?.addEventListener('click', () => openAssetModal(null));
  document.getElementById('btnCloseAssetModal')?.addEventListener('click', closeAssetModal);
  document.getElementById('btnCancelAssetModal')?.addEventListener('click', closeAssetModal);
  document.getElementById('assetForm')?.addEventListener('submit', handleAssetSubmit);

  const assetValueDisplay = document.getElementById('assetValueDisplay');
  const assetValueHidden = document.getElementById('assetValue');
  if (assetValueDisplay && assetValueHidden) {
    assetValueDisplay.addEventListener('input', (e) => {
      const { raw, formatted } = formatDigitsOnly(e.target.value);
      assetValueHidden.value = raw;
      assetValueDisplay.value = formatted;
    });
  }

  document.getElementById('filterAssetCategory')?.addEventListener('change', (e) => {
    state.filterAssetCategory = e.target.value;
    renderAssetsSection();
  });

  document.getElementById('assetCardsGrid')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit-asset]');
    if (editBtn) {
      const id = editBtn.getAttribute('data-edit-asset');
      const asset = state.assets.find((a) => a.id === id);
      if (asset) openAssetModal(asset);
      return;
    }
    const delBtn = e.target.closest('[data-delete-asset]');
    if (delBtn) {
      deleteAsset(delBtn.getAttribute('data-delete-asset'));
    }
  });

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
    state.assets = [];
    saveTransactionsLocal();
    saveAssetsLocal();
    renderAll();
    closeSettings();
    showToast('Semua data transaksi & aset lokal telah dihapus', 'info');
  });
});
