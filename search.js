// ─── 상태 ───────────────────────────────────────────────────────────────────
let chart = null;
let currentMode = 'trend'; // 'trend' | 'shopping'

// ─── 날짜 기본값 (최근 12개월) ───────────────────────────────────────────────
function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

// ─── 초기화 ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const { start, end } = getDefaultDates();
  document.getElementById('startDate').value = start;
  document.getElementById('endDate').value = end;

  // 탭 전환
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      updatePlaceholder();
      clearResults();
    });
  });

  // 검색 실행
  document.getElementById('searchBtn').addEventListener('click', runSearch);
  document.getElementById('keywordInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch();
  });

  // 키워드 추가 버튼 (트렌드 모드)
  document.getElementById('addKeywordBtn').addEventListener('click', addKeywordRow);

  updatePlaceholder();
});

function updatePlaceholder() {
  const input = document.getElementById('keywordInput');
  const addBtn = document.getElementById('addKeywordBtn');
  const extraWrap = document.getElementById('extraKeywords');

  if (currentMode === 'trend') {
    input.placeholder = '키워드 입력 (예: 맥캘란)';
    addBtn.style.display = 'inline-flex';
    extraWrap.style.display = 'flex';
  } else {
    input.placeholder = '쇼핑 카테고리 키워드 (예: 위스키)';
    addBtn.style.display = 'none';
    extraWrap.style.display = 'none';
    extraWrap.innerHTML = '';
  }
}

function addKeywordRow() {
  const wrap = document.getElementById('extraKeywords');
  if (wrap.children.length >= 4) {
    showError('키워드는 최대 5개까지 비교할 수 있어요.');
    return;
  }
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'keyword-extra';
  input.placeholder = `키워드 ${wrap.children.length + 2}`;
  wrap.appendChild(input);
  input.focus();
}

// ─── 검색 실행 ───────────────────────────────────────────────────────────────
async function runSearch() {
  const keyword = document.getElementById('keywordInput').value.trim();
  if (!keyword) {
    showError('키워드를 입력해주세요.');
    return;
  }

  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;

  if (!startDate || !endDate) {
    showError('날짜를 선택해주세요.');
    return;
  }

  setLoading(true);
  clearResults();

  try {
    if (currentMode === 'trend') {
      await runTrendSearch(keyword, startDate, endDate);
    } else {
      await runShoppingSearch(keyword, startDate, endDate);
    }
  } catch (err) {
    showError(err.message || '검색 중 오류가 발생했습니다.');
  } finally {
    setLoading(false);
  }
}

// ─── 검색어 트렌드 ───────────────────────────────────────────────────────────
async function runTrendSearch(mainKeyword, startDate, endDate) {
  const extraInputs = document.querySelectorAll('.keyword-extra');
  const allKeywords = [mainKeyword];
  extraInputs.forEach((inp) => {
    if (inp.value.trim()) allKeywords.push(inp.value.trim());
  });

  const keywordGroups = allKeywords.map((kw) => ({
    groupName: kw,
    keywords: [kw],
  }));

  const body = {
    startDate,
    endDate,
    timeUnit: 'month',
    keywordGroups,
  };

  const res = await fetch('/api/trend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.errorMessage || data.error || 'API 오류');

  renderTrendChart(data, allKeywords);
  renderTrendTable(data);
}

// ─── 쇼핑인사이트 ───────────────────────────────────────────────────────────
async function runShoppingSearch(keyword, startDate, endDate) {
  const body = {
    startDate,
    endDate,
    timeUnit: 'month',
    category: [{ name: keyword, param: [keyword] }],
    device: '',
    gender: '',
    ages: [],
  };

  const res = await fetch('/api/shopping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.errorMessage || data.error || 'API 오류');

  renderShoppingChart(data, keyword);
  renderShoppingTable(data);
}

// ─── 차트 렌더링 (트렌드) ────────────────────────────────────────────────────
const PALETTE = [
  '#7C6AFA', '#FA6A7C', '#6AFAC8', '#FAC86A', '#6AB4FA',
];

function renderTrendChart(data, keywords) {
  const ctx = document.getElementById('resultChart').getContext('2d');
  if (chart) chart.destroy();

  const labels = data.results[0].data.map((d) => d.period.slice(0, 7));
  const datasets = data.results.map((result, i) => ({
    label: keywords[i] || result.title,
    data: result.data.map((d) => d.ratio),
    borderColor: PALETTE[i % PALETTE.length],
    backgroundColor: PALETTE[i % PALETTE.length] + '22',
    borderWidth: 2.5,
    pointRadius: 4,
    tension: 0.4,
    fill: false,
  }));

  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: chartOptions('검색량 지수 (최고점=100)'),
  });

  document.getElementById('chartWrap').style.display = 'block';
}

