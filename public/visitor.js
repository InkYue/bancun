import { audioEngine } from './audio.js';

const $ = (sel) => document.querySelector(sel);

const slugMatch = window.location.pathname.match(/^\/u\/([a-z0-9-]+)\/?$/i);
const slug = slugMatch ? slugMatch[1].toLowerCase() : '';
if (!slug) {
  window.location.replace('/');
}

const TOKEN_KEY = 'bancun-customer-token';
const PHONE_KEY = 'bancun-customer-phone';

/* DOM */
const pageShell = $('#pageShell');
const heroAvatar = $('#heroAvatar');
const heroAvatarImg = $('#heroAvatarImg');
const brandName = $('#brandName');
const employeeName = $('#employeeName');
const heroIntro = $('#heroIntro');
const customerLogout = $('#customerLogout');

const normalGiftGrid = $('#normalGiftGrid');
const premiumGiftGrid = $('#premiumGiftGrid');
const specialGiftGrid = $('#specialGiftGrid');

const amountInput = $('#amountInput');
const matchHint = $('#matchHint');
const payButton = $('#payButton');
const musicToggle = $('#musicToggle');
const toast = $('#toast');

const overlay = $('#payOverlay');
const overlayTitle = $('#overlayTitle');
const overlayQr = $('#overlayQr');
const overlayPaid = $('#overlayPaid');

const loginGate = $('#loginGate');
const phoneInput = $('#phoneInput');
const phoneError = $('#phoneError');
const codeFieldWrap = $('#codeFieldWrap');
const codeInput = $('#codeInput');
const codeError = $('#codeError');
const sendCodeButton = $('#sendCodeButton');
const loginButton = $('#loginButton');
const gateTip = $('#gateTip');
const gateHint = $('#gateHint');

/* 状态 */
let appState = null;
let activeGift = null;
let smsRequired = false;

const currencyFormatter = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 });

/* ---------- token 管理 ---------- */
function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
function setToken(token, phone) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (phone) localStorage.setItem(PHONE_KEY, phone);
  } catch {}
}
function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PHONE_KEY);
  } catch {}
}

/* ---------- toast ---------- */
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
}
showToast.timer = 0;

/* ---------- 数据 ---------- */
async function loadEmployeeState() {
  const r = await fetch(`/api/employees/${slug}/state`, { cache: 'no-store' });
  if (r.status === 404) {
    window.location.replace('/');
    throw new Error('not-found');
  }
  if (!r.ok) throw new Error('无法读取员工页面状态。');
  appState = await r.json();
  smsRequired = Boolean(appState.smsRequired);
  render();
}

function render() {
  if (!appState) return;
  const emp = appState.employee;
  brandName.textContent = appState.brandName;
  employeeName.textContent = emp.name;
  document.title = `${emp.name} · ${appState.brandName}`;
  if (emp.avatarPath) {
    heroAvatarImg.src = emp.avatarPath;
    heroAvatar.hidden = false;
  } else {
    heroAvatar.hidden = true;
  }
  if (emp.intro) {
    heroIntro.textContent = emp.intro;
    heroIntro.hidden = false;
  } else {
    heroIntro.hidden = true;
  }

  const all = appState.gifts;
  renderGiftGrid(normalGiftGrid, all.filter((g) => g.category === '普通礼物'));
  renderGiftGrid(premiumGiftGrid, all.filter((g) => g.category === '冠名礼物'));
  renderGiftGrid(specialGiftGrid, all.filter((g) => g.category === '特殊礼物'));
  updateMatchHint();
}

