// ─── 상태 ───────────────────────────────────────────────────────────────────
let chart = null;
let currentMode = 'trend'; // 'trend' | 'shopping'

// ─── 쇼핑인사이트 카테고리 코드 (네이버 공식) ────────────────────────────────
// /shopping/categories 또는 /shopping/category/keywords 에 쓰이는 param 값
const SHOPPING_CATEGORIES = [
  { label: '패션의류',     code: '50000000' },
  { label: '패션잡화',     code: '50000001' },
  { label: '화장품/미용',  code: '50000002' },
  { label: '디지털/가전',  code: '50000003' },
  { label: '가구/인테리어',code: '50000004' },
  { label: '출산/육아',    code: '50000005' },
  { label: '식품',         code: '50000006' },
  { label: '스포츠/레저',  code: '50000007' },
  { label: '생활/건강',    code: '50000008' },
  { label: '여행/문화',    code: '50000009' },
  { label: '면세점',       code: '50000010' },
  { label: '자동차/공구',  code: '50000011' },
  { label: '도서',         code: '50000012' },
  { label: '완구/취미',    code: '50000013' },
  { label: '반려동물',     code: '50000014' },
];

// ─── 날짜 기본값 (최근 12개월) ───────────────────────────────────────────────
function getDefaultDates() {
  const end = new Date();
  // 일별 기본: 최근 90일 (네이버 데이터 지연 감안)
  const start = new Date();
  start.setDate(start.getDate() - 90);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

// ─── 초기화 ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const { start, end } = getDefaultDates();
  document.getElementById('startDate').value = start;
  document.getElementById('endDate').value = end;
  adjustEndDate('date'); // 초기값: 일별 기준으로 endDate 자동 조정

  // 카테고리 셀렉트 옵션 생성
  const sel = document.getElementById('categorySelect');
  SHOPPING_CATEGORIES.forEach(({ label, code }) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = label;
    sel.appendChild(opt);
  });

  // 탭 전환
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      updateUI();
      clearResults();
    });
  });

  // 검색 실행
  document.getElementById('searchBtn').addEventListener('click', runSearch);
  document.getElementById('keywordInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch();
  });

  // 키워드 추가 버튼
  document.getElementById('addKeywordBtn').addEventListener('click', addKeywordRow);

  // timeUnit 토글
  document.querySelectorAll('.unit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.unit-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      updateLagNote(btn.dataset.unit);
    });
  });

  updateUI();
});

function getTimeUnit() {
  const active = document.querySelector('.unit-btn.active');
  return active ? active.dataset.unit : 'date';
}

function updateLagNote(unit) {
  const note = document.getElementById('lagNote');
  const msgs = {
    date:  '💡 일별: 약 2~3일 전 데이터까지 제공됩니다',
    week:  '💡 주별: 완료된 주 기준, 최근 1~2주 지연될 수 있습니다',
    month: '💡 월별: 완료된 달 기준, 이번 달 데이터는 다음 달에 제공됩니다',
  };
  note.textContent = msgs[unit] || '';
  // endDate를 단위에 맞게 자동 조정
  adjustEndDate(unit);
}

// 네이버 DataLab 데이터 지연을 감안해 endDate 자동 조정
function adjustEndDate(unit) {
  const fmt = (d) => d.toISOString().slice(0, 10);
  const d = new Date();
  if (unit === 'date') {
    d.setDate(d.getDate() - 3);      // 일별: 3일 전까지
  } else if (unit === 'week') {
    // 지난 월요일 (완료된 주)
    const day = d.getDay(); // 0=일, 1=월 ...
    d.setDate(d.getDate() - day - 6);
  } else {
    // 월별: 지난 달 말일
    d.setDate(1);
    d.setDate(d.getDate() - 1);
  }
  document.getElementById('endDate').value = fmt(d);
}

