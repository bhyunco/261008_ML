/**
 * Global Top 5 Cryptocurrencies Market Analytics & Realtime Monitor
 * Client-side Controller & Chart.js Integration
 */

// Global State
let currentCoin = 'BTC';
let coinsOverview = [];
let cryptoData = null;
let mainChart = null;
let volumeChart = null;
let compareChart = null;
let forecastChart = null;
let currentRange = 'all';
let currentChartType = 'area';
let compareRange = '1y';
let autoRefreshTimer = null;

// Currency exchange rate (USD to KRW estimate)
const USD_KRW_RATE = 1350;

// Formatters
const numberFormatter = new Intl.NumberFormat('en-US');

function formatCurrency(val, decimals = 2) {
    if (val === null || val === undefined || isNaN(val)) return '--';
    return '$' + Number(val).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatCompact(val) {
    if (val === null || val === undefined || isNaN(val)) return '--';
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 1
    }).format(val);
}

// DOM Elements
const elLastUpdated = document.getElementById('lastUpdated');
const elBtnRefresh = document.getElementById('btnRefresh');
const refreshIcon = elBtnRefresh.querySelector('.refresh-icon');
const elBtnRefreshText = document.getElementById('btnRefreshText');
const elBtnCsv = document.getElementById('btnCsvDownload');
const elAutoRefresh = document.getElementById('autoRefreshSelect');
const elChartLoading = document.getElementById('chartLoading');
const elChartLoadingText = document.getElementById('chartLoadingText');
const elCoinSelectorGrid = document.getElementById('coinSelectorGrid');

// Header elements
const elHeaderCoinIcon = document.getElementById('headerCoinIcon');
const elHeaderCoinBadge = document.getElementById('headerCoinBadge');
const elHeaderLogoBox = document.getElementById('headerLogoBox');

// KPI Elements
const elKpiTitlePrice = document.getElementById('kpiTitleCurrentPrice');
const elKpiPrice = document.getElementById('kpiCurrentPrice');
const elKpiKrw = document.getElementById('kpiKrwPrice');
const elKpiChange = document.getElementById('kpiChangeBadge');
const elKpi10yHigh = document.getElementById('kpi10yHigh');
const elKpiHighDate = document.getElementById('kpiHighDate');
const elKpi10yLow = document.getElementById('kpi10yLow');
const elKpiLowDate = document.getElementById('kpiLowDate');
const elKpi10yReturn = document.getElementById('kpi10yReturn');
const elKpiStartPrice = document.getElementById('kpiStartPrice');
const elKpiVolume = document.getElementById('kpiVolume24h');
const elKpiAvgVol = document.getElementById('kpiAvgVol30d');
const elKpiRsi = document.getElementById('kpiRsi');
const elRsiBadge = document.getElementById('rsiStatusBadge');
const elRsiFill = document.getElementById('rsiMeterFill');

// Active Coin Banner Elements
const elBannerCoinName = document.getElementById('bannerCoinName');
const elBannerCoinTagline = document.getElementById('bannerCoinTagline');
const elBannerDataRange = document.getElementById('bannerDataRange');

// Controls
const chkSma50 = document.getElementById('chkSma50');
const chkSma200 = document.getElementById('chkSma200');
const chkLogScale = document.getElementById('chkLogScale');
const rangeToggleGroup = document.getElementById('rangeToggleGroup');
const chartTypeGroup = document.getElementById('chartTypeGroup');
const compareRangeToggleGroup = document.getElementById('compareRangeToggleGroup');

// AI Prediction Elements
const elBtnRunPrediction = document.getElementById('btnRunPrediction');
const elBtnRunPredictionText = document.getElementById('btnRunPredictionText');
const elForecastCoinTitle = document.getElementById('forecastCoinTitle');
const elForecastEmptyState = document.getElementById('forecastEmptyState');
const elForecastLoadingState = document.getElementById('forecastLoadingState');
const elForecastResults = document.getElementById('forecastResults');

const elForecastSpotlightDate = document.getElementById('forecastSpotlightDate');
const elForecastPriceTomorrow = document.getElementById('forecastPriceTomorrow');
const elForecastChangePill = document.getElementById('forecastChangePill');
const elForecastKrwTomorrow = document.getElementById('forecastKrwTomorrow');
const elForecastTargetStatus = document.getElementById('forecastTargetStatus');

const elMetricMape = document.getElementById('metricMape');
const elMetricMapeBadge = document.getElementById('metricMapeBadge');
const elMetricMae = document.getElementById('metricMae');
const elMetricRmse = document.getElementById('metricRmse');
const elMetricDirAcc = document.getElementById('metricDirAcc');

const elForecastImportanceList = document.getElementById('forecastImportanceList');
const elForecastModelMetaList = document.getElementById('forecastModelMetaList');

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initApp();
});

async function initApp() {
    await fetchCoinsOverview();
    await fetchCoinData(currentCoin, false);
    setupAutoRefresh();
    fetchAndRenderKosis(false);
}

