let currentData = null;

async function fetchWithTimeout(url, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', function() {

    initTheme();

    document.getElementById('current-year').textContent = new Date().getFullYear();

    loadDashboardData();

    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('refresh-btn').addEventListener('click', refreshData);

    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const keyType = this.getAttribute('data-key');
            copyKey(keyType);
        });
    });
});

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);

    if (currentData && numbersChartInstance && starsChartInstance) {
        updateChartColors(numbersChartInstance);
        updateChartColors(starsChartInstance);
    }
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    icon.textContent = theme === 'dark' ? '☀' : '🌙';
}

function updateChartColors(chartInstance) {
    if (!chartInstance || !chartInstance.options) return;

    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();

    if (chartInstance.options.scales && chartInstance.options.scales.y) {
        chartInstance.options.scales.y.ticks.color = textColor || '#e4e7ec';
    }

    if (chartInstance.options.scales && chartInstance.options.scales.x) {
        chartInstance.options.scales.x.ticks.color = textColor || '#e4e7ec';
    }

    chartInstance.update('none');
}

async function loadDashboardData() {
    try {
        const response = await fetchWithTimeout('/api/analysis', 10000);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        currentData = data;

        updateStats(data);
        updateLastResult(data);
        updateStrategicKeys(data.strategicKeys);
        updateTopNumbers(data.topNumbers);
        updateOverdueNumbers(data.overdueNumbers);
        updateTrends(data);
        createNumbersChart(data.numberFrequencies);
        createStarsChart(data.starFrequencies);

    } catch (error) {
        console.error('Erro ao carregar dados:', error);

        const simulatedData = getSimulatedData();
        currentData = simulatedData;

        updateStats(simulatedData);
        updateLastResult(simulatedData);
        updateStrategicKeys(simulatedData.strategicKeys);
        updateTopNumbers(simulatedData.topNumbers);
        updateOverdueNumbers(simulatedData.overdueNumbers);
        updateTrends(simulatedData);
        createNumbersChart(simulatedData.numberFrequencies);
        createStarsChart(simulatedData.starFrequencies);
    }
}

async function refreshData() {
    const btn = document.getElementById('refresh-btn');
    btn.classList.add('loading');
    btn.disabled = true;

    const keyCards = document.querySelectorAll('.key-card');
    keyCards.forEach(card => card.classList.add('updating'));

    const trendCards = document.querySelectorAll('.trend-card');
    trendCards.forEach(card => card.classList.add('updating'));

    try {
        const response = await fetchWithTimeout('/api/update', 300000);
        const result = await response.json();

        if (result.status === 'success') {
            await loadDashboardData();
        }
    } catch (error) {
        console.error('Erro ao atualizar:', error);
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;

        keyCards.forEach(card => card.classList.remove('updating'));

        const trendCards = document.querySelectorAll('.trend-card');
        trendCards.forEach(card => card.classList.remove('updating'));
    }
}

function updateStats(data) {
    document.getElementById('total-draws').textContent = data.totalDraws || '-';

    const sourceEl = document.getElementById('data-source');
    if (data.cacheInfo && data.cacheInfo.source) {
        const sourceText = data.cacheInfo.source === 'scraping' ? 'Real' : 'Simulado';
        sourceEl.textContent = sourceText;
        sourceEl.style.color = data.cacheInfo.source === 'scraping' ? 'var(--success)' : 'var(--warning)';
    } else {
        sourceEl.textContent = '-';
    }

    const scrapingEl = document.getElementById('last-scraping');
    if (data.cacheInfo && data.cacheInfo.lastScraping) {
        scrapingEl.textContent = formatDate(data.cacheInfo.lastScraping);
    } else {
        scrapingEl.textContent = 'Nunca';
        scrapingEl.style.opacity = '0.6';
    }
}

function updateLastResult(data) {
    const container = document.getElementById('last-result-balls');
    if (!container || !data.lastDrawNumbers) {
        container.innerHTML = '-';
        return;
    }

    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    data.lastDrawNumbers.forEach((num, index) => {
        const numStr = num.toString().padStart(2, '0');
        const ball = document.createElement('span');
        ball.className = 'result-ball number';
        ball.textContent = numStr;
        ball.style.animationDelay = `${index * 0.08}s`;
        fragment.appendChild(ball);
    });

    const plus = document.createElement('span');
    plus.className = 'result-plus';
    plus.textContent = '+';
    fragment.appendChild(plus);

    data.lastDrawStars.forEach((star, index) => {
        const starStr = star.toString().padStart(2, '0');
        const ball = document.createElement('span');
        ball.className = 'result-ball star';
        ball.textContent = starStr;
        ball.style.animationDelay = `${(index + 5) * 0.08}s`;
        fragment.appendChild(ball);
    });

    container.appendChild(fragment);
}

