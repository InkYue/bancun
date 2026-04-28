/* 半寸时光 · 后台控制台（角色感知） */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const TOKEN_KEY = 'bancun-staff-token';
const CATEGORIES = ['普通礼物', '冠名礼物', '特殊礼物'];

/* ---------- DOM ---------- */
const loginOverlay = $('#loginOverlay');
const loginButton = $('#loginButton');
const loginSlug = $('#loginSlug');
const loginPassword = $('#loginPassword');
const logoutButton = $('#logoutButton');
const sidebarToggle = $('#sidebarToggle');
const sidebar = $('#sidebar');
const topbarStatus = $('#topbarStatus');
const topbarRole = $('#topbarRole');
const topbarRefresh = $('#topbarRefresh');
const myUrlLink = $('#myUrlLink');
const toast = $('#toast');

const sidebarLinks = $$('.sidebar-link');
const consoleViews = $$('.console-view');

/* dashboard */
const kpiTotal = $('#kpiTotal');
const kpiCount = $('#kpiCount');
const kpiToday = $('#kpiToday');
const kpiEmployees = $('#kpiEmployees');
const kpiCustomers = $('#kpiCustomers');
const kpiLit = $('#kpiLit');
const kpiTotalTrend = $('#kpiTotalTrend');
const kpiCountTrend = $('#kpiCountTrend');
const kpiTodayTrend = $('#kpiTodayTrend');
const kpiEmployeesTrend = $('#kpiEmployeesTrend');
const kpiCustomersTrend = $('#kpiCustomersTrend');
const kpiLitTrend = $('#kpiLitTrend');
const dashboardSub = $('#dashboardSub');
const distChart = $('#distChart');
const recentList = $('#recentList');

/* customer logins */
const loginRows = $('#loginRows');
const loginEmpty = $('#loginEmpty');
const loginEmpFilter = $('#loginEmpFilter');
const loginSearch = $('#loginSearch');
const clearLoginsButton = $('#clearLoginsButton');
const loginTotalCount = $('#loginTotalCount');
const loginUniqueCount = $('#loginUniqueCount');
const loginTodayCount = $('#loginTodayCount');
const loginSmsCount = $('#loginSmsCount');
const loginTotalTrend = $('#loginTotalTrend');
const loginUniqueTrend = $('#loginUniqueTrend');
const loginTodayTrend = $('#loginTodayTrend');
const loginSmsTrend = $('#loginSmsTrend');

/* me */
const myUrlInput = $('#myUrlInput');
const myUrlCopy = $('#myUrlCopy');
const myUrlOpen = $('#myUrlOpen');
const meName = $('#meName');
const meSlug = $('#meSlug');
const meIntro = $('#meIntro');
const mePayUrl = $('#mePayUrl');
const meSaveProfile = $('#meSaveProfile');
const meAvatarPreview = $('#meAvatarPreview');
const meAvatarPlaceholder = $('#meAvatarPlaceholder');
const meAvatarInput = $('#meAvatarInput');
const meOldPwd = $('#meOldPwd');
const meNewPwd = $('#meNewPwd');
const meChangePwd = $('#meChangePwd');
const meReset = $('#meReset');

/* employees */
const empSearch = $('#empSearch');
const empRoleFilter = $('#empRoleFilter');
const empCreateButton = $('#empCreateButton');
const empList = $('#empList');

/* gifts */
const giftListEl = $('#giftList');
const giftSearchInput = $('#giftSearch');
const giftFilter = $('#giftFilter');

/* activities */
const activityRows = $('#activityRows');
const activityEmpty = $('#activityEmpty');
const activitySearchInput = $('#activitySearch');
const actEmpFilter = $('#actEmpFilter');
const clearActivitiesButton = $('#clearActivitiesButton');

/* settings */
const brandInput = $('#brandInput');
const siteUrlInput = $('#siteUrlInput');
const siteUrlPreview = $('#siteUrlPreview');
const payUrlInput = $('#payUrlInput');
const saveAdminButton = $('#saveAdminButton');
const smsStatus = $('#smsStatus');
const smsEnabled = $('#smsEnabled');
const smsSecretId = $('#smsSecretId');
const smsSecretKey = $('#smsSecretKey');
const smsSdkAppId = $('#smsSdkAppId');
const smsRegion = $('#smsRegion');
const smsSignName = $('#smsSignName');
const smsTemplateId = $('#smsTemplateId');
const smsSaveButton = $('#smsSaveButton');
const smsTestPhone = $('#smsTestPhone');
const smsTestButton = $('#smsTestButton');

/* employee modal */
const empOverlay = $('#empOverlay');
const empOverlayTitle = $('#empOverlayTitle');
const empSlugInput = $('#empSlug');
const empSlugPreview = $('#empSlugPreview');
const empSlugRegen = $('#empSlugRegen');
const empNameInput = $('#empName');
const empRoleInput = $('#empRole');
const empPasswordInput = $('#empPassword');
const empPasswordLabel = $('#empPasswordLabel');
const empEnabledInput = $('#empEnabled');
const empSaveButton = $('#empSave');

