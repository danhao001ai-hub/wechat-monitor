const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const urlModule = require('url');
const xml2js = require('xml2js');
const { sendEmail } = require('../sender');

const PORT = 3456;
const PROJECT_ROOT = path.join(__dirname, '..');
const STATE_FILE = path.join(PROJECT_ROOT, 'state', 'monitor_state.json');
const LOG_FILE = path.join(PROJECT_ROOT, 'logs', 'monitor.log');
const RSS_URL = 'http://localhost:4000/feeds/all.atom';

// 加载配置文件
let config;
try {
  config = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'config', 'settings.json'), 'utf8'));
} catch (err) {
  console.error('❌ 无法加载配置文件，请先运行: npm run setup');
  process.exit(1);
}

// AI API 配置
const AI_API_KEY = config.ai.api_key;
const AI_API_URL = config.ai.api_url;
const AI_MODEL = config.ai.model;

// 速率限制
let lastApiCall = 0;
const API_RATE_LIMIT_MS = 1000;

// 日志
function log(msg) {
  const ts = new Date().toLocaleString('zh-CN');
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (_) {}
}

// 全局状态
let state = {
  enabled: true,
  monitoring: false,
  lastResult: null,
  rssAccounts: [],
  lastArticles: {},
};

function initState() {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(STATE_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      state = { ...state, ...saved };
    } catch (_) {}
  }
  saveState();
}

function saveState() {
  try {
    const toSave = { ...state };
    delete toSave.rssAccounts;
    fs.writeFileSync(STATE_FILE, JSON.stringify(toSave, null, 2));
  } catch (_) {}
}

function fetchUrl(targetUrl, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    function doRequest(url, redirectsLeft) {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        }
      }, (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
          if (redirectsLeft <= 0) {
            reject(new Error('Too many redirects'));
            return;
          }
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith('/')) {
            const parsed = new URL(url);
            redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
          }
          doRequest(redirectUrl, redirectsLeft - 1);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    }
    doRequest(targetUrl, maxRedirects);
  });
}

async function parseAtomFeed(xml) {
  const parser = new xml2js.Parser({ explicitArray: false });
  const result = await parser.parseStringPromise(xml);
  const feed = result.feed;
  if (!feed || !feed.entry) return [];
  const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
  return entries.map(e => {
    let url = '';
    if (e.link) {
      if (typeof e.link === 'object' && e.link.$ && e.link.$.href) url = e.link.$.href;
      else if (typeof e.link === 'string') url = e.link;
    }
    return {
      title: (e.title && e.title._) || e.title || '无标题',
      url,
      publishTime: e.updated || e.published || new Date().toISOString(),
      author: (e.author && e.author.name) || '未知',
    };
  });
}

function isWithinHours(publishTime, hours = 6) {
  const articleTime = new Date(publishTime).getTime();
  const now = Date.now();
  return articleTime >= (now - hours * 3600000);
}

async function getRSSArticlesGroupedByAccount(mode = 'recent') {
  const xml = await fetchUrl(RSS_URL);
  const allArticles = await parseAtomFeed(xml);
  const byAuthor = {};
  for (const art of allArticles) {
    const author = art.author === '-' ? '招商宏观' : art.author;
    art.author = author;
    if (!byAuthor[author]) byAuthor[author] = [];
    byAuthor[author].push(art);
  }
  const latestPerAccount = {};
  const accountList = [];
  let filteredCount = 0;
  for (const [author, articles] of Object.entries(byAuthor)) {
    articles.sort((a, b) => new Date(b.publishTime) - new Date(a.publishTime));
    const latestArticle = articles[0];
    if (mode === 'recent' && !isWithinHours(latestArticle.publishTime, 6)) {
      filteredCount++;
      continue;
    }
    latestPerAccount[author] = latestArticle;
    accountList.push({
      name: author,
      articleCount: articles.length,
      latest: {
        title: latestArticle.title,
        url: latestArticle.url,
        time: latestArticle.publishTime,
      }
    });
  }
  accountList.sort((a, b) => new Date(b.latest.time) - new Date(a.latest.time));
  return { accountList, latestPerAccount, allArticles, filteredCount };
}