// Event Listeners
function setupEventListeners() {
    // Refresh Button Click
    elBtnRefresh.addEventListener('click', () => {
        triggerRefresh();
    });

    // Auto-refresh Select
    elAutoRefresh.addEventListener('change', () => {
        setupAutoRefresh();
    });

    // Range Filter Buttons
    rangeToggleGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.toggle-btn');
        if (!btn) return;
        rangeToggleGroup.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentRange = btn.getAttribute('data-range');
        updateCharts();
    });

    // Chart Type Buttons
    chartTypeGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.toggle-btn');
        if (!btn) return;
        chartTypeGroup.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentChartType = btn.getAttribute('data-type');
        updateCharts();
    });

    // Checkbox toggles
    chkSma50.addEventListener('change', updateCharts);
    chkSma200.addEventListener('change', updateCharts);
    chkLogScale.addEventListener('change', updateCharts);

    // Comparison Timeframe Buttons
    if (compareRangeToggleGroup) {
        compareRangeToggleGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('.toggle-btn');
            if (!btn) return;
            compareRangeToggleGroup.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            compareRange = btn.getAttribute('data-range');
            fetchAndRenderComparison();
        });
    }

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.classList.add('active');

            // If switching to comparison tab for first time or refresh
            if (targetId === 'tabCompare') {
                fetchAndRenderComparison();
            }
            // If switching to KOSIS tab
            if (targetId === 'tabKosis') {
                fetchAndRenderKosis();
            }
        });
    });

    // AI Prediction Run Button Click (On-Demand Execution Only)
    if (elBtnRunPrediction) {
        elBtnRunPrediction.addEventListener('click', () => {
            runAIPrediction();
        });
    }

    // KOSIS Refresh Button Click
    const elBtnKosisRefresh = document.getElementById('btnKosisRefresh');
    if (elBtnKosisRefresh) {
        elBtnKosisRefresh.addEventListener('click', () => {
            refreshKosisData();
        });
    }

    // KOSIS Filter Group
    const kosisFilterGroup = document.getElementById('kosisFilterGroup');
    if (kosisFilterGroup) {
        kosisFilterGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('.k-filter-btn');
            if (!btn) return;
            kosisFilterGroup.querySelectorAll('.k-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const cat = btn.getAttribute('data-cat');
            renderKosisTable(cat);
        });
    }
}

// Setup Auto Refresh interval
function setupAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
    const seconds = parseInt(elAutoRefresh.value, 10);
    if (seconds > 0) {
        autoRefreshTimer = setInterval(() => {
            console.log(`[Auto-Refresh] Triggering update every ${seconds}s`);
            triggerRefresh(true);
        }, seconds * 1000);
    }
}

// Fetch Overview for all 5 coins and populate selector bar
async function fetchCoinsOverview() {
    try {
        const res = await fetch('/api/coins');
        const json = await res.json();
        if (json.success && json.coins) {
            coinsOverview = json.coins;
            renderCoinSelectorCards(coinsOverview);
        }
    } catch (err) {
        console.error('Failed to load coins overview:', err);
    }
}

// Render the 5 Coin Selector Cards in the Top Bar
function renderCoinSelectorCards(coins) {
    elCoinSelectorGrid.innerHTML = '';

    coins.forEach(coin => {
        const card = document.createElement('div');
        const isActive = coin.code === currentCoin;
        card.className = `coin-tab-card ${isActive ? 'active' : ''}`;
        card.setAttribute('data-coin', coin.code);
        card.style.setProperty('--card-coin-color', coin.color);
        card.style.setProperty('--card-coin-glow', coin.glow);

        const isUp = coin.change_24h_pct >= 0;
        const sign = isUp ? '+' : '';
        const changeClass = isUp ? 'positive' : 'negative';
        const formattedPrice = formatCurrency(coin.current_price, coin.decimals);

        card.innerHTML = `
            <div class="coin-tab-top">
                <div class="coin-icon-wrapper" style="color: ${coin.color}">
                    <i class="${coin.icon}"></i>
                </div>
                <div class="coin-names">
                    <span class="coin-ko-name">${coin.name}</span>
                    <span class="coin-code-label">${coin.code}/USD</span>
                </div>
                <div class="coin-active-indicator"></div>
            </div>
            <div class="coin-tab-bottom">
                <span class="coin-mini-price">${formattedPrice}</span>
                <span class="coin-mini-change ${changeClass}">
                    <i class="fa-solid fa-caret-${isUp ? 'up' : 'down'}"></i>
                    ${sign}${coin.change_24h_pct.toFixed(2)}%
                </span>
            </div>
        `;

        card.addEventListener('click', () => {
            if (currentCoin !== coin.code) {
                switchActiveCoin(coin.code);
            }
        });

        elCoinSelectorGrid.appendChild(card);
    });
}

// Switch Active Coin
function switchActiveCoin(coinCode) {
    currentCoin = coinCode;

    // Update active tab styles
    document.querySelectorAll('.coin-tab-card').forEach(card => {
        if (card.getAttribute('data-coin') === coinCode) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });

    // Update CSV link
    elBtnCsv.href = `/api/download/csv?coin=${coinCode}`;

    // Update AI prediction button text & coin title for the newly active coin
    if (elBtnRunPredictionText) {
        elBtnRunPredictionText.textContent = `[${coinCode}] 미래 시세 예측 실행`;
    }
    if (elForecastCoinTitle) {
        const cMeta = coinsOverview.find(c => c.code === coinCode);
        const cName = cMeta ? cMeta.name : coinCode;
        elForecastCoinTitle.textContent = `${cName}(${coinCode})`;
    }

    // Reset AI forecast panel to standby state (runs ONLY when user clicks)
    if (elForecastResults) elForecastResults.style.display = 'none';
    if (elForecastEmptyState) elForecastEmptyState.style.display = 'flex';
    if (elForecastLoadingState) elForecastLoadingState.style.display = 'none';

    // Fetch full data for the new coin
    fetchCoinData(coinCode, false);
}

// Apply dynamic theme color to the entire dashboard
function applyDynamicTheme(coinMeta) {
    if (!coinMeta) return;

    document.documentElement.style.setProperty('--theme-color', coinMeta.color);
    document.documentElement.style.setProperty('--theme-glow', coinMeta.glow);

    // Update Header visuals
    elHeaderCoinBadge.textContent = `${coinMeta.code}/USD`;
    elHeaderCoinBadge.style.borderColor = coinMeta.color;
    elHeaderCoinBadge.style.color = coinMeta.color;

    elHeaderCoinIcon.className = `${coinMeta.icon} coin-main-icon`;
    elHeaderCoinIcon.style.color = coinMeta.color;
    elHeaderLogoBox.style.borderColor = coinMeta.color;
    elHeaderLogoBox.style.boxShadow = `0 0 22px ${coinMeta.glow}`;

    // Update Ambient background glow
    const ambient1 = document.getElementById('ambientGlow1');
    if (ambient1) {
        ambient1.style.background = `radial-gradient(circle, ${coinMeta.color} 0%, transparent 70%)`;
    }

    // Update active coin banner
    elBannerCoinName.textContent = `${coinMeta.name} (${coinMeta.code})`;
    elBannerCoinName.style.color = coinMeta.color;
    elBannerCoinTagline.textContent = coinMeta.tagline || `${coinMeta.name_en} 10년 시세 분석`;
}