/* slug 自动清理：粘贴 /u/xxx、/a/xxx、空格、大写都自动归一化 */
function cleanSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^\/+/, '')
    .replace(/^[a-z]\//, '')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}
/* 随机 slug：避开易混淆字符 0/1/o/l/i */
function randomSlugChars(len) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function generateUniqueSlug() {
  const taken = new Set((adminState?.employees || []).map((e) => e.slug));
  for (let i = 0; i < 50; i++) {
    const s = randomSlugChars(6);
    if (!taken.has(s)) return s;
  }
  return `${randomSlugChars(4)}${Date.now().toString(36).slice(-4)}`;
}
function setSlugValue(value) {
  empSlugInput.value = value;
  empSlugPreview.textContent = value ? `/u/${value}` : '/u/...';
}
empSlugInput.addEventListener('input', () => {
  const cleaned = cleanSlug(empSlugInput.value);
  if (cleaned !== empSlugInput.value) empSlugInput.value = cleaned;
  empSlugPreview.textContent = cleaned ? `/u/${cleaned}` : '/u/...';
});
empSlugRegen.addEventListener('click', () => setSlugValue(generateUniqueSlug()));

/* ---------- 状态 ---------- */
let me = null;
let myActivities = [];
let myCatalog = [];
let adminState = null;
let allActivities = [];
let allCustomerLogins = [];
let totalUniquePhones = 0;
let editingEmpId = null;
let activityFilter = '';
let activitySearch = '';
let loginFilter = '';
let loginSearchValue = '';
let giftSearch = '';
let giftCategoryFilter = 'all';
let empSearchValue = '';
let empRoleValue = 'all';

/* ---------- token ---------- */
function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
function setToken(t) { try { localStorage.setItem(TOKEN_KEY, t); } catch {} }
function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch {} }
function authHeaders(extra = {}) { return { 'x-auth-token': getToken(), ...extra }; }

/* ---------- 公网链接构造 ---------- */
function publicBaseUrl() {
  const configured = (adminState?.siteUrl || '').replace(/\/+$/, '');
  if (configured) return configured;
  return location.origin;
}
function publicEmployeeUrl(slugStr) {
  return `${publicBaseUrl()}/u/${slugStr}`;
}

/* ---------- toast ---------- */
function showToast(msg, kind = 'info') {
  toast.textContent = msg;
  toast.dataset.kind = kind;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
}
showToast.timer = 0;

/* ---------- 视图切换 ---------- */
function switchView(view) {
  if (!view) view = 'dashboard';
  const link = sidebarLinks.find((l) => l.dataset.view === view);
  /* 角色限制：employee 不能去 admin-only */
  if (link && link.dataset.role === 'admin' && me?.role !== 'admin') view = 'dashboard';
  for (const l of sidebarLinks) l.classList.toggle('is-active', l.dataset.view === view);
  for (const sec of consoleViews) sec.hidden = sec.dataset.view !== view;
  if (window.innerWidth < 900) sidebar.classList.remove('is-open');
  if (location.hash !== `#${view}`) location.hash = view;
  /* 进入特定视图时，确保 admin 数据已加载 */
  if (me?.role === 'admin' && (view === 'activities' || view === 'employees' || view === 'gifts' || view === 'settings' || view === 'logins')) {
    if (!adminState) refreshAdmin().catch(() => {});
    if (view === 'activities' && allActivities.length === 0) refreshActivities().catch(() => {});
    if (view === 'logins') refreshLogins().then(() => renderLogins()).catch(() => {});
  }
}

document.addEventListener('click', (e) => {
  /* 只拦截声明导航的 <a> / <button>，避免误伤 section[data-view] 内的链接 */
  const link = e.target.closest('a[data-view], button[data-view]');
  if (!link) return;
  const v = link.dataset.view;
  if (!v) return;
  e.preventDefault();
  switchView(v);
});

window.addEventListener('hashchange', () => switchView(location.hash.replace('#', '') || 'dashboard'));

sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('is-open'));

/* 角色感知：隐藏 admin-only 链接 */
function applyRoleGating() {
  const role = me?.role || 'employee';
  for (const link of sidebarLinks) {
    const need = link.dataset.role;
    link.hidden = need === 'admin' && role !== 'admin';
  }
  for (const el of $$('[data-role]')) {
    if (el.classList.contains('sidebar-link')) continue; /* 已处理 */
    const need = el.dataset.role;
    el.hidden = need && need !== 'any' && need !== role;
  }
  topbarRole.textContent = role === 'admin' ? 'ADMIN' : 'EMPLOYEE';
  topbarRole.hidden = false;
}

/* ---------- 登录 / 登出 ---------- */
function showLogin() {
  loginOverlay.hidden = false;
  document.body.classList.add('is-locked');
  setTimeout(() => loginSlug.focus(), 30);
}
function hideLogin() {
  loginOverlay.hidden = true;
  document.body.classList.remove('is-locked');
}

loginButton.addEventListener('click', tryLogin);
loginSlug.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
loginPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });

async function tryLogin() {
  const slug = loginSlug.value.trim();
  const password = loginPassword.value;
  if (!slug || !password) { showToast('请输入账号和密码', 'error'); return; }
  loginButton.disabled = true;
  topbarStatus.textContent = '登录中…';
  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, password })
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || '登录失败');
    setToken(body.token);
    me = { ...body.employee, role: body.role };
    applyRoleGating();
    hideLogin();
    showToast(`欢迎回来，${me.name}`);
    await Promise.all([refreshMe(), me.role === 'admin' ? refreshAdmin() : null].filter(Boolean));
    if (me.role === 'admin') refreshActivities().catch(() => {});
    render();
  } catch (e) {
    topbarStatus.textContent = '登录失败';
    showToast(e.message, 'error');
  } finally {
    loginButton.disabled = false;
  }
}

logoutButton.addEventListener('click', () => {
  if (!confirm('确认退出登录？')) return;
  clearToken();
  me = null; adminState = null; allActivities = []; myActivities = []; myCatalog = [];
  topbarStatus.textContent = '已退出';
  topbarRole.hidden = true;
  showLogin();
});

topbarRefresh.addEventListener('click', () => {
  refreshAll().then(() => showToast('已刷新')).catch((e) => showToast(e.message || '刷新失败', 'error'));
});