async function fetchArticleContent(url) {
  try {
    const html = await fetchUrl(url);
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    const markers = ['预览时标签不可点', '轻触阅读原文', 'Scan to Follow', 'Scan with Weixin'];
    for (const marker of markers) {
      const idx = text.indexOf(marker);
      if (idx > 0) text = text.substring(0, idx).trim();
    }
    const contentStart = text.search(/[\u4e00-\u9fff]{4,}/);
    if (contentStart > 0 && contentStart < 500) text = text.substring(contentStart);
    return text.substring(0, 8000);
  } catch (err) {
    log(`抓取文章失败: ${url} - ${err.message}`);
    return null;
  }
}

async function callAIAPI(prompt) {
  const now = Date.now();
  const waitTime = Math.max(0, API_RATE_LIMIT_MS - (now - lastApiCall));
  if (waitTime > 0) await new Promise(resolve => setTimeout(resolve, waitTime));
  lastApiCall = Date.now();
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: '你是一位专业的宏观分析师和投资策略研究员。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });
    const req = https.request(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 60000
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          if (json.error) reject(new Error(json.error.message || 'API Error'));
          else if (json.choices && json.choices[0] && json.choices[0].message) resolve(json.choices[0].message.content);
          else reject(new Error('Invalid API response'));
        } catch (e) { reject(new Error('Failed to parse API response')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('API Timeout')); });
    req.write(data);
    req.end();
  });
}

async function generateSummary(title, content, author) {
  if (!content || content.length < 50) {
    return {
      summary: `📌 **核心观点**：\n文章"${title}"内容暂时无法获取，请点击原文链接阅读。`,
      tags: ['待阅读']
    };
  }
  const truncatedContent = content.substring(0, 5000);
  const prompt = `请对以下投资研究文章进行专业深度分析总结。
【文章来源】：${author}
【文章标题】：${title}
【文章内容】：
${truncatedContent}
请用中文按以下格式输出：
📌 **核心观点**：
🔍 **深度分析**：
💡 **投资启示**：
🏷️ **标签**：`;
  try {
    const aiResponse = await callAIAPI(prompt);
    let tags = [];
    const tagMatch = aiResponse.match(/🏷️\s*\*\*标签\*\*：?\s*\n?(.+)$/);
    if (tagMatch) {
      tags = tagMatch[1].replace(/[【】\[\]\(\)]/g, '').split(/[,，、]/).map(t => t.trim()).filter(t => t.length > 0);
    }
    if (tags.length === 0) tags = ['综合'];
    return { summary: aiResponse, tags: tags.slice(0, 8) };
  } catch (error) {
    log(`AI API 调用失败: ${error.message}`);
    return fallbackSummary(title, content);
  }
}

function fallbackSummary(title, content) {
  const contentPreview = content.substring(0, 3000);
  const tagKeywords = { '油价': ['油价', '原油'], '通胀': ['通胀', 'CPI'], '美联储': ['美联储', '降息'], '地缘政治': ['伊朗', '冲突'], '港股': ['恒生'], 'AI': ['AI', '人工智能'], '美股': ['美股', '纳斯达克'] };
  const detectedTags = [];
  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    if (keywords.some(kw => contentPreview.includes(kw))) detectedTags.push(tag);
  }
  if (detectedTags.length === 0) detectedTags.push('综合');
  return { summary: `📌 **核心观点**：\n本文《${title}》探讨了${detectedTags.join('、')}相关主题。由于AI服务暂时不可用，显示为基础提取内容。`, tags: detectedTags };
}