function renderGiftGrid(container, gifts) {
  container.replaceChildren();
  const litIds = new Set(appState.employee.litGiftIds);
  for (const gift of gifts) {
    const isLit = litIds.has(gift.id);
    const button = document.createElement('button');
    button.className = `gift-card ${isLit ? 'is-lit' : 'is-dark'}`;
    button.type = 'button';
    button.dataset.giftId = gift.id;
    button.setAttribute('aria-pressed', String(isLit));
    button.setAttribute('aria-label', `${gift.name}，${currencyFormatter.format(gift.price)}`);

    const iconWrap = document.createElement('span');
    iconWrap.className = 'gift-icon-wrap';
    const image = document.createElement('img');
    image.className = 'gift-image';
    image.src = gift.image;
    image.alt = gift.name;
    image.loading = 'lazy';
    const emoji = document.createElement('span');
    emoji.className = 'gift-emoji';
    emoji.textContent = gift.emoji;
    emoji.hidden = true;
    image.addEventListener('error', () => { image.remove(); emoji.hidden = false; });
    iconWrap.append(image, emoji);

    const name = document.createElement('strong');
    name.textContent = gift.name;
    const price = document.createElement('span');
    price.className = 'gift-price';
    price.textContent = `—￥${gift.price}—`;

    button.append(iconWrap, name, price);
    if (gift.benefit) {
      const small = document.createElement('small');
      small.textContent = gift.benefit;
      button.append(small);
    }

    button.addEventListener('click', () => {
      amountInput.value = String(gift.price);
      updateMatchHint();
      startPay(gift);
    });
    container.append(button);
  }
}

function updateMatchHint() {
  const value = amountInput.value.trim();
  if (!value) {
    matchHint.textContent = '输入金额后会自动匹配对应礼物，也可直接点上方礼物。';
    matchHint.classList.remove('is-ok', 'is-error');
    return;
  }
  const gift = findGiftByAmount(value);
  if (!gift) {
    matchHint.textContent = '暂无匹配礼物，请输入礼物单上的金额。';
    matchHint.classList.add('is-error');
    matchHint.classList.remove('is-ok');
    return;
  }
  matchHint.textContent = `已匹配：${gift.name}（￥${gift.price}），点击下方按钮支付并点亮。`;
  matchHint.classList.add('is-ok');
  matchHint.classList.remove('is-error');
}

function findGiftByAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return appState?.gifts.find((g) => g.price === amount) || null;
}

function buildWechatUrl(gift) {
  const raw = appState.employee.wechatPayUrl || '';
  if (!raw) return '';
  return raw
    .replaceAll('{amount}', encodeURIComponent(String(gift.price)))
    .replaceAll('{giftName}', encodeURIComponent(gift.name))
    .replaceAll('{giftId}', encodeURIComponent(gift.id));
}

async function lightGift(gift) {
  const r = await fetch(`/api/employees/${slug}/gifts/${gift.id}/light`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-customer-token': getToken() },
    body: JSON.stringify({ amount: gift.price })
  });
  if (r.status === 401) {
    clearToken();
    showLoginGate();
    throw new Error('登录已失效，请重新输入手机号。');
  }
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || '点亮礼物失败。');
  }
  const data = await r.json();
  appState.employee.litGiftIds = data.litGiftIds || appState.employee.litGiftIds;
  await audioEngine.playGift(gift.sound);
  render();
}

function startPay(gift) {
  if (!getToken()) { showLoginGate(); return; }
  activeGift = gift;
  if (appState.employee.wechatQrPath) {
    openOverlay(gift);
    return;
  }
  const url = buildWechatUrl(gift);
  if (url) window.location.href = url;
  lightGift(gift)
    .then(() => showToast(`${gift.name} 已点亮，正在跳转微信。`))
    .catch((err) => showToast(err.message || '点亮失败。'));
}

function openOverlay(gift) {
  overlayTitle.textContent = `— ${gift.name} · ¥${gift.price} —`;
  overlayQr.src = appState.employee.wechatQrPath;
  overlayQr.alt = `${gift.name} 收款码`;
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeOverlay() {
  overlay.hidden = true;
  activeGift = null;
  document.body.style.overflow = '';
}

overlay.addEventListener('click', (e) => { if (e.target.matches('[data-close-overlay]')) closeOverlay(); });
overlayPaid.addEventListener('click', async () => {
  if (!activeGift) return closeOverlay();
  const gift = activeGift;
  try {
    await lightGift(gift);
    showToast(`${gift.name} 已点亮 · 感谢你的甜蜜！`);
  } catch (err) {
    showToast(err.message || '点亮失败');
  } finally { closeOverlay(); }
});

amountInput.addEventListener('input', updateMatchHint);
payButton.addEventListener('click', () => {
  const gift = findGiftByAmount(amountInput.value);
  if (!gift) { showToast('请先输入礼物单上的正确金额。'); return; }
  startPay(gift);
});

musicToggle.addEventListener('click', async () => {
  try {
    const enabled = await audioEngine.toggleBgm();
    musicToggle.setAttribute('aria-label', enabled ? '关闭背景音乐' : '开启背景音乐');
    musicToggle.setAttribute('aria-pressed', String(enabled));
    musicToggle.querySelector('span').textContent = enabled ? '🔊' : '🔇';
    musicToggle.classList.toggle('is-active', enabled);
  } catch { showToast('当前浏览器暂不支持 WebAudio。'); }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) closeOverlay(); });