/* ---------- 数据拉取 ---------- */
async function refreshMe() {
  topbarStatus.textContent = '同步中…';
  const r = await fetch('/api/me/state', { headers: authHeaders() });
  if (r.status === 401) { topbarStatus.textContent = '未授权'; throw new Error('登录已失效'); }
  if (!r.ok) throw new Error('读取自己数据失败');
  const data = await r.json();
  me = { ...data.employee, role: data.role };
  myActivities = data.activities || [];
  myCatalog = data.catalog || [];
  topbarStatus.textContent = `已连接 · ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;
}
async function refreshAdmin() {
  if (me?.role !== 'admin') return;
  const r = await fetch('/api/admin/state', { headers: authHeaders() });
  if (!r.ok) throw new Error('读取后台数据失败');
  adminState = await r.json();
}
async function refreshActivities() {
  if (me?.role !== 'admin') return;
  const url = `/api/admin/activities${activityFilter ? `?employeeId=${encodeURIComponent(activityFilter)}` : ''}`;
  const r = await fetch(url, { headers: authHeaders() });
  if (!r.ok) throw new Error('读取送礼记录失败');
  const data = await r.json();
  allActivities = data.activities || [];
}
async function refreshLogins() {
  if (me?.role !== 'admin') return;
  const url = `/api/admin/customer-logins${loginFilter ? `?employeeId=${encodeURIComponent(loginFilter)}` : ''}`;
  const r = await fetch(url, { headers: authHeaders() });
  if (!r.ok) throw new Error('读取客户登录失败');
  const data = await r.json();
  allCustomerLogins = data.logins || [];
  totalUniquePhones = data.totalUniquePhones || 0;
}
async function refreshAll() {
  if (!getToken()) { showLogin(); return; }
  await refreshMe();
  if (me?.role === 'admin') {
    await Promise.all([refreshAdmin(), refreshActivities(), refreshLogins()]);
  }
  render();
}

/* ---------- 渲染入口 ---------- */
function render() {
  if (!me) return;
  applyRoleGating();
  renderTopbar();
  renderDashboard();
  renderMe();
  if (me.role === 'admin') {
    renderEmployees();
    renderGiftCatalog();
    renderActivities();
    renderLogins();
    renderSettings();
  }
}

function renderTopbar() {
  if (!me) return;
  myUrlLink.href = publicEmployeeUrl(me.slug);
  myUrlLink.textContent = `↗ /u/${me.slug}`;
}

/* ---------- 仪表盘 ---------- */
function renderDashboard() {
  const acts = me?.role === 'admin' ? allActivities : myActivities;
  const total = acts.reduce((s, a) => s + (Number(a.price) || 0), 0);
  const count = acts.length;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayActs = acts.filter((a) => Date.parse(a.createdAt) >= todayStart.getTime());
  const todayTotal = todayActs.reduce((s, a) => s + (Number(a.price) || 0), 0);

  kpiTotal.textContent = formatCurrency(total);
  kpiCount.textContent = String(count);
  kpiToday.textContent = formatCurrency(todayTotal);
  kpiTotalTrend.textContent = count ? `平均 ¥${Math.round(total / count)} / 次` : '暂无送礼';
  kpiCountTrend.textContent = `今日 ${todayActs.length} 次`;
  const last7 = acts.filter((a) => Date.parse(a.createdAt) >= Date.now() - 7 * 86400000).length;
  kpiTodayTrend.textContent = `近 7 日 ${last7} 次`;

  if (me.role === 'admin') {
    const employees = adminState?.employees || [];
    const enabled = employees.filter((e) => e.enabled).length;
    kpiEmployees.textContent = `${enabled} / ${employees.length}`;
    kpiEmployeesTrend.textContent = `admin: ${employees.filter((e) => e.role === 'admin').length}`;
    /* 客户人数 KPI（去重） */
    kpiCustomers.textContent = String(totalUniquePhones);
    const todayLoginCount = allCustomerLogins.filter((c) => Date.parse(c.createdAt) >= todayStart.getTime()).length;
    kpiCustomersTrend.textContent = `今日 ${todayLoginCount} 次登录`;
    dashboardSub.textContent = '全站汇总数据。';
  } else {
    const lit = (me.litGiftIds || []).length;
    const totalGifts = myCatalog.filter((g) => g.enabled).length;
    kpiLit.textContent = `${lit} / ${totalGifts}`;
    kpiLitTrend.textContent = totalGifts ? `点亮率 ${Math.round((lit / totalGifts) * 100)}%` : '—';
    dashboardSub.textContent = `仅显示我（${me.name}）的数据。`;
  }

  /* 分布 */
  distChart.replaceChildren();
  const counter = new Map();
  for (const a of acts) counter.set(a.giftId, (counter.get(a.giftId) || 0) + 1);
  const giftMap = new Map((myCatalog.length ? myCatalog : adminState?.catalog || []).map((g) => [g.id, g]));
  const ranked = [...counter.entries()]
    .map(([id, n]) => ({ gift: giftMap.get(id), count: n }))
    .filter((r) => r.gift)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (!ranked.length) {
    const li = document.createElement('li'); li.className = 'dist-empty'; li.textContent = '还没有送礼数据。';
    distChart.append(li);
  } else {
    const max = ranked[0].count;
    for (const { gift, count } of ranked) {
      const li = document.createElement('li');
      li.className = 'dist-row';
      li.innerHTML = `<div class="dist-row-head"><span>${escapeHtml(gift.name)}</span><span class="dist-count">${count} 次</span></div><div class="dist-bar"><div class="dist-fill" style="width:${Math.max(6, (count / max) * 100)}%"></div></div>`;
      distChart.append(li);
    }
  }

  /* 最近 */
  recentList.replaceChildren();
  const recent = acts.slice(0, 6);
  if (!recent.length) {
    const li = document.createElement('li'); li.className = 'recent-empty'; li.textContent = '暂无最近送礼。';
    recentList.append(li);
  } else {
    for (const a of recent) {
      const li = document.createElement('li');
      li.className = 'recent-item';
      const empName = a.employeeName ? `· ${escapeHtml(a.employeeName)} ` : '';
      li.innerHTML = `<div class="recent-item-main"><strong>${escapeHtml(a.giftName || '未知')}</strong><span class="recent-item-amount">¥${a.price}</span></div><div class="recent-item-meta"><span>${empName}${escapeHtml(a.phone || '匿名')}</span><span>${formatRelative(a.createdAt)}</span></div>`;
      recentList.append(li);
    }
  }
}

/* ---------- 我的页面 ---------- */
function renderMe() {
  if (!me) return;
  const url = publicEmployeeUrl(me.slug);
  myUrlInput.value = url;
  myUrlOpen.href = url;
  meName.value = me.name || '';
  meSlug.value = me.slug || '';
  meIntro.value = me.intro || '';
  mePayUrl.value = me.wechatPayUrl || '';
  /* 头像 */
  if (me.avatarPath) {
    meAvatarPreview.src = me.avatarPath;
    meAvatarPreview.parentElement.classList.add('is-loaded');
    meAvatarPlaceholder.hidden = true;
  } else {
    meAvatarPreview.removeAttribute('src');
    meAvatarPreview.parentElement.classList.remove('is-loaded');
    meAvatarPlaceholder.hidden = false;
  }
}

myUrlCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(myUrlInput.value);
    showToast('链接已复制');
  } catch { myUrlInput.select(); document.execCommand('copy'); showToast('链接已复制'); }
});

meSaveProfile.addEventListener('click', async () => {
  try {
    const r = await fetch('/api/me/profile', {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ name: meName.value, intro: meIntro.value, wechatPayUrl: mePayUrl.value })
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '保存失败');
    const data = await r.json();
    me = { ...me, ...data.employee };
    render();
    showToast('已保存资料');
  } catch (e) { showToast(e.message, 'error'); }
});

meAvatarInput.addEventListener('change', (e) => uploadImage(e, '/api/me/avatar', '头像已更新', (data) => { me = { ...me, ...data.employee }; }));

meChangePwd.addEventListener('click', async () => {
  const oldPassword = meOldPwd.value;
  const newPassword = meNewPwd.value;
  if (!oldPassword || newPassword.length < 6) { showToast('新密码至少 6 位', 'error'); return; }
  try {
    const r = await fetch('/api/me/password', {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ oldPassword, newPassword })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || '更新失败');
    setToken(data.token);
    meOldPwd.value = ''; meNewPwd.value = '';
    showToast('密码已更新');
  } catch (e) { showToast(e.message, 'error'); }
});

meReset.addEventListener('click', async () => {
  if (!confirm(`确认把【${me.name}】的全部礼物熄灭？`)) return;
  try {
    const r = await fetch('/api/me/reset', { method: 'POST', headers: authHeaders() });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '操作失败');
    const data = await r.json();
    me = { ...me, ...data.employee };
    render();
    showToast('已全部熄灭');
  } catch (e) { showToast(e.message, 'error'); }
});

/* ---------- 员工管理 ---------- */
empSearch.addEventListener('input', () => { empSearchValue = empSearch.value.trim().toLowerCase(); renderEmployees(); });
empRoleFilter.addEventListener('change', () => { empRoleValue = empRoleFilter.value; renderEmployees(); });
empCreateButton.addEventListener('click', () => openEmpModal(null));

function renderEmployees() {
  if (!adminState) return;
  empList.replaceChildren();
  /* 同步活动筛选下拉 */
  const opts = ['<option value="">全站汇总</option>', ...adminState.employees.map((e) => `<option value="${e.id}">${escapeHtml(e.name)} · /${escapeHtml(e.slug)}</option>`)];
  actEmpFilter.innerHTML = opts.join('');
  actEmpFilter.value = activityFilter;

  const filtered = adminState.employees.filter((e) => {
    if (empRoleValue !== 'all' && e.role !== empRoleValue) return false;
    if (!empSearchValue) return true;
    return e.slug.toLowerCase().includes(empSearchValue) || e.name.toLowerCase().includes(empSearchValue);
  });

  if (!filtered.length) {
    const p = document.createElement('p'); p.className = 'empty-tip'; p.textContent = '没有匹配的员工。';
    empList.append(p);
    return;
  }

  for (const e of filtered) {
    const card = document.createElement('article');
    card.className = `emp-card-row ${e.enabled ? '' : 'is-disabled'}`;
    card.innerHTML = `
      <div class="emp-row-avatar">${e.avatarPath ? `<img src="${escapeAttr(e.avatarPath)}" alt="${escapeAttr(e.name)}">` : `<span>${escapeHtml(e.name.slice(0,1))}</span>`}</div>
      <div class="emp-row-main">
        <div class="emp-row-head">
          <strong>${escapeHtml(e.name)}</strong>
          <span class="emp-role role-${e.role}">${e.role}</span>
          ${e.enabled ? '' : '<span class="emp-disabled">已停用</span>'}
        </div>
        <div class="emp-row-meta">
          <span class="emp-slug">/u/${escapeHtml(e.slug)}</span>
          <span>· 已点亮 ${e.litCount}</span>
          <span>· 创建 ${formatDate(e.createdAt)}</span>
        </div>
      </div>
      <div class="emp-row-ops">
        <button class="ghost-button" data-act="copy" title="复制链接发给员工 / 客户">📋 复制链接</button>
        <a class="ghost-button icon-button" href="${escapeAttr(publicEmployeeUrl(e.slug))}" target="_blank" rel="noreferrer" title="新标签页预览">↗</a>
        <button class="ghost-button" data-act="qr">收款码</button>
        <button class="ghost-button" data-act="reset">熄灭</button>
        <button class="ghost-button" data-act="edit">编辑</button>
        <button class="link-danger" data-act="del">删除</button>
      </div>`;
    card.querySelector('[data-act="copy"]').addEventListener('click', () => copyEmployeeUrl(e));
    card.querySelector('[data-act="edit"]').addEventListener('click', () => openEmpModal(e));
    card.querySelector('[data-act="qr"]').addEventListener('click', () => uploadEmployeeQr(e));
    card.querySelector('[data-act="reset"]').addEventListener('click', () => resetEmployeeLit(e));
    card.querySelector('[data-act="del"]').addEventListener('click', () => deleteEmployee(e));
    empList.append(card);
  }
}

function openEmpModal(employee) {
  editingEmpId = employee?.id || null;
  empOverlayTitle.textContent = employee ? `编辑：${employee.name}` : '新增员工';
  setSlugValue(employee?.slug || generateUniqueSlug());
  empSlugInput.disabled = false;
  empNameInput.value = employee?.name || '';
  empRoleInput.value = employee?.role || 'employee';
  empPasswordInput.value = '';
  empPasswordLabel.textContent = employee ? '新密码（留空不修改）' : '登录密码';
  empEnabledInput.checked = employee ? !!employee.enabled : true;
  empOverlay.hidden = false;
  setTimeout(() => empNameInput.focus(), 30);
}
function closeEmpModal() { empOverlay.hidden = true; editingEmpId = null; }
empOverlay.addEventListener('click', (e) => { if (e.target.matches('[data-close-emp]')) closeEmpModal(); });

empSaveButton.addEventListener('click', async () => {
  const slug = empSlugInput.value.trim().toLowerCase();
  const name = empNameInput.value.trim();
  const role = empRoleInput.value;
  const password = empPasswordInput.value;
  const enabled = empEnabledInput.checked;
  if (!slug || !name) { showToast('slug 和名称必填', 'error'); return; }
  if (!editingEmpId && password.length < 6) { showToast('密码至少 6 位', 'error'); return; }
  try {
    const url = editingEmpId ? `/api/admin/employees/${editingEmpId}` : '/api/admin/employees';
    const body = { slug, name, role, enabled };
    if (password) body.password = password;
    const r = await fetch(url, {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '保存失败');
    closeEmpModal();
    await refreshAdmin();
    render();
    showToast(editingEmpId ? '员工已更新' : '员工已创建');
  } catch (e) { showToast(e.message, 'error'); }
});

async function deleteEmployee(e) {
  if (!confirm(`删除员工【${e.name}】？\n该员工的灯牌、送礼记录、头像/收款码会一并清除。`)) return;
  try {
    const r = await fetch(`/api/admin/employees/${e.id}`, { method: 'DELETE', headers: authHeaders() });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '删除失败');
    await refreshAll();
    showToast('员工已删除');
  } catch (err) { showToast(err.message, 'error'); }
}

async function resetEmployeeLit(e) {
  if (!confirm(`确认把【${e.name}】的全部礼物熄灭？`)) return;
  try {
    const r = await fetch(`/api/admin/employees/${e.id}/reset`, { method: 'POST', headers: authHeaders() });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '操作失败');
    await refreshAdmin();
    render();
    showToast('已熄灭');
  } catch (err) { showToast(err.message, 'error'); }
}

async function copyEmployeeUrl(e) {
  const url = publicEmployeeUrl(e.slug);
  try {
    await navigator.clipboard.writeText(url);
    showToast(`已复制：${url}`);
  } catch {
    /* 降级：临时 textarea + execCommand */
    const ta = document.createElement('textarea');
    ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.append(ta); ta.select();
    try { document.execCommand('copy'); showToast(`已复制：${url}`); }
    catch { showToast('复制失败，请手动复制：' + url, 'error'); }
    ta.remove();
  }
}

function uploadEmployeeQr(e) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp';
  input.addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (file.size > 4_000_000) { showToast('图片需在 4MB 以内', 'error'); return; }
    try {
      const dataUrl = await fileToDataUrl(file);
      const r = await fetch(`/api/admin/employees/${e.id}/wechat-qr`, {
        method: 'POST',
        headers: authHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({ dataUrl })
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '上传失败');
      await refreshAdmin();
      render();
      showToast(`${e.name} 收款码已更新`);
    } catch (err) { showToast(err.message, 'error'); }
  });
  input.click();
}

/* ---------- 礼物目录（admin） ---------- */
giftSearchInput.addEventListener('input', () => { giftSearch = giftSearchInput.value.trim().toLowerCase(); renderGiftCatalog(); });
giftFilter.addEventListener('change', () => { giftCategoryFilter = giftFilter.value; renderGiftCatalog(); });

function renderGiftCatalog() {
  if (!adminState) return;
  giftListEl.replaceChildren();
  const gifts = adminState.catalog || [];
  const filtered = gifts.filter((g) => {
    if (giftCategoryFilter !== 'all' && g.category !== giftCategoryFilter) return false;
    if (!giftSearch) return true;
    return g.name.toLowerCase().includes(giftSearch) || g.id.toLowerCase().includes(giftSearch);
  });
  if (!filtered.length) {
    const p = document.createElement('p'); p.className = 'empty-tip'; p.textContent = '没有匹配的礼物。';
    giftListEl.append(p);
    return;
  }
  const groups = new Map(CATEGORIES.map((c) => [c, []]));
  for (const g of filtered) (groups.get(g.category) || groups.get('普通礼物')).push(g);
  for (const cat of CATEGORIES) {
    const list = groups.get(cat);
    if (!list?.length) continue;
    const h = document.createElement('div'); h.className = 'gift-group-header'; h.textContent = cat;
    giftListEl.append(h);
    for (const g of list) giftListEl.append(buildGiftRow(g));
  }
}

const expandedRows = new Set();
function buildGiftRow(gift) {
  const row = document.createElement('div');
  row.className = `gift-row ${gift.enabled ? '' : 'is-disabled'} ${expandedRows.has(gift.id) ? 'is-open' : ''}`;
  row.innerHTML = `
    <div class="gift-row-head">
      <div class="gift-row-thumb"><img src="${escapeAttr(gift.image)}" alt="${escapeAttr(gift.name)}" loading="lazy"></div>
      <div class="gift-row-meta-wrap">
        <div class="gift-row-name">${escapeHtml(gift.name)} · ¥${gift.price}</div>
        <div class="gift-row-meta">${escapeHtml(gift.category)}${gift.benefit ? ' · ' + escapeHtml(gift.benefit) : ''} · ID: ${gift.id}</div>
      </div>
      <div class="gift-row-ops">
        <label class="switch" title="${gift.enabled ? '上线中' : '已下架'}"><input type="checkbox" ${gift.enabled ? 'checked' : ''}><span class="slider"></span></label>
        <span class="gift-row-expand">▾</span>
      </div>
    </div>
    <div class="gift-row-editor">
      <div class="editor-image">
        <div class="editor-image-preview"><img src="${escapeAttr(gift.image)}" alt=""></div>
        <div class="editor-image-actions">
          <label class="ghost-button file-button">替换图片<input data-field="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></label>
          <button class="ghost-button" data-action="reset-image" type="button">清除自定义图</button>
        </div>
      </div>
      <div class="editor-grid">
        <label><span>名称</span><input data-field="name" type="text" maxlength="24" value="${escapeAttr(gift.name)}"></label>
        <label><span>价格</span><input data-field="price" type="number" min="1" step="1" value="${gift.price}"></label>
        <label><span>分类</span><select data-field="category">${CATEGORIES.map((c) => `<option value="${c}" ${c === gift.category ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label class="wide-field"><span>福利文字</span><input data-field="benefit" maxlength="60" value="${escapeAttr(gift.benefit || '')}"></label>
      </div>
      <div class="editor-actions">
        <button class="ghost-button" data-action="reset" type="button">恢复默认</button>
        <button class="primary-button" data-action="save" type="button">保存修改</button>
      </div>
    </div>`;

  const head = row.querySelector('.gift-row-head');
  const ops = row.querySelector('.gift-row-ops');
  ops.addEventListener('click', (e) => e.stopPropagation());
  head.addEventListener('click', () => {
    if (expandedRows.has(gift.id)) expandedRows.delete(gift.id); else expandedRows.add(gift.id);
    row.classList.toggle('is-open');
  });
  row.querySelector('.switch input').addEventListener('change', (e) => toggleGiftEnabled(gift, e.target));
  row.querySelector('[data-action="save"]').addEventListener('click', () => saveGift(gift.id, row));
  row.querySelector('[data-action="reset"]').addEventListener('click', () => resetGift(gift.id));
  row.querySelector('[data-action="reset-image"]').addEventListener('click', () => clearGiftImage(gift));
  row.querySelector('[data-field="imageFile"]').addEventListener('change', (e) => uploadGiftImage(e, gift));
  return row;
}

async function toggleGiftEnabled(gift, cbx) {
  const enabled = cbx.checked;
  cbx.disabled = true;
  try {
    const r = await fetch(`/api/admin/gifts/${gift.id}/toggle`, {
      method: 'POST', headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ enabled })
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '操作失败');
    adminState.catalog = (await r.json()).catalog;
    renderGiftCatalog();
    showToast(`${gift.name} 已${enabled ? '上线' : '下架'}`);
  } catch (e) { cbx.checked = !enabled; showToast(e.message, 'error'); } finally { cbx.disabled = false; }
}
async function saveGift(id, row) {
  const data = {
    name: row.querySelector('[data-field="name"]').value,
    price: row.querySelector('[data-field="price"]').value,
    category: row.querySelector('[data-field="category"]').value,
    benefit: row.querySelector('[data-field="benefit"]').value
  };
  try {
    const r = await fetch(`/api/admin/gifts/${id}`, {
      method: 'POST', headers: authHeaders({ 'content-type': 'application/json' }), body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '保存失败');
    adminState.catalog = (await r.json()).catalog;
    renderGiftCatalog();
    showToast('已保存修改');
  } catch (e) { showToast(e.message, 'error'); }
}
async function resetGift(id) {
  if (!confirm('确认恢复为默认值？')) return;
  try {
    const r = await fetch(`/api/admin/gifts/${id}/reset`, { method: 'POST', headers: authHeaders() });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '失败');
    adminState.catalog = (await r.json()).catalog;
    renderGiftCatalog();
    showToast('已恢复默认');
  } catch (e) { showToast(e.message, 'error'); }
}
async function clearGiftImage(gift) {
  if (!confirm('确认清除自定义图？')) return;
  try {
    const r = await fetch(`/api/admin/gifts/${gift.id}/image`, { method: 'DELETE', headers: authHeaders() });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '失败');
    adminState.catalog = (await r.json()).catalog;
    renderGiftCatalog();
    showToast('已恢复默认图');
  } catch (e) { showToast(e.message, 'error'); }
}
async function uploadGiftImage(ev, gift) {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  if (!file) return;
  if (file.size > 4_000_000) { showToast('图片需在 4MB 以内', 'error'); return; }
  try {
    const dataUrl = await fileToDataUrl(file);
    const r = await fetch(`/api/admin/gifts/${gift.id}/image`, {
      method: 'POST', headers: authHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ dataUrl })
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '上传失败');
    adminState.catalog = (await r.json()).catalog;
    expandedRows.add(gift.id);
    renderGiftCatalog();
    showToast(`${gift.name} 图片已替换`);
  } catch (e) { showToast(e.message, 'error'); }
}