function updateUI() {
  const trendArea  = document.getElementById('trendArea');
  const shoppingArea = document.getElementById('shoppingArea');
  const addBtn     = document.getElementById('addKeywordBtn');
  const extraWrap  = document.getElementById('extraKeywords');
  const keywordInput = document.getElementById('keywordInput');

  if (currentMode === 'trend') {
    trendArea.style.display    = 'block';
    shoppingArea.style.display = 'none';
    addBtn.style.display       = 'inline-flex';
    extraWrap.style.display    = 'flex';
    keywordInput.placeholder   = '키워드 입력 (예: 맥캘란)';
  } else {
    trendArea.style.display    = 'none';
    shoppingArea.style.display = 'block';
    addBtn.style.display       = 'inline-flex';
    extraWrap.style.display    = 'flex';
    extraWrap.innerHTML        = '';
    keywordInput.placeholder   = '비교할 키워드 (예: 맥캘란)';
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
  const keyword  = document.getElementById('keywordInput').value.trim();
  const startDate = document.getElementById('startDate').value;
  const endDate   = document.getElementById('endDate').value;

  if (!keyword) { showError('키워드를 입력해주세요.'); return; }
  if (!startDate || !endDate) { showError('날짜를 선택해주세요.'); return; }

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
  extraInputs.forEach((inp) => { if (inp.value.trim()) allKeywords.push(inp.value.trim()); });

  const body = {
    startDate,
    endDate,
    timeUnit: getTimeUnit(),
    keywordGroups: allKeywords.map((kw) => ({ groupName: kw, keywords: [kw] })),
  };

  const res = await fetch('/api/trend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.errorMessage || data.error || 'API 오류');

  renderChart(data, allKeywords, '검색량 지수 (최고점=100)');
  renderTable(data, allKeywords);
}

// ─── 쇼핑인사이트: 카테고리 내 키워드 비교 ──────────────────────────────────
// 엔드포인트: /v1/datalab/shopping/category/keywords
// 바디: startDate, endDate, timeUnit, category(코드), keyword([{name, param:[]}])
async function runShoppingSearch(mainKeyword, startDate, endDate) {
  const categoryCode = document.getElementById('categorySelect').value;
  const extraInputs  = document.querySelectorAll('.keyword-extra');
  const allKeywords  = [mainKeyword];
  extraInputs.forEach((inp) => { if (inp.value.trim()) allKeywords.push(inp.value.trim()); });

  // 쇼핑인사이트 keyword API는 한 번에 키워드 1개만 지원
  // → 여러 키워드를 병렬 호출 후 합칩니다
  const requests = allKeywords.map((kw) =>
    fetch('/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'keyword',
        body: {
          startDate,
          endDate,
          timeUnit: getTimeUnit(),
          category: categoryCode,
          keyword: [{ name: kw, param: [kw] }],
          device: '',
          gender: '',
          ages: [],
        },
      }),
    }).then((r) => r.json())
  );

  const responses = await Promise.all(requests);

  // 오류 체크
  for (let i = 0; i < responses.length; i++) {
    if (responses[i].errMsg || responses[i].error) {
      const msg = responses[i].errMsg || responses[i].error || JSON.stringify(responses[i]);
      throw new Error(`"${allKeywords[i]}" 조회 실패: ${msg}`);
    }
  }

  // results 합산: 각 응답의 results[0]을 하나로 합칩니다
  const combined = {
    results: responses.map((resp, i) => ({
      title: allKeywords[i],
      data: resp.results[0].data,
    })),
  };

  renderChart(combined, allKeywords, '쇼핑 클릭량 지수 (최고점=100)');
  renderTable(combined, allKeywords);
}

// ─── 공용 차트 렌더링 ────────────────────────────────────────────────────────
const PALETTE = ['#7C6AFA', '#FA6A7C', '#6AFAC8', '#FAC86A', '#6AB4FA'];

function renderChart(data, keywords, yLabel) {
  const ctx = document.getElementById('resultChart').getContext('2d');
  if (chart) chart.destroy();

  const labels   = data.results[0].data.map((d) => d.period.slice(0, 7));
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
    options: {
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
        x: { ticks: { color: '#9580c8', font: { size: 11 } }, grid: { color: '#2d1f4d' } },
        y: {
          title: { display: true, text: yLabel, color: '#9580c8', font: { size: 11 } },
          ticks: { color: '#9580c8', font: { size: 11 } },
          grid: { color: '#2d1f4d' },
          min: 0, max: 100,
        },
      },
    },
  });

  document.getElementById('chartWrap').style.display = 'block';
}

// ─── 공용 테이블 렌더링 ──────────────────────────────────────────────────────
function renderTable(data, keywords) {
  const wrap    = document.getElementById('tableWrap');
  const periods = data.results[0].data.map((d) => d.period.slice(0, 7));

  let html = '<table><thead><tr><th>기간</th>';
  data.results.forEach((r, i) => { html += `<th>${keywords[i] || r.title}</th>`; });
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

// ─── 유틸 ────────────────────────────────────────────────────────────────────
function setLoading(on) {
  document.getElementById('searchBtn').disabled = on;
  document.getElementById('spinner').style.display = on ? 'flex' : 'none';
}

function clearResults() {
  document.getElementById('chartWrap').style.display  = 'none';
  document.getElementById('tableWrap').style.display  = 'none';
  document.getElementById('errorMsg').style.display   = 'none';
  document.getElementById('tableWrap').innerHTML = '';
  if (chart) { chart.destroy(); chart = null; }
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.style.display = 'block';
}