function renderShoppingChart(data, keyword) {
  const ctx = document.getElementById('resultChart').getContext('2d');
  if (chart) chart.destroy();

  const labels = data.results[0].data.map((d) => d.period.slice(0, 7));
  const datasets = [{
    label: keyword,
    data: data.results[0].data.map((d) => d.ratio),
    borderColor: PALETTE[0],
    backgroundColor: PALETTE[0] + '22',
    borderWidth: 2.5,
    pointRadius: 4,
    tension: 0.4,
    fill: true,
  }];

  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: chartOptions('쇼핑 클릭량 지수 (최고점=100)'),
  });

  document.getElementById('chartWrap').style.display = 'block';
}

function chartOptions(yLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#e8e0ff', font: { family: "'Pretendard', sans-serif", size: 13 } },
      },
      tooltip: {
        backgroundColor: '#1a1333',
        titleColor: '#c4b5fd',
        bodyColor: '#e8e0ff',
        borderColor: '#7C6AFA44',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: '#9580c8', font: { size: 11 } },
        grid: { color: '#2d1f4d' },
      },
      y: {
        title: { display: true, text: yLabel, color: '#9580c8', font: { size: 11 } },
        ticks: { color: '#9580c8', font: { size: 11 } },
        grid: { color: '#2d1f4d' },
        min: 0,
        max: 100,
      },
    },
  };
}

// ─── 테이블 렌더링 ───────────────────────────────────────────────────────────
function renderTrendTable(data) {
  const wrap = document.getElementById('tableWrap');
  const periods = data.results[0].data.map((d) => d.period.slice(0, 7));

  let html = '<table><thead><tr><th>기간</th>';
  data.results.forEach((r) => { html += `<th>${r.title}</th>`; });
  html += '</tr></thead><tbody>';

  periods.forEach((period, i) => {
    html += `<tr><td>${period}</td>`;
    data.results.forEach((r) => {
      const val = r.data[i]?.ratio ?? '-';
      html += `<td>${typeof val === 'number' ? val.toFixed(1) : val}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;
  wrap.style.display = 'block';
}

function renderShoppingTable(data) {
  const wrap = document.getElementById('tableWrap');
  let html = '<table><thead><tr><th>기간</th><th>쇼핑 클릭 지수</th></tr></thead><tbody>';

  data.results[0].data.forEach((d) => {
    html += `<tr><td>${d.period.slice(0, 7)}</td><td>${d.ratio.toFixed(1)}</td></tr>`;
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;
  wrap.style.display = 'block';
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────
function setLoading(on) {
  const btn = document.getElementById('searchBtn');
  const spinner = document.getElementById('spinner');
  btn.disabled = on;
  spinner.style.display = on ? 'flex' : 'none';
}

function clearResults() {
  document.getElementById('chartWrap').style.display = 'none';
  document.getElementById('tableWrap').style.display = 'none';
  document.getElementById('errorMsg').style.display = 'none';
  document.getElementById('tableWrap').innerHTML = '';
  if (chart) { chart.destroy(); chart = null; }
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.style.display = 'block';
}