/* ---------- 送礼记录（admin） ---------- */
actEmpFilter.addEventListener('change', async () => {
  activityFilter = actEmpFilter.value;
  await refreshActivities();
  renderActivities();
});
activitySearchInput.addEventListener('input', () => { activitySearch = activitySearchInput.value.trim().toLowerCase(); renderActivities(); });
clearActivitiesButton.addEventListener('click', async () => {
  const label = activityFilter ? '当前员工' : '全部';
  if (!confirm(`确认清空${label}送礼记录？该操作不可恢复。`)) return;
  try {
    const r = await fetch('/api/admin/activities/clear', {
      method: 'POST', headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ employeeId: activityFilter || '' })
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '失败');
    await refreshActivities();
    renderActivities();
    showToast('已清空');
  } catch (e) { showToast(e.message, 'error'); }
});

function renderActivities() {
  activityRows.replaceChildren();
  const list = allActivities.filter((a) => {
    if (!activitySearch) return true;
    const hay = `${a.employeeName || ''} ${a.giftName || ''} ${a.phone || ''}`.toLowerCase();
    return hay.includes(activitySearch);
  });
  activityEmpty.hidden = list.length > 0;
  for (const a of list) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="cell-time">${formatDateTime(a.createdAt)}</td>
      <td>${escapeHtml(a.employeeName || '已删除')}</td>
      <td>${escapeHtml(a.giftName || '未知')}</td>
      <td class="cell-amount">¥${a.price}</td>
      <td class="cell-msg">${escapeHtml(a.phone || '匿名')}</td>
      <td class="cell-action"><button class="link-danger" data-id="${a.id}">删除</button></td>`;
    tr.querySelector('[data-id]').addEventListener('click', () => deleteActivity(a.id));
    activityRows.append(tr);
  }
}
async function deleteActivity(id) {
  if (!confirm('删除该条记录？')) return;
  try {
    const r = await fetch(`/api/admin/activities/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '失败');
    await refreshActivities();
    renderActivities();
    showToast('已删除');
  } catch (e) { showToast(e.message, 'error'); }
}