function updateStrategicKeys(keys) {
    if (!keys) return;

    if (keys.principal) {
        renderNumberBalls('critical-numbers', keys.principal.numbers);
        renderStarBalls('critical-stars', keys.principal.stars);
    }

    if (keys.secundaria) {
        renderNumberBalls('hot-numbers', keys.secundaria.numbers);
        renderStarBalls('hot-stars', keys.secundaria.stars);
    }

    if (keys.hibrida) {
        renderNumberBalls('hybrid-numbers', keys.hibrida.numbers);
        renderStarBalls('hybrid-stars', keys.hibrida.stars);
    }
}

function renderBalls(containerId, items, ballType, options = {}) {
    const container = document.getElementById(containerId);
    if (!container || !items) return;

    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    if (options.includePlus) {
        const plus = document.createElement('span');
        plus.className = 'plus-sign';
        plus.textContent = '+';
        fragment.appendChild(plus);
    }

    items.forEach((item, index) => {
        const itemStr = item.toString().padStart(2, '0');
        const ball = document.createElement('span');
        ball.className = ballType;
        ball.textContent = itemStr;
        ball.style.animationDelay = `${(index + (options.delayOffset || 0)) * 0.1}s`;
        fragment.appendChild(ball);
    });

    container.appendChild(fragment);
}

function renderNumberBalls(containerId, numbers) {
    renderBalls(containerId, numbers, 'number-ball');
}

function renderStarBalls(containerId, stars) {
    renderBalls(containerId, stars, 'star-ball', { includePlus: true, delayOffset: 5 });
}

function updateList(listId, data, formatter) {
    if (!data) return;

    const list = document.getElementById(listId);
    if (!list) return;

    list.innerHTML = '';
    const fragment = document.createDocumentFragment();

    data.forEach((item, index) => {
        if (item) {
            const li = document.createElement('li');
            li.style.animationDelay = `${index * 0.05}s`;
            li.innerHTML = formatter(item);
            fragment.appendChild(li);
        }
    });

    list.appendChild(fragment);
}

function updateTopNumbers(topNumbers) {
    updateList('top-numbers-list', topNumbers, (item) => {
        return `<span>${item.number || 'N/A'}</span> <span class="frequency">${item.frequency || 0} vezes</span>`;
    });
}

function updateOverdueNumbers(overdueNumbers) {
    updateList('overdue-numbers-list', overdueNumbers, (item) => {
        const drawsText = (item.drawsAgo === 1) ? 'sorteio' : 'sorteios';
        return `<span>${item.number || 'N/A'}</span> <span class="draws-ago">${item.drawsAgo || 0} ${drawsText}</span>`;
    });
}

function renderTrendBalls(containerId, numbers, stars, showNumbers, showStars) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < 5; i++) {
        const ball = document.createElement('span');
        ball.className = 'trend-ball number';
        if (showNumbers && i < numbers.length) {
            ball.textContent = numbers[i].toString().padStart(2, '0');
        } else {
            ball.classList.add('empty');
        }
        ball.style.animationDelay = `${i * 0.1}s`;
        fragment.appendChild(ball);
    }

    const plus = document.createElement('span');
    plus.className = 'plus-sign';
    plus.textContent = '+';
    fragment.appendChild(plus);

    for (let i = 0; i < 2; i++) {
        const ball = document.createElement('span');
        ball.className = 'trend-ball star';
        if (showStars && i < stars.length) {
            ball.textContent = stars[i].toString().padStart(2, '0');
        } else {
            ball.classList.add('empty');
        }
        ball.style.animationDelay = `${(i + 5) * 0.1}s`;
        fragment.appendChild(ball);
    }

    container.appendChild(fragment);
}