// Fetch 10-year Detailed Coin Data
async function fetchCoinData(coinCode, force = false) {
    elChartLoading.style.display = 'flex';
    elChartLoading.style.opacity = '1';
    elChartLoadingText.textContent = `${coinCode} 10년 데이터를 불러오는 중입니다...`;

    try {
        const res = await fetch(`/api/data?coin=${coinCode}${force ? '&refresh=true' : ''}`);
        const json = await res.json();
        if (json.success && json.data) {
            cryptoData = json.data;

            applyDynamicTheme(cryptoData.coin);
            applyDataToUI(cryptoData);
            initOrUpdateCharts();
            populateRecentTable(cryptoData.history, cryptoData.coin.decimals);
            populateInsights(cryptoData);
        } else {
            showToast('데이터 로드 실패: ' + (json.error || '알 수 없는 오류'), true);
        }
    } catch (err) {
        console.error('Coin fetch failed:', err);
        showToast('서버 통신 실패: 데이터를 불러오지 못했습니다.', true);
    } finally {
        elChartLoading.style.opacity = '0';
        setTimeout(() => {
            elChartLoading.style.display = 'none';
        }, 300);
    }
}

// Trigger Refresh (Manual button or timer)
async function triggerRefresh(isSilent = false) {
    if (refreshIcon.classList.contains('spinning')) return;
    refreshIcon.classList.add('spinning');
    elBtnRefresh.disabled = true;

    try {
        const startTime = performance.now();
        const res = await fetch(`/api/refresh?coin=${currentCoin}`, { method: 'POST' });
        const json = await res.json();
        const duration = ((performance.now() - startTime) / 1000).toFixed(1);

        if (json.success && json.data) {
            cryptoData = json.data;
            applyDataToUI(cryptoData);
            updateCharts();
            populateRecentTable(cryptoData.history, cryptoData.coin.decimals);
            populateInsights(cryptoData);

            // Silently refresh top selector overview
            fetchCoinsOverview();

            if (!isSilent) {
                showToast(`${cryptoData.coin.name}(${currentCoin}) 최신 데이터가 성공적으로 갱신되었습니다! (${duration}초 소요)`);
            }
        } else {
            showToast('데이터 갱신 중 오류: ' + (json.error || '알 수 없는 오류'), true);
        }
    } catch (err) {
        console.error('Refresh failed:', err);
        showToast('서버 통신 오류: 새로고침을 다시 시도해주세요.', true);
    } finally {
        refreshIcon.classList.remove('spinning');
        elBtnRefresh.disabled = false;
    }
}

// Apply summary metrics to KPI cards
function applyDataToUI(data) {
    const s = data.summary;
    const c = data.coin;
    if (!s || !c) return;

    const decimals = c.decimals || 2;

    elLastUpdated.textContent = s.last_updated || '알 수 없음';
    elKpiTitlePrice.textContent = `현재 가격 (${c.code}/USD)`;
    elKpiPrice.textContent = formatCurrency(s.current_price, decimals).replace('$', '$');

    // KRW Estimate
    const krwValue = Math.round(s.current_price * USD_KRW_RATE);
    elKpiKrw.textContent = `약 ${numberFormatter.format(krwValue)} 원`;

    // 24h Change Pill
    const isUp = s.change_24h >= 0;
    const sign = isUp ? '+' : '';
    elKpiChange.className = `price-change-pill ${isUp ? 'positive' : 'negative'}`;
    elKpiChange.innerHTML = `
        <i class="fa-solid fa-arrow-${isUp ? 'trend-up' : 'trend-down'}"></i>
        ${sign}${formatCurrency(s.change_24h, decimals)} (${sign}${s.change_24h_pct.toFixed(2)}%)
    `;

    // 10Y High
    elKpi10yHigh.textContent = formatCurrency(s.high_10y, decimals);
    elKpiHighDate.innerHTML = `<i class="fa-regular fa-calendar-check"></i> ${s.high_date}`;

    // 10Y Low
    elKpi10yLow.textContent = formatCurrency(s.low_10y, decimals);
    elKpiLowDate.innerHTML = `<i class="fa-regular fa-calendar-check"></i> ${s.low_date}`;

    // 10Y Return
    const returnSign = s.return_10y_pct >= 0 ? '+' : '';
    elKpi10yReturn.textContent = `${returnSign}${numberFormatter.format(s.return_10y_pct)}%`;
    elKpiStartPrice.textContent = `시작일($${numberFormatter.format(s.start_price)}, ${s.start_date}) 기준`;

    // Volume
    elKpiVolume.textContent = `$${formatCompact(s.volume_24h)}`;
    elKpiAvgVol.textContent = `30일 평균: $${formatCompact(s.avg_volume_30d)}`;

    // RSI
    elKpiRsi.textContent = s.rsi_14.toFixed(1);
    elRsiFill.style.width = `${Math.min(Math.max(s.rsi_14, 0), 100)}%`;
    if (s.rsi_14 >= 70) {
        elRsiBadge.textContent = '과매수';
        elRsiBadge.className = 'rsi-status-badge overbought';
    } else if (s.rsi_14 <= 30) {
        elRsiBadge.textContent = '과매도';
        elRsiBadge.className = 'rsi-status-badge oversold';
    } else {
        elRsiBadge.textContent = '중립';
        elRsiBadge.className = 'rsi-status-badge';
    }

    // Banner range text
    elBannerDataRange.textContent = `${s.start_date} ~ 현재 (${numberFormatter.format(s.total_days)} 거래일 수집)`;
}

