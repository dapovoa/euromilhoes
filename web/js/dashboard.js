let currentData = null;

document.addEventListener('DOMContentLoaded', function() {

    initTheme();

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

    if (currentData) {
        createNumbersChart(currentData.numberFrequencies);
        createStarsChart(currentData.starFrequencies);
    }

    showToast('Tema alterado para ' + (newTheme === 'dark' ? 'escuro' : 'claro'), 'info');
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    icon.textContent = theme === 'dark' ? '☀' : '🌙';
}

async function loadDashboardData() {
    try {

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch('/api/analysis', {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        currentData = data;

        updateStats(data);
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
        updateStrategicKeys(simulatedData.strategicKeys);
        updateTopNumbers(simulatedData.topNumbers);
        updateOverdueNumbers(simulatedData.overdueNumbers);
        updateTrends(simulatedData);
        createNumbersChart(simulatedData.numberFrequencies);
        createStarsChart(simulatedData.starFrequencies);

        if (error.name === 'AbortError') {
            showToast('Timeout ao carregar dados. Usando dados simulados.', 'error');
        } else {
            showToast('Erro ao carregar dados. Usando dados simulados.', 'error');
        }
    }
}

async function refreshData() {
    const btn = document.getElementById('refresh-btn');
    btn.classList.add('loading');
    btn.disabled = true;

    const keyCards = document.querySelectorAll('.key-card');
    keyCards.forEach(card => card.classList.add('updating'));

    try {

        showToast('Atualizando dados... Pode demorar alguns minutos.', 'info');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000);

        const response = await fetch('/api/update', {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const result = await response.json();

        if (result.status === 'success') {

            await loadDashboardData();
            showToast(result.message || 'Dados atualizados com sucesso!', 'success');
        } else {
            showToast(result.message || 'Erro ao atualizar dados', 'error');
        }
    } catch (error) {
        console.error('Erro ao atualizar:', error);
        if (error.name === 'AbortError') {
            showToast('Timeout na atualizacao. Tente novamente.', 'error');
        } else {
            showToast('Erro ao atualizar dados', 'error');
        }
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;

        keyCards.forEach(card => card.classList.remove('updating'));
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

function renderNumberBalls(containerId, numbers) {
    const container = document.getElementById(containerId);
    if (!container || !numbers) return;

    container.innerHTML = '';

    numbers.forEach((num, index) => {
        const numStr = num.toString().padStart(2, '0');
        const ball = document.createElement('span');
        ball.className = 'number-ball';
        ball.textContent = numStr;
        ball.style.animationDelay = `${index * 0.1}s`;
        container.appendChild(ball);
    });
}

function renderStarBalls(containerId, stars) {
    const container = document.getElementById(containerId);
    if (!container || !stars) return;

    container.innerHTML = '<span class="plus-sign">+</span>';

    stars.forEach((star, index) => {
        const starStr = star.toString().padStart(2, '0');
        const ball = document.createElement('span');
        ball.className = 'star-ball';
        ball.textContent = starStr;
        ball.style.animationDelay = `${(index + 5) * 0.1}s`;
        container.appendChild(ball);
    });
}

function updateTopNumbers(topNumbers) {
    if (!topNumbers) return;

    const list = document.getElementById('top-numbers-list');
    if (!list) return;

    list.innerHTML = '';
    topNumbers.forEach((item, index) => {
        if (item) {
            const li = document.createElement('li');
            li.style.animationDelay = `${index * 0.05}s`;
            li.innerHTML = `<span>${item.number || 'N/A'}</span> <span class="frequency">${item.frequency || 0} vezes</span>`;
            list.appendChild(li);
        }
    });
}

function updateOverdueNumbers(overdueNumbers) {
    if (!overdueNumbers) return;

    const list = document.getElementById('overdue-numbers-list');
    if (!list) return;

    list.innerHTML = '';
    overdueNumbers.forEach((item, index) => {
        if (item) {
            const li = document.createElement('li');
            li.style.animationDelay = `${index * 0.05}s`;
            const drawsText = (item.drawsAgo === 1) ? 'sorteio' : 'sorteios';
            li.innerHTML = `<span>${item.number || 'N/A'}</span> <span class="draws-ago">${item.drawsAgo || 0} ${drawsText}</span>`;
            list.appendChild(li);
        }
    });
}

function updateTrends(data) {
    if (!data.strategicKeys) return;

    if (data.strategicKeys.secundaria && data.strategicKeys.secundaria.numbers) {
        const hotNumbers = data.strategicKeys.secundaria.numbers.map(n => n.toString().padStart(2, '0')).join(', ');
        document.getElementById('hot-trend').textContent = hotNumbers;
    }

    if (data.strategicKeys.secundaria && data.strategicKeys.secundaria.stars) {
        const hotStars = data.strategicKeys.secundaria.stars.map(s => s.toString().padStart(2, '0')).join(', ');
        document.getElementById('stars-trend').textContent = hotStars;
    }

    if (data.totalDraws) {
        const avgFreq = (data.totalDraws / 50).toFixed(1);
        document.getElementById('avg-frequency').textContent = `1 em ${Math.round(50 / avgFreq)} sorteios`;
    }
}

let numbersChartInstance = null;
let starsChartInstance = null;

function createNumbersChart(numberFrequencies) {
    if (!numberFrequencies) return;

    const ctx = document.getElementById('numbersChart');
    if (!ctx) return;

    if (numbersChartInstance) {
        numbersChartInstance.destroy();
    }

    const labels = Array.from({length: 50}, (_, i) => i + 1);

    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();

    numbersChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Frequência',
                data: numberFrequencies,
                backgroundColor: 'rgba(37, 99, 235, 0.7)',
                borderColor: 'rgba(30, 64, 175, 1)',
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
                    borderColor: 'rgba(30, 64, 175, 0.5)',
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
                        maxTicksLimit: 25,
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
}

function createStarsChart(starFrequencies) {
    if (!starFrequencies) return;

    const ctx = document.getElementById('starsChart');
    if (!ctx) return;

    if (starsChartInstance) {
        starsChartInstance.destroy();
    }

    const labels = Array.from({length: 12}, (_, i) => i + 1);

    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();

    starsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Frequência',
                data: starFrequencies,
                backgroundColor: 'rgba(217, 119, 6, 0.7)',
                borderColor: 'rgba(180, 83, 9, 1)',
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
                    borderColor: 'rgba(217, 119, 6, 0.5)',
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
        showToast('Chave copiada para a área de transferência!', 'success');
    }).catch(() => {
        showToast('Erro ao copiar chave', 'error');
    });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 3000);
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

const style = document.createElement('style');
style.textContent = `
@keyframes slideOutRight {
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(400px);
        opacity: 0;
    }
}
`;
document.head.appendChild(style);