function updateTrends(data) {
    if (!data.strategicKeys) return;

    if (data.strategicKeys.secundaria) {
        const numbers = data.strategicKeys.secundaria.numbers || [];
        const stars = data.strategicKeys.secundaria.stars || [];

        renderTrendBalls('hot-trend-balls', numbers, stars, true, false);
        renderTrendBalls('stars-trend-balls', numbers, stars, false, true);
    }

    if (data.totalDraws && data.numberFrequencies) {
        const avgFrequency = data.numberFrequencies.reduce((a, b) => a + b, 0) / 50;
        const percentage = ((avgFrequency / data.totalDraws) * 100).toFixed(1);

        const freqEl = document.getElementById('avg-frequency');
        freqEl.innerHTML = `
            <div class="freq-percentage">${percentage}%</div>
            <div class="freq-subtitle">por número</div>
        `;
    }
}

let numbersChartInstance = null;
let starsChartInstance = null;

function createFrequencyChart(canvasId, frequencies, labelCount, colors, chartInstanceRef) {
    if (!frequencies) return null;

    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    if (chartInstanceRef) {
        chartInstanceRef.destroy();
    }

    const labels = Array.from({length: labelCount}, (_, i) => i + 1);
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();

    const chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Frequência',
                data: frequencies,
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderWidth: 2,
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 },
                    borderColor: colors.tooltipBorder,
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor || '#e4e7ec',
                        font: {
                            size: 11
                        }
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor || '#e4e7ec',
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: labelCount > 20 ? 25 : labelCount,
                        font: {
                            size: 10
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });

    return chartInstance;
}

function createNumbersChart(numberFrequencies) {
    numbersChartInstance = createFrequencyChart(
        'numbersChart',
        numberFrequencies,
        50,
        {
            background: 'rgba(37, 99, 235, 0.7)',
            border: 'rgba(30, 64, 175, 1)',
            tooltipBorder: 'rgba(30, 64, 175, 0.5)'
        },
        numbersChartInstance
    );
}

function createStarsChart(starFrequencies) {
    starsChartInstance = createFrequencyChart(
        'starsChart',
        starFrequencies,
        12,
        {
            background: 'rgba(217, 119, 6, 0.7)',
            border: 'rgba(180, 83, 9, 1)',
            tooltipBorder: 'rgba(217, 119, 6, 0.5)'
        },
        starsChartInstance
    );
}

function copyKey(keyType) {
    if (!currentData || !currentData.strategicKeys) return;

    let keyData = null;
    switch(keyType) {
        case 'critical':
            keyData = currentData.strategicKeys.principal;
            break;
        case 'hot':
            keyData = currentData.strategicKeys.secundaria;
            break;
        case 'hybrid':
            keyData = currentData.strategicKeys.hibrida;
            break;
    }

    if (!keyData) return;

    const numbers = keyData.numbers.map(n => n.toString().padStart(2, '0')).join(' ');
    const stars = keyData.stars.map(s => s.toString().padStart(2, '0')).join(' ');
    const text = `${numbers} + ${stars}`;

    navigator.clipboard.writeText(text).then(() => {
        console.log('Chave copiada:', text);
    }).catch(() => {
        console.error('Erro ao copiar chave');
    });
}

function formatDate(dateString) {
    if (!dateString) return '-';

    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-PT', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch {
        return dateString;
    }
}

function getSimulatedData() {
    return {
        totalDraws: 1868,
        lastDrawDate: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
        lastDrawNumbers: [6, 11, 17, 35, 44],
        lastDrawStars: [3, 7],
        strategicKeys: {
            principal: { numbers: [19, 23, 28, 34, 44], stars: [2, 11] },
            secundaria: { numbers: [1, 3, 4, 21, 42], stars: [1, 3] },
            hibrida: { numbers: [6, 8, 10, 29, 50], stars: [4, 10] }
        },
        topNumbers: [
            { number: 50, frequency: 187 },
            { number: 19, frequency: 185 },
            { number: 44, frequency: 182 },
            { number: 37, frequency: 179 },
            { number: 33, frequency: 178 }
        ],
        overdueNumbers: [
            { number: 26, drawsAgo: 50 },
            { number: 4, drawsAgo: 45 },
            { number: 18, drawsAgo: 42 },
            { number: 29, drawsAgo: 38 },
            { number: 12, drawsAgo: 35 }
        ],
        numberFrequencies: Array.from({length: 50}, (_, i) => Math.floor(Math.random() * 100) + 100),
        starFrequencies: Array.from({length: 12}, (_, i) => Math.floor(Math.random() * 50) + 50)
    };
}