// Filter dataset according to current timeframe
function getFilteredData() {
    if (!cryptoData || !cryptoData.history) return [];
    const history = cryptoData.history;
    if (currentRange === 'all') return history;

    const daysMap = {
        '1m': 30,
        '6m': 180,
        '1y': 365,
        '3y': 365 * 3,
        '5y': 365 * 5
    };

    const days = daysMap[currentRange] || 365;
    return history.slice(-days);
}

// Convert Hex Color to RGBA
function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(x => x + x).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Initialize / Update Main and Volume Charts
function initOrUpdateCharts() {
    if (!cryptoData || !cryptoData.history) return;
    const filtered = getFilteredData();
    const dates = filtered.map(d => d.date);
    const prices = filtered.map(d => d.close);
    const sma50 = filtered.map(d => d.sma50);
    const sma200 = filtered.map(d => d.sma200);
    const volumes = filtered.map(d => d.volume);

    const coinColor = (cryptoData.coin && cryptoData.coin.color) ? cryptoData.coin.color : '#f7931a';
    const decimals = (cryptoData.coin && cryptoData.coin.decimals) ? cryptoData.coin.decimals : 2;

    const ctxMain = document.getElementById('cryptoMainChart').getContext('2d');
    const ctxVol = document.getElementById('cryptoVolumeChart').getContext('2d');

    // Create gradient with active coin's theme color
    const gradient = ctxMain.createLinearGradient(0, 0, 0, 420);
    gradient.addColorStop(0, hexToRgba(coinColor, 0.45));
    gradient.addColorStop(1, hexToRgba(coinColor, 0.00));

    if (mainChart) mainChart.destroy();
    if (volumeChart) volumeChart.destroy();

    // Datasets for Main Chart
    const datasets = [];

    if (currentChartType === 'candlestick') {
        datasets.push({
            label: `${cryptoData.coin.name} 고저폭 (High/Low Range)`,
            data: filtered.map(d => [d.low, d.high]),
            backgroundColor: filtered.map(d => d.close >= d.open ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 82, 82, 0.4)'),
            borderColor: filtered.map(d => d.close >= d.open ? '#00e676' : '#ff5252'),
            borderWidth: 1.5,
            type: 'bar',
            barPercentage: 0.8,
            categoryPercentage: 0.9,
            order: 3
        });
        datasets.push({
            label: '종가 (Close Price)',
            data: prices,
            borderColor: coinColor,
            borderWidth: 2,
            type: 'line',
            pointRadius: 0,
            pointHoverRadius: 5,
            order: 2
        });
    } else {
        datasets.push({
            label: `${cryptoData.coin.name} (${cryptoData.coin.code}/USD)`,
            data: prices,
            borderColor: coinColor,
            borderWidth: 2.2,
            backgroundColor: currentChartType === 'area' ? gradient : 'transparent',
            fill: currentChartType === 'area',
            tension: 0.25,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: coinColor,
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2,
            order: 2
        });
    }

    // SMA 50
    if (chkSma50.checked) {
        datasets.push({
            label: '50일 이동평균 (SMA 50)',
            data: sma50,
            borderColor: '#f59e0b',
            borderWidth: 1.5,
            borderDash: [4, 4],
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 4,
            order: 1
        });
    }

    // SMA 200
    if (chkSma200.checked) {
        datasets.push({
            label: '200일 이동평균 (SMA 200)',
            data: sma200,
            borderColor: '#38bdf8',
            borderWidth: 1.8,
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 4,
            order: 1
        });
    }

    // Main Chart
    mainChart = new Chart(ctxMain, {
        type: 'line',
        data: {
            labels: dates,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400 },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Outfit', size: 12 },
                        boxWidth: 12,
                        boxHeight: 12,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    borderColor: hexToRgba(coinColor, 0.4),
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 10,
                    titleFont: { family: 'Outfit', size: 13, weight: '600' },
                    bodyFont: { family: 'JetBrains Mono', size: 12 },
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (Array.isArray(context.raw)) {
                                return `${label}저가 ${formatCurrency(context.raw[0], decimals)} ~ 고가 ${formatCurrency(context.raw[1], decimals)}`;
                            }
                            if (context.parsed.y !== null) {
                                label += formatCurrency(context.parsed.y, decimals);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.04)' },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'JetBrains Mono', size: 11 },
                        maxTicksLimit: 10
                    }
                },
                y: {
                    type: chkLogScale.checked ? 'logarithmic' : 'linear',
                    position: 'right',
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'JetBrains Mono', size: 11 },
                        callback: function(value) {
                            return formatCurrency(value, decimals < 4 ? 0 : 2);
                        }
                    }
                }
            }
        }
    });

    // Sub Volume Chart
    const volColors = filtered.map(d => d.close >= d.open ? 'rgba(0, 230, 118, 0.6)' : 'rgba(255, 82, 82, 0.6)');
    const volBorders = filtered.map(d => d.close >= d.open ? '#00e676' : '#ff5252');

    volumeChart = new Chart(ctxVol, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: '일일 거래량',
                data: volumes,
                backgroundColor: volColors,
                borderColor: volBorders,
                borderWidth: 0.8,
                barPercentage: 0.85
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 8,
                    callbacks: {
                        label: function(ctx) {
                            return ' 거래대금/거래량: ' + numberFormatter.format(ctx.raw);
                        }
                    }
                }
            },
            scales: {
                x: { display: false },
                y: {
                    position: 'right',
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'JetBrains Mono', size: 10 },
                        maxTicksLimit: 3,
                        callback: function(value) {
                            return formatCompact(value);
                        }
                    }
                }
            }
        }
    });

    const latestVol = volumes[volumes.length - 1];
    const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    document.getElementById('volumeSummaryText').textContent = 
        `최근: $${formatCompact(latestVol)} | 기간 평균: $${formatCompact(avgVol)}`;
}