async function runMonitor(mode = 'recent') {
  if (state.monitoring) return { success: false, message: '监控已在运行中' };
  state.monitoring = true;
  state.lastResult = null;
  saveState();
  const modeText = mode === 'recent' ? '6小时内更新' : '全量更新';
  log(`========== 开始执行监控 [${modeText}] ==========`);
  try {
    log(`步骤1: 读取RSS订阅源 [${modeText}]...`);
    const { accountList, latestPerAccount, filteredCount } = await getRSSArticlesGroupedByAccount(mode);
    if (mode === 'recent' && filteredCount > 0) log(`过滤掉 ${filteredCount} 个超过6小时未更新的公众号`);
    if (accountList.length === 0) {
      state.monitoring = false;
      const message = mode === 'recent' ? '最近6小时内没有新文章' : '没有可抓取的文章';
      state.lastResult = { success: true, time: new Date().toISOString(), accountCount: 0, articleCount: 0, message };
      saveState();
      log(message);
      log('========== 监控结束 ==========');
      return state.lastResult;
    }
    log(`发现 ${accountList.length} 个公众号有待处理文章`);
    state.rssAccounts = accountList;
    state.lastArticles = {};
    const summaries = [];
    for (const [author, article] of Object.entries(latestPerAccount)) {
      log(`处理: [${author}] ${article.title}`);
      let content = null;
      if (article.url) content = await fetchArticleContent(article.url);
      const { summary, tags } = await generateSummary(article.title, content, author);
      summaries.push({ title: article.title, source: author, publish_time: article.publishTime, original_url: article.url, summary, tags });
      state.lastArticles[author] = { title: article.title, url: article.url, time: article.publishTime };
    }
    if (summaries.length > 0) {
      log(`步骤2: 发送邮件... (${summaries.length} 篇文章)`);
      const emailResult = await sendEmail(summaries);
      if (emailResult) log('邮件发送成功！');
      else log('邮件发送可能失败，请检查日志');
    }
    state.monitoring = false;
    state.lastResult = { success: true, time: new Date().toISOString(), accountCount: accountList.length, articleCount: summaries.length, mode, message: `成功处理 ${summaries.length} 篇文章 (${modeText})` };
    saveState();
    log(`监控完成！已处理 ${summaries.length} 篇文章`);
    log('========== 监控结束 ==========');
    return state.lastResult;
  } catch (err) {
    log(`监控失败: ${err.message}`);
    state.monitoring = false;
    state.lastResult = { success: false, time: new Date().toISOString(), message: `执行失败: ${err.message}` };
    saveState();
    return state.lastResult;
  }
}

async function refreshRSSAccounts() {
  try {
    const { accountList } = await getRSSArticlesGroupedByAccount('all');
    state.rssAccounts = accountList;
  } catch (_) {}
}

const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
function serveStatic(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const ct = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': ct });
    res.end(content);
  });
}
function jsonReply(res, data, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => resolve(body));
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  const parsed = urlModule.parse(req.url, true);
  const pathname = parsed.pathname;
  if (pathname === '/api/status') {
    jsonReply(res, { enabled: state.enabled, monitoring: state.monitoring, lastResult: state.lastResult, accounts: state.rssAccounts, lastArticles: state.lastArticles });
    return;
  }
  if (pathname === '/api/run') {
    if (state.monitoring) { jsonReply(res, { success: false, message: '监控正在运行中' }); return; }
    const mode = parsed.query.mode || 'recent';
    if (mode !== 'recent' && mode !== 'all') { jsonReply(res, { success: false, message: '无效模式' }); return; }
    const modeText = mode === 'recent' ? '更新检查' : '全量更新';
    jsonReply(res, { success: true, message: `${modeText}已启动...` });
    runMonitor(mode);
    return;
  }
  if (pathname === '/api/refresh-accounts') {
    try { await refreshRSSAccounts(); jsonReply(res, { success: true, count: state.rssAccounts.length }); }
    catch (err) { jsonReply(res, { success: false, error: err.message }); }
    return;
  }
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);
  serveStatic(filePath, res);
});

server.listen(PORT, async () => {
  initState();
  log('========================================');
  log(`公众号监控桌面应用已启动`);
  log(`访问地址: http://localhost:${PORT}`);
  log(`模式: 手动触发 [检查更新 / 全量更新]`);
  log('========================================');
  try { await refreshRSSAccounts(); log(`已从RSS加载 ${state.rssAccounts.length} 个公众号`); }
  catch (err) { log(`RSS加载失败: ${err.message}`); }
  setInterval(refreshRSSAccounts, 5 * 60 * 1000);
  const { exec } = require('child_process');
  exec(`open http://localhost:${PORT}`);
});

process.on('SIGINT', () => { server.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); });