/* ---------- 客户登录（admin） ---------- */
loginEmpFilter.addEventListener('change', async () => {
  loginFilter = loginEmpFilter.value;
  await refreshLogins();
  renderLogins();
});
loginSearch.addEventListener('input', () => { loginSearchValue = loginSearch.value.trim().toLowerCase(); renderLogins(); });
clearLoginsButton.addEventListener('click', async () => {
  const label = loginFilter ? '当前员工' : '全部';
  if (!confirm(`确认清空${label}客户登录记录？`)) return;
  try {
    const r = await fetch('/api/admin/customer-logins/clear', {
      method: 'POST', headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ employeeId: loginFilter || '' })
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '失败');
    await refreshLogins();
    renderLogins();
    showToast('已清空');
  } catch (e) { showToast(e.message, 'error'); }
});

function renderLogins() {
  if (!adminState) return;
  /* 同步员工筛选下拉 */
  const opts = ['<option value="">全站汇总</option>', ...adminState.employees.map((e) => `<option value="${e.id}">${escapeHtml(e.name)} · /${escapeHtml(e.slug)}</option>`)];
  loginEmpFilter.innerHTML = opts.join('');
  loginEmpFilter.value = loginFilter;

  /* KPI（基于当前筛选） */
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayLogins = allCustomerLogins.filter((c) => Date.parse(c.createdAt) >= todayStart.getTime());
  const uniqInScope = new Set(allCustomerLogins.map((c) => c.phone)).size;
  const smsCount = allCustomerLogins.filter((c) => c.method === 'sms').length;
  loginTotalCount.textContent = String(allCustomerLogins.length);
  loginTotalTrend.textContent = loginFilter ? '当前员工' : '全站';
  loginUniqueCount.textContent = String(uniqInScope);
  loginUniqueTrend.textContent = loginFilter ? '此员工的去重' : `全站 ${totalUniquePhones} 人`;
  loginTodayCount.textContent = String(todayLogins.length);
  loginTodayTrend.textContent = `今日 ${new Set(todayLogins.map((c) => c.phone)).size} 人`;
  loginSmsCount.textContent = String(smsCount);
  loginSmsTrend.textContent = `占比 ${allCustomerLogins.length ? Math.round((smsCount / allCustomerLogins.length) * 100) : 0}%`;

  /* 表格 */
  loginRows.replaceChildren();
  const list = allCustomerLogins.filter((c) => {
    if (!loginSearchValue) return true;
    const hay = `${c.employeeName || ''} ${c.phone || ''}`.toLowerCase();
    return hay.includes(loginSearchValue);
  });
  loginEmpty.hidden = list.length > 0;
  for (const c of list) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="cell-time">${formatDateTime(c.createdAt)}</td>
      <td>${escapeHtml(c.phone || '')}</td>
      <td>${escapeHtml(c.employeeName || '未知')}</td>
      <td><span class="emp-role role-${c.method === 'sms' ? 'admin' : 'employee'}">${c.method === 'sms' ? 'SMS' : '手机号'}</span></td>`;
    loginRows.append(tr);
  }
}

/* ---------- 站点设置（admin） ---------- */
function renderSettings() {
  if (!adminState) return;
  brandInput.value = adminState.brandName || '';
  siteUrlInput.value = adminState.siteUrl || '';
  updateSiteUrlPreview();
  payUrlInput.value = adminState.defaultWechatPayUrl || '';
  const sms = adminState.sms || {};
  smsEnabled.checked = !!sms.enabled;
  smsSecretId.value = sms.secretId || '';
  smsSecretKey.value = '';
  smsSecretKey.placeholder = sms.secretKeySet ? '已设置 · 留空则不修改' : '请输入 SecretKey';
  smsSdkAppId.value = sms.sdkAppId || '';
  smsRegion.value = sms.region || 'ap-guangzhou';
  smsSignName.value = sms.signName || '';
  smsTemplateId.value = sms.templateId || '';
  if (sms.actuallyEnabled) {
    smsStatus.textContent = '已启用';
    smsStatus.className = 'card-sub status-ok';
  } else if (sms.enabled) {
    smsStatus.textContent = '已开启但配置不完整';
    smsStatus.className = 'card-sub status-warn';
  } else {
    smsStatus.textContent = '未启用（客户只填手机号）';
    smsStatus.className = 'card-sub';
  }
}

function updateSiteUrlPreview() {
  const v = siteUrlInput.value.trim().replace(/\/+$/, '');
  const sample = me?.slug || 'sakura';
  siteUrlPreview.textContent = `${v || location.origin}/u/${sample}`;
}
siteUrlInput.addEventListener('input', updateSiteUrlPreview);

saveAdminButton.addEventListener('click', async () => {
  try {
    const r = await fetch('/api/admin/settings', {
      method: 'POST', headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        brandName: brandInput.value,
        siteUrl: siteUrlInput.value,
        defaultWechatPayUrl: payUrlInput.value
      })
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '保存失败');
    const data = await r.json();
    adminState.brandName = data.brandName;
    adminState.siteUrl = data.siteUrl;
    adminState.defaultWechatPayUrl = data.defaultWechatPayUrl;
    /* siteUrl 影响所有视图的链接，整体重渲 */
    render();
    showToast('已保存');
  } catch (e) { showToast(e.message, 'error'); }
});

smsSaveButton.addEventListener('click', async () => {
  try {
    const body = {
      enabled: smsEnabled.checked,
      sdkAppId: smsSdkAppId.value, region: smsRegion.value,
      signName: smsSignName.value, templateId: smsTemplateId.value
    };
    /* 只有当输入框值不带掩码时，才传 secretId（避免覆盖 mask 显示值） */
    if (smsSecretId.value && !smsSecretId.value.includes('****')) body.secretId = smsSecretId.value;
    if (smsSecretKey.value) body.secretKey = smsSecretKey.value;
    const r = await fetch('/api/admin/sms', {
      method: 'POST', headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '保存失败');
    const data = await r.json();
    adminState.sms = data.sms;
    renderSettings();
    showToast('SMS 配置已保存');
  } catch (e) { showToast(e.message, 'error'); }
});

smsTestButton.addEventListener('click', async () => {
  const phone = smsTestPhone.value.trim();
  if (!/^1[3-9]\d{9}$/.test(phone)) { showToast('手机号格式不正确', 'error'); return; }
  try {
    const r = await fetch('/api/admin/sms/test', {
      method: 'POST', headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ phone })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || '发送失败');
    showToast(`测试短信已发送（验证码 ${data.code}）`);
  } catch (e) { showToast(e.message, 'error'); }
});

/* ---------- 通用上传 ---------- */
async function uploadImage(ev, url, successMsg, applyUpdate) {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  if (!file) return;
  if (file.size > 4_000_000) { showToast('图片需在 4MB 以内', 'error'); return; }
  try {
    const dataUrl = await fileToDataUrl(file);
    const r = await fetch(url, {
      method: 'POST', headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ dataUrl })
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '上传失败');
    const data = await r.json();
    applyUpdate(data);
    render();
    showToast(successMsg);
  } catch (e) { showToast(e.message, 'error'); }
}

/* ---------- 工具 ---------- */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
function formatCurrency(n) { return `¥${(n || 0).toLocaleString('zh-CN')}`; }
function formatDate(iso) {
  const t = Date.parse(iso); if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}
function formatDateTime(iso) {
  const t = Date.parse(iso); if (!Number.isFinite(t)) return '';
  const d = new Date(t); const today = new Date();
  const same = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  return same ? `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}` : `${d.getMonth() + 1}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatRelative(iso) {
  const t = Date.parse(iso); if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
function pad(x) { return String(x).padStart(2, '0'); }

/* ---------- 启动 ---------- */
function bootstrap() {
  switchView(location.hash.replace('#', '') || 'dashboard');
  if (getToken()) {
    refreshAll().then(() => { hideLogin(); }).catch(() => { showLogin(); });
  } else {
    showLogin();
  }
  /* 周期同步 */
  setInterval(() => {
    if (getToken() && document.visibilityState === 'visible' && loginOverlay.hidden) {
      refreshMe().then(() => {
        if (me?.role === 'admin') return Promise.all([refreshAdmin(), refreshActivities()]);
      }).then(() => render()).catch(() => {});
    }
  }, 12_000);
}

bootstrap();