// Update charts on filter changes
function updateCharts() {
    initOrUpdateCharts();
}

// Populate Recent 30-day Table
function populateRecentTable(history, decimals = 2) {
    if (!history || !history.length) return;
    const recent = [...history].slice(-30).reverse();
    const tbody = document.getElementById('recentTableBody');
    tbody.innerHTML = '';

    recent.forEach((item, idx) => {
        const tr = document.createElement('tr');
        const prevItem = recent[idx + 1] || item;
        const diff = item.close - prevItem.close;
        const diffPct = (diff / prevItem.close) * 100;
        const isUp = diff >= 0;
        const diffClass = isUp ? 'text-up' : 'text-down';
        const sign = isUp ? '+' : '';

        tr.innerHTML = `
            <td><strong>${item.date}</strong></td>
            <td class="${diffClass}">${formatCurrency(item.close, decimals)}</td>
            <td class="${diffClass}">${sign}${formatCurrency(diff, decimals)} (${sign}${diffPct.toFixed(2)}%)</td>
            <td>${formatCurrency(item.open, decimals)}</td>
            <td>${formatCurrency(item.high, decimals)}</td>
            <td>${formatCurrency(item.low, decimals)}</td>
            <td>${formatCompact(item.volume)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Populate 10-year Statistical Highlights
function populateInsights(data) {
    const s = data.summary;
    const c = data.coin;
    if (!s || !c) return;

    const decimals = c.decimals || 2;

    document.getElementById('insightPeriod').textContent = `10년간 총 ${numberFormatter.format(s.total_days)} 거래일 수집 완료`;
    document.getElementById('insightDatasetDesc').textContent = `Yahoo Finance (${c.symbol}) 일봉 데이터 정합성 검증 완료`;

    if (s.low_10y > 0) {
        const mult = (s.high_10y / s.low_10y).toFixed(1);
        document.getElementById('insightMultiplier').textContent = `약 ${mult}배 (저점 대비 최대 폭등)`;
        document.getElementById('insightMultiplierDesc').textContent = 
            `10년 최저점(${formatCurrency(s.low_10y, decimals)}, ${s.low_date}) → 최고점(${formatCurrency(s.high_10y, decimals)}, ${s.high_date})`;
    }

    const history = data.history;
    if (history.length > 0) {
        const latest = history[history.length - 1];
        const elCross = document.getElementById('insightCross');
        if (latest.sma50 && latest.sma200) {
            if (latest.sma50 > latest.sma200) {
                elCross.innerHTML = `<span style="color:#00e676">골든 크로스 (Golden Cross) 유지 중</span> (50일선: ${formatCurrency(latest.sma50, decimals)} > 200일선: ${formatCurrency(latest.sma200, decimals)})`;
            } else {
                elCross.innerHTML = `<span style="color:#ff5252">데드 크로스 (Dead Cross) 국면</span> (50일선: ${formatCurrency(latest.sma50, decimals)} < 200일선: ${formatCurrency(latest.sma200, decimals)})`;
            }
        }
    }
}

// ==========================================================================
// 5-Coin Return Comparison Feature (Tab 3)
// ==========================================================================
async function fetchAndRenderComparison() {
    const elCompareLoading = document.getElementById('compareLoading');
    if (elCompareLoading) elCompareLoading.style.display = 'flex';

    try {
        const res = await fetch(`/api/compare?range=${compareRange}`);
        const json = await res.json();
        if (json.success) {
            renderComparisonLeaderboard(json.leaderboard);
            renderComparisonChart(json.labels, json.datasets);
        }
    } catch (err) {
        console.error('Failed to load comparison data:', err);
    } finally {
        if (elCompareLoading) elCompareLoading.style.display = 'none';
    }
}

function renderComparisonLeaderboard(leaderboard) {
    const elBoard = document.getElementById('compareLeaderboard');
    if (!elBoard) return;
    elBoard.innerHTML = '';

    const medals = ['🥇 1위', '🥈 2위', '🥉 3위', '4위', '5위'];

    leaderboard.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = `leaderboard-card rank-${index + 1}`;
        const isUp = item.return_pct >= 0;
        const sign = isUp ? '+' : '';
        const returnClass = isUp ? 'positive' : 'negative';

        card.innerHTML = `
            <span class="leaderboard-rank-badge">${medals[index] || (index + 1 + '위')}</span>
            <div class="leaderboard-coin-row">
                <span class="leaderboard-dot" style="background: ${item.color};"></span>
                <span class="leaderboard-coin-name">${item.name} (${item.code})</span>
            </div>
            <span class="leaderboard-return ${returnClass}">${sign}${item.return_pct.toFixed(2)}%</span>
        `;
        elBoard.appendChild(card);
    });
}

function renderComparisonChart(labels, datasets) {
    const canvas = document.getElementById('cryptoCompareChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (compareChart) compareChart.destroy();

    const chartDatasets = datasets.map(d => ({
        label: d.label,
        data: d.data,
        borderColor: d.borderColor,
        backgroundColor: 'transparent',
        borderWidth: d.code === currentCoin ? 3 : 1.8,
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 5
    }));

    compareChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: chartDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Outfit', size: 12 },
                        usePointStyle: true,
                        boxWidth: 10
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(ctx) {
                            const val = ctx.parsed.y;
                            const sign = val >= 0 ? '+' : '';
                            return ` ${ctx.dataset.label}: ${sign}${val.toFixed(2)}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.04)' },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'JetBrains Mono', size: 11 },
                        maxTicksLimit: 8
                    }
                },
                y: {
                    position: 'right',
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'JetBrains Mono', size: 11 },
                        callback: function(v) {
                            return (v >= 0 ? '+' : '') + v + '%';
                        }
                    }
                }
            }
        }
    });
}

