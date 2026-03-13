// ============================================================
// 公众号监控中心 - 前端应用
// ============================================================

let pollTimer = null;

window.onload = () => {
  fetchStatus();
  // 每3秒轮询状态
  pollTimer = setInterval(fetchStatus, 3000);
};

window.onbeforeunload = () => {
  if (pollTimer) clearInterval(pollTimer);
};

// ---- 获取状态 ----
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    renderStatus(data);
  } catch (err) {
    document.getElementById('statusText').textContent = '连接失败';
    document.getElementById('statusDot').className = 'status-dot';
  }
}

// ---- 渲染 ----
function renderStatus(data) {
  // 状态指示器
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');

  if (data.monitoring) {
    dot.className = 'status-dot running';
    text.textContent = '正在处理...';
  } else {
    dot.className = 'status-dot idle';
    text.textContent = '就绪';
  }

  // 上次执行
  const lastRun = document.getElementById('lastRun');
  if (data.lastResult) {
    const t = new Date(data.lastResult.time).toLocaleString('zh-CN');
    const modeText = data.lastResult.mode === 'all' ? 
      '<span class="mode">[全量更新]</span>' : 
      '<span class="mode">[检查更新]</span>';
    
    if (data.lastResult.success) {
      lastRun.innerHTML = `${t} ${modeText} - <span class="success">${data.lastResult.message}</span>`;
    } else {
      lastRun.innerHTML = `${t} - <span class="fail">${data.lastResult.message}</span>`;
    }
  } else {
    lastRun.textContent = '尚未执行过';
  }

  // 按钮状态
  const recentBtn = document.getElementById('runRecentBtn');
  const allBtn = document.getElementById('runAllBtn');
  
  if (data.monitoring) {
    recentBtn.disabled = true;
    allBtn.disabled = true;
    recentBtn.innerHTML = '<span class="spinner"></span> 处理中...';
    allBtn.innerHTML = '<span class="spinner"></span> 处理中...';
  } else {
    recentBtn.disabled = false;
    allBtn.disabled = false;
    recentBtn.innerHTML = '🔄 检查更新';
    allBtn.innerHTML = '📥 全量更新';
  }

  // 公众号列表
  renderAccounts(data.accounts || [], data.lastArticles || {});
}

function renderAccounts(accounts, lastArticles) {
  const container = document.getElementById('accountList');
  const countEl = document.getElementById('accountCount');

  if (!accounts || accounts.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📭</div>
        <div>暂无订阅公众号</div>
        <div style="font-size:12px;color:#555;margin-top:8px;">请在 WeWe-RSS (localhost:4000) 中添加公众号</div>
      </div>`;
    countEl.textContent = '0 个公众号';
    return;
  }

  countEl.textContent = `${accounts.length} 个公众号`;

  const colors = [
    ['#667eea','#764ba2'], ['#f093fb','#f5576c'], ['#4facfe','#00f2fe'],
    ['#43e97b','#38f9d7'], ['#fa709a','#fee140'], ['#a18cd1','#fbc2eb'],
    ['#fccb90','#d57eeb'], ['#e0c3fc','#8ec5fc'], ['#f5576c','#ff6b6b'],
  ];

  let html = '';
  accounts.forEach((acc, i) => {
    const [c1, c2] = colors[i % colors.length];
    const initial = acc.name.charAt(0);
    const latest = acc.latest;
    const timeStr = latest ? formatTime(latest.time) : '';
    
    // 检查是否是6小时内的文章
    const isRecent = latest && isWithin6Hours(latest.time);
    const recentBadge = isRecent ? '<span class="recent-badge">6h内</span>' : '';

    html += `
      <div class="account-item">
        <div class="account-avatar" style="background:linear-gradient(135deg,${c1},${c2})">${initial}</div>
        <div class="account-info">
          <div class="account-name">${escHtml(acc.name)}${recentBadge}</div>
          <div class="account-detail">
            ${latest ? `<a href="${escHtml(latest.url)}" target="_blank" title="${escHtml(latest.title)}">${escHtml(truncate(latest.title, 40))}</a>` : '暂无文章'}
          </div>
        </div>
        <div class="account-meta">
          <div class="article-count">${acc.articleCount} 篇</div>
          ${timeStr ? `<div class="article-time">${timeStr}</div>` : ''}
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

// ---- 操作 ----
async function runRecent() {
  await runMonitor('recent', '检查更新');
}

async function runAll() {
  await runMonitor('all', '全量更新');
}

async function runMonitor(mode, modeText) {
  try {
    const res = await fetch(`/api/run?mode=${mode}`, { method: 'POST' });
    const data = await res.json();
    toast(data.message || `${modeText}已启动`, 'success');
    // 加快轮询以看到状态变化
    setTimeout(fetchStatus, 500);
  } catch (_) {
    toast('启动失败', 'error');
  }
}

async function refresh() {
  try {
    await fetch('/api/refresh-accounts');
    await fetchStatus();
    toast('公众号列表已刷新', 'info');
  } catch (_) {
    toast('刷新失败', 'error');
  }
}

// ---- 工具 ----
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove('show'), 2500);
}

function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.substring(0, n) + '...' : s;
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffH < 1) return '刚刚';
  if (diffH < 24) return `${diffH}小时前`;
  if (diffD < 7) return `${diffD}天前`;

  return `${d.getMonth()+1}/${d.getDate()}`;
}

function isWithin6Hours(iso) {
  if (!iso) return false;
  const d = new Date(iso).getTime();
  const now = new Date().getTime();
  return (now - d) < (6 * 3600000);
}