customerLogout.addEventListener('click', () => {
  if (!confirm('确认退出当前手机号？')) return;
  clearToken();
  showLoginGate();
  showToast('已退出，请重新登录。');
});

/* ---------- 登录闸门 ---------- */
function showLoginGate() {
  pageShell.hidden = true;
  loginGate.hidden = false;
  codeFieldWrap.hidden = !smsRequired;
  if (smsRequired) {
    gateTip.textContent = '请输入手机号并获取短信验证码';
    gateHint.textContent = '验证码 5 分钟内有效';
  } else {
    gateTip.textContent = '请输入您的中国大陆手机号';
    gateHint.textContent = '您的手机号将作为送礼记录的身份标识';
  }
  setTimeout(() => phoneInput.focus(), 30);
}
function hideLoginGate() {
  loginGate.hidden = true;
  pageShell.hidden = false;
}

function setError(el, message) {
  if (message) { el.textContent = message; el.hidden = false; }
  else { el.textContent = ''; el.hidden = true; }
}

function validatePhone(value) {
  if (!value) return '请输入手机号。';
  if (!/^1[3-9]\d{9}$/.test(value)) return '手机号格式不正确（11 位中国大陆手机号）。';
  return '';
}

phoneInput.addEventListener('input', () => setError(phoneError, ''));
codeInput.addEventListener('input', () => setError(codeError, ''));

let codeCooldownTimer = 0;
function startCodeCooldown(seconds) {
  let left = seconds;
  sendCodeButton.disabled = true;
  sendCodeButton.textContent = `${left}s 后重发`;
  window.clearInterval(codeCooldownTimer);
  codeCooldownTimer = window.setInterval(() => {
    left -= 1;
    if (left <= 0) {
      window.clearInterval(codeCooldownTimer);
      sendCodeButton.disabled = false;
      sendCodeButton.textContent = '获取验证码';
      return;
    }
    sendCodeButton.textContent = `${left}s 后重发`;
  }, 1000);
}

sendCodeButton.addEventListener('click', async () => {
  const phone = phoneInput.value.trim();
  const err = validatePhone(phone);
  if (err) { setError(phoneError, err); return; }
  sendCodeButton.disabled = true;
  try {
    const r = await fetch('/api/customer/sms/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.error || '验证码发送失败。');
    }
    showToast('验证码已发送，请查收短信。');
    startCodeCooldown(60);
  } catch (e) {
    showToast(e.message);
    sendCodeButton.disabled = false;
  }
});

loginButton.addEventListener('click', tryLogin);
phoneInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });

async function tryLogin() {
  const phone = phoneInput.value.trim();
  const phoneErr = validatePhone(phone);
  if (phoneErr) { setError(phoneError, phoneErr); return; }
  const payload = { phone, slug };
  if (smsRequired) {
    const code = codeInput.value.trim();
    if (!/^\d{6}$/.test(code)) { setError(codeError, '请输入 6 位验证码。'); return; }
    payload.code = code;
  }
  loginButton.disabled = true;
  try {
    const r = await fetch('/api/customer/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || '登录失败。');
    setToken(body.token, body.phone);
    hideLoginGate();
    showToast('登录成功，欢迎送礼！');
  } catch (e) {
    setError(codeError, e.message);
  } finally {
    loginButton.disabled = false;
  }
}

/* ---------- 启动 ---------- */
async function bootstrap() {
  try {
    await loadEmployeeState();
  } catch (e) {
    if (e.message !== 'not-found') showToast(e.message || '加载失败。');
    return;
  }
  if (getToken()) {
    hideLoginGate();
    /* 周期同步状态 */
    setInterval(() => { loadEmployeeState().catch(() => {}); }, 8000);
  } else {
    showLoginGate();
  }
}

bootstrap();