// ==========================================================================
// Tab 4: AI Future Price Prediction Feature (DecisionTreeRegressor)
// ==========================================================================
async function runAIPrediction() {
    if (!elBtnRunPrediction) return;
    elBtnRunPrediction.disabled = true;
    if (elForecastEmptyState) elForecastEmptyState.style.display = 'none';
    if (elForecastResults) elForecastResults.style.display = 'none';
    if (elForecastLoadingState) elForecastLoadingState.style.display = 'flex';

    try {
        const startTime = performance.now();
        const res = await fetch(`/api/predict?coin=${currentCoin}`);
        const json = await res.json();
        const duration = ((performance.now() - startTime) / 1000).toFixed(1);

        if (json.success) {
            renderPredictionResults(json);
            if (elForecastLoadingState) elForecastLoadingState.style.display = 'none';
            if (elForecastResults) elForecastResults.style.display = 'flex';
            showToast(`${json.coin.name}(${currentCoin}) AI 미래 시세 예측 완료! (MAPE: ${json.metrics.mape}% · ${duration}초 소요)`);
        } else {
            if (elForecastLoadingState) elForecastLoadingState.style.display = 'none';
            if (elForecastEmptyState) elForecastEmptyState.style.display = 'flex';
            showToast('예측 중 오류 발생: ' + (json.error || '알 수 없는 오류'), true);
        }
    } catch (err) {
        console.error('Prediction failed:', err);
        if (elForecastLoadingState) elForecastLoadingState.style.display = 'none';
        if (elForecastEmptyState) elForecastEmptyState.style.display = 'flex';
        showToast('서버 통신 오류: 머신러닝 예측을 수행하지 못했습니다.', true);
    } finally {
        elBtnRunPrediction.disabled = false;
    }
}

function renderPredictionResults(data) {
    const m = data.metrics;
    const f = data.forecast;
    const info = data.model_info;
    const coin = data.coin;
    const decimals = coin.decimals || 2;

    // Spotlight Tomorrow Forecast
    if (elForecastSpotlightDate) elForecastSpotlightDate.textContent = `${f.tomorrow_date} (내일 예상 시세)`;
    if (elForecastPriceTomorrow) elForecastPriceTomorrow.textContent = formatCurrency(f.tomorrow_price, decimals);
    if (elForecastKrwTomorrow) elForecastKrwTomorrow.textContent = `약 ${numberFormatter.format(f.tomorrow_krw)} 원`;

    const isUp = f.direction === 'up';
    const sign = isUp ? '+' : '';
    if (elForecastChangePill) {
        elForecastChangePill.className = `price-change-pill ${isUp ? 'positive' : 'negative'}`;
        elForecastChangePill.innerHTML = `
            <i class="fa-solid fa-arrow-${isUp ? 'trend-up' : 'trend-down'}"></i>
            ${sign}${formatCurrency(f.diff, decimals)} (${sign}${f.diff_pct.toFixed(2)}%)
        `;
    }

    if (elForecastTargetStatus) {
        const isSuccess = m.target_achieved;
        elForecastTargetStatus.innerHTML = `
            <div class="target-status-badge ${isSuccess ? 'success' : 'fail'}">
                <i class="fa-solid fa-circle-${isSuccess ? 'check' : 'xmark'}"></i>
                ${isSuccess ? 'MAPE 목표 달성 (< 5.0%)' : 'MAPE 기준치 초과'}
            </div>
            <p id="forecastSummaryDesc">
                ${isSuccess 
                    ? `검증 세트 MAPE가 ${m.mape}%로 목표치(5% 미만)를 안정적으로 충족하며, 전일 대비 ${isUp ? '상승' : '하락'}세가 예상됩니다.`
                    : `모델 검증 오차율이 ${m.mape}%로 기준치를 초과했습니다.`}
            </p>
        `;
    }

    // Metrics Cards
    if (elMetricMape) elMetricMape.textContent = `${m.mape}%`;
    if (elMetricMapeBadge) {
        elMetricMapeBadge.innerHTML = m.target_achieved 
            ? `<i class="fa-solid fa-check"></i> 목표치(5% 미만) 통과 (${m.mape}% &lt; 5.0%)`
            : `<i class="fa-solid fa-triangle-exclamation"></i> 기준치 초과 (${m.mape}%)`;
        elMetricMapeBadge.className = `f-metric-sub ${m.target_achieved ? 'text-green' : 'text-down'}`;
    }
    if (elMetricMae) elMetricMae.textContent = formatCurrency(m.mae, decimals);
    if (elMetricRmse) elMetricRmse.textContent = formatCurrency(m.rmse, decimals);
    if (elMetricDirAcc) elMetricDirAcc.textContent = `${m.dir_accuracy}%`;

    // Feature Importances
    if (elForecastImportanceList && data.feature_importances) {
        elForecastImportanceList.innerHTML = '';
        data.feature_importances.forEach(item => {
            const row = document.createElement('div');
            row.className = 'importance-item';
            row.innerHTML = `
                <span class="importance-label">${item.feature}</span>
                <div class="importance-track">
                    <div class="importance-fill" style="width: ${item.importance}%;"></div>
                </div>
                <span class="importance-pct">${item.importance}%</span>
            `;
            elForecastImportanceList.appendChild(row);
        });
    }

    // Model Metadata List
    if (elForecastModelMetaList) {
        elForecastModelMetaList.innerHTML = `
            <div class="info-row">
                <span class="info-label">알고리즘</span>
                <span class="info-value">${info.algorithm}</span>
            </div>
            <div class="info-row">
                <span class="info-label">트리 최대 깊이 / 잎 노드</span>
                <span class="info-value">${info.max_depth}단계 / ${info.n_leaves}개</span>
            </div>
            <div class="info-row">
                <span class="info-label">학습 세트 (Train)</span>
                <span class="info-value">${info.train_count}일봉 (${info.train_period})</span>
            </div>
            <div class="info-row">
                <span class="info-label">검증 세트 (Test)</span>
                <span class="info-value">${info.test_count}일봉 (${info.test_period})</span>
            </div>
            <div class="info-row">
                <span class="info-label">전처리 방식</span>
                <span class="info-value">오늘(D-1) 기준 정규화 및 5일 래그 피처</span>
            </div>
        `;
    }

    // Render Forecast Chart (Actual vs Predicted)
    renderForecastChart(data.chart, coin);
}

function renderForecastChart(chartData, coin) {
    const canvas = document.getElementById('cryptoForecastChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (forecastChart) forecastChart.destroy();

    const decimals = coin.decimals || 2;
    const dates = chartData.dates;
    const actual = chartData.actual;
    const predicted = chartData.predicted;
    const forecastIdx = chartData.forecast_index;

    // Point styling: highlight the forecast point at the end
    const pointRadii = dates.map((_, i) => i === forecastIdx ? 7 : 0);
    const pointHoverRadii = dates.map((_, i) => i === forecastIdx ? 9 : 4);
    const pointColors = dates.map((_, i) => i === forecastIdx ? '#a855f7' : coin.color);

    forecastChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: `${coin.name} 실제 가격 (Actual)`,
                    data: actual,
                    borderColor: coin.color,
                    borderWidth: 2,
                    backgroundColor: 'transparent',
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.15,
                    order: 2
                },
                {
                    label: 'DecisionTree 예측 가격 (Predicted & Forecast)',
                    data: predicted,
                    borderColor: '#a855f7',
                    borderWidth: 2,
                    borderDash: [4, 4],
                    backgroundColor: 'rgba(168, 85, 247, 0.08)',
                    fill: false,
                    pointRadius: pointRadii,
                    pointHoverRadius: pointHoverRadii,
                    pointBackgroundColor: pointColors,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    tension: 0.15,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Outfit', size: 12 },
                        usePointStyle: true,
                        boxWidth: 10
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(168, 85, 247, 0.4)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(ctx) {
                            const val = ctx.parsed.y;
                            if (val === null || val === undefined) return null;
                            return ` ${ctx.dataset.label}: ${formatCurrency(val, decimals)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.04)' },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'JetBrains Mono', size: 11 },
                        maxTicksLimit: 10
                    }
                },
                y: {
                    position: 'right',
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'JetBrains Mono', size: 11 },
                        callback: function(v) {
                            return formatCurrency(v, decimals < 4 ? 0 : 2);
                        }
                    }
                }
            }
        }
    });
}

// Toast notification helper
function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMessage');
    const toastIcon = toast.querySelector('.toast-icon');

    toastMsg.textContent = msg;
    if (isError) {
        toast.style.borderColor = 'rgba(255, 82, 82, 0.5)';
        toastIcon.className = 'fa-solid fa-circle-exclamation toast-icon';
        toastIcon.style.color = '#ff5252';
    } else {
        toast.style.borderColor = 'rgba(0, 230, 118, 0.4)';
        toastIcon.className = 'fa-solid fa-circle-check toast-icon';
        toastIcon.style.color = '#00e676';
    }

    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

// ==========================================================================
// Tab 5: KOSIS Macroeconomic Dashboard Controller
// ==========================================================================
let kosisData = null;
let kosisTrendChart = null;
let currentKosisCategory = 'all';

async function fetchAndRenderKosis(force = false) {
    try {
        const url = force ? '/api/kosis?refresh=true' : '/api/kosis';
        const res = await fetch(url);
        const json = await res.json();
        if (json.success) {
            kosisData = json;
            renderKosisDashboard(json);
        } else {
            showToast('KOSIS 데이터 로드 실패: ' + (json.error || '오류 발생'), true);
        }
    } catch (err) {
        console.error('Failed to load KOSIS data:', err);
        showToast('KOSIS 데이터를 불러오는 중 통신 오류가 발생했습니다.', true);
    }
}

async function refreshKosisData() {
    const btn = document.getElementById('btnKosisRefresh');
    const txt = document.getElementById('btnKosisRefreshText');
    if (btn) btn.disabled = true;
    if (txt) txt.textContent = '수집 중...';

    try {
        const res = await fetch('/api/kosis/refresh', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
            kosisData = json.data;
            renderKosisDashboard(json.data);
            showToast(json.message || 'KOSIS 통계 데이터가 최신으로 갱신되었습니다.');
        } else {
            showToast('갱신 실패: ' + (json.error || '오류 발생'), true);
        }
    } catch (err) {
        console.error('KOSIS refresh error:', err);
        showToast('KOSIS 데이터 갱신 중 오류가 발생했습니다.', true);
    } finally {
        if (btn) btn.disabled = false;
        if (txt) txt.textContent = 'KOSIS 데이터 갱신';
    }
}

function renderKosisDashboard(data) {
    if (!data) return;

    // Header Meta
    const elLatestMonth = document.getElementById('kosisLatestMonth');
    const elFilename = document.getElementById('kosisFilename');
    const elTotalRows = document.getElementById('kosisTotalRows');
    const elConsolePath = document.getElementById('kosisConsolePath');
    const elConsolePreview = document.getElementById('kosisConsolePreview');

    if (elLatestMonth && data.summary) elLatestMonth.textContent = data.summary.latest_period || '--';
    if (elFilename && data.file_info) elFilename.textContent = `${data.file_info.filename} (${data.file_info.size_kb} KB)`;
    if (elTotalRows) elTotalRows.textContent = `${data.total_records}건`;
    if (elConsolePath && data.file_info) elConsolePath.textContent = data.file_info.filepath;

    // 3 KPI Cards
    const s = data.summary;
    if (s) {
        // Household
        const elHousFloat = document.getElementById('kosisHousFloating');
        const elHousFixed = document.getElementById('kosisHousFixed');
        const elHousFloatBar = document.getElementById('kosisHousFloatBar');
        const elHousFixedBar = document.getElementById('kosisHousFixedBar');
        const elHousMarket = document.getElementById('kosisHousMarket');
        const elHousDeposit = document.getElementById('kosisHousDeposit');

        if (elHousFloat) elHousFloat.textContent = `${s.household.floating}%`;
        if (elHousFixed) elHousFixed.textContent = `${s.household.fixed}%`;
        if (elHousFloatBar) elHousFloatBar.style.width = `${s.household.floating}%`;
        if (elHousFixedBar) elHousFixedBar.style.width = `${s.household.fixed}%`;
        if (elHousMarket) elHousMarket.textContent = `${s.household.market}%`;
        if (elHousDeposit) elHousDeposit.textContent = `${s.household.deposit}%`;

        // Mortgage
        const elMortFloat = document.getElementById('kosisMortFloating');
        const elMortFixed = document.getElementById('kosisMortFixed');
        const elMortFloatBar = document.getElementById('kosisMortFloatBar');
        const elMortFixedBar = document.getElementById('kosisMortFixedBar');
        const elMortMarket = document.getElementById('kosisMortMarket');
        const elMortDeposit = document.getElementById('kosisMortDeposit');

        if (elMortFloat) elMortFloat.textContent = `${s.mortgage.floating}%`;
        if (elMortFixed) elMortFixed.textContent = `${s.mortgage.fixed}%`;
        if (elMortFloatBar) elMortFloatBar.style.width = `${s.mortgage.floating}%`;
        if (elMortFixedBar) elMortFixedBar.style.width = `${s.mortgage.fixed}%`;
        if (elMortMarket) elMortMarket.textContent = `${s.mortgage.market}%`;
        if (elMortDeposit) elMortDeposit.textContent = `${s.mortgage.deposit}%`;

        // Corporate
        const elCorpFloat = document.getElementById('kosisCorpFloating');
        const elCorpFixed = document.getElementById('kosisCorpFixed');
        const elCorpFloatBar = document.getElementById('kosisCorpFloatBar');
        const elCorpFixedBar = document.getElementById('kosisCorpFixedBar');
        const elCorpMarket = document.getElementById('kosisCorpMarket');
        const elCorpDeposit = document.getElementById('kosisCorpDeposit');

        if (elCorpFloat) elCorpFloat.textContent = `${s.corporate.floating}%`;
        if (elCorpFixed) elCorpFixed.textContent = `${s.corporate.fixed}%`;
        if (elCorpFloatBar) elCorpFloatBar.style.width = `${s.corporate.floating}%`;
        if (elCorpFixedBar) elCorpFixedBar.style.width = `${s.corporate.fixed}%`;
        if (elCorpMarket) elCorpMarket.textContent = `${s.corporate.market}%`;
        if (elCorpDeposit) elCorpDeposit.textContent = `${s.corporate.deposit}%`;
    }

    // Chart
    renderKosisTrendChart(data.chart_data);

    // Table
    renderKosisTable(currentKosisCategory);

    // Console Code Preview
    if (elConsolePreview && data.records && data.records.length > 0) {
        const previewRows = data.records.slice(0, 8).map((r, i) => 
            ` ${String(i).padStart(2, ' ')} | ${r.category.padEnd(6, ' ')} | ${r.item_name.padEnd(16, ' ')} | ${r.period} | ${String(r.value).padStart(5, ' ')} %`
        ).join('\n');
        elConsolePreview.textContent = 
`[DataFrame Sample Preview (Total ${data.total_records} rows)]:
 idx | Category | Item Name        | Period  | Value 
-----+----------+------------------+---------+--------
${previewRows}
 ... | ...      | ...              | ...     | ...`;
    }
}

function renderKosisTrendChart(chartData) {
    const canvas = document.getElementById('kosisTrendChart');
    if (!canvas || !chartData) return;
    const ctx = canvas.getContext('2d');

    if (kosisTrendChart) {
        kosisTrendChart.destroy();
        kosisTrendChart = null;
    }

    kosisTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.periods,
            datasets: chartData.datasets.map(ds => ({
                ...ds,
                borderWidth: 2.5,
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.2
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#cbd5e1',
                        font: { family: 'Outfit', size: 12 },
                        boxWidth: 12,
                        padding: 14
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(56, 189, 248, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(ctx) {
                            return ` ${ctx.dataset.label}: ${ctx.parsed.y}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.04)' },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'JetBrains Mono', size: 11 }
                    }
                },
                y: {
                    position: 'right',
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'JetBrains Mono', size: 11 },
                        callback: function(v) { return v + '%'; }
                    }
                }
            }
        }
    });
}

function renderKosisTable(filterCat = 'all') {
    currentKosisCategory = filterCat;
    const tbody = document.getElementById('kosisTableBody');
    if (!tbody || !kosisData || !kosisData.records) return;

    let filtered = kosisData.records;
    if (filterCat !== 'all') {
        filtered = filtered.filter(r => r.category === filterCat);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">선택한 구분의 데이터가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(r => `
        <tr>
            <td><span class="category-tag ${r.category}">${r.category}</span></td>
            <td class="font-bold">${r.item_name}</td>
            <td class="font-mono text-cyan">${r.period}</td>
            <td class="font-mono font-bold ${r.item_name.includes('변동') ? 'text-down' : 'text-green'}">${r.value !== null ? r.value.toFixed(1) : '--'}</td>
            <td>${r.unit}</td>
            <td class="text-muted text-sm">${r.item_name_eng || '--'}</td>
        </tr>
    `).join('');
}

