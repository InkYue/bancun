import { audioEngine } from './audio.js';

const $ = (sel) => document.querySelector(sel);

const slugMatch = window.location.pathname.match(/^\/u\/([a-z0-9-]+)\/?$/i);
const slug = slugMatch ? slugMatch[1].toLowerCase() : '';
if (!slug) {
  window.location.replace('/');
}

/* token 按 slug 隔离：访问新员工链接时强制重新登录 */
const TOKEN_KEY = `bancun-customer-token:${slug}`;
const PENDING_GIFT_KEY = `bancun-pending-gift:${slug}`;
/* 手机号在全站共享一份做"上次输入"预填，省得每次重打 */
const PHONE_KEY = 'bancun-customer-last-phone';

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
const quantityInput = document.createElement('input');

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
let smsRequired = false;
let paying = false;
let knownLitGiftIds = null;
let celebrationTimer = 0;
let quantityGift = null;

const currencyFormatter = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 });
const MAX_GIFT_QUANTITY = 999;

quantityInput.id = 'quantityInput';
quantityInput.type = 'text';
quantityInput.inputMode = 'numeric';
quantityInput.autocomplete = 'off';
quantityInput.value = '1';
quantityInput.placeholder = '1';

const quantityOverlay = document.createElement('div');
quantityOverlay.className = 'overlay overlay-modal gift-quantity-overlay';
quantityOverlay.hidden = true;
quantityOverlay.innerHTML = `
  <div class="overlay-mask" data-close-quantity></div>
  <div class="overlay-card gift-quantity-card" role="dialog" aria-modal="true" aria-labelledby="quantityTitle">
    <button class="overlay-close" type="button" data-close-quantity aria-label="关闭">×</button>
    <p class="eyebrow">Gift Quantity</p>
    <h2 id="quantityTitle">选择数量</h2>
    <p class="overlay-hint gift-quantity-name"></p>
    <label class="amount-field quantity-field" for="quantityInput">
      <span>礼物数量</span>
    </label>
    <p class="match-hint gift-quantity-total"></p>
    <div class="overlay-actions">
      <button class="ghost-button" type="button" data-close-quantity>取消</button>
      <button class="primary-button" type="button" id="quantityConfirm">确认送礼</button>
    </div>
  </div>
`;
quantityOverlay.querySelector('.quantity-field')?.append(quantityInput);
document.body.append(quantityOverlay);
const quantityName = quantityOverlay.querySelector('.gift-quantity-name');
const quantityTotal = quantityOverlay.querySelector('.gift-quantity-total');
const quantityConfirm = quantityOverlay.querySelector('#quantityConfirm');

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

/* ---------- 送礼庆祝 ---------- */
function savePendingGift(gift) {
  try {
    localStorage.setItem(PENDING_GIFT_KEY, JSON.stringify({ id: gift.id, createdAt: Date.now() }));
  } catch {}
}

function readPendingGift() {
  try {
    const raw = localStorage.getItem(PENDING_GIFT_KEY);
    if (!raw) return null;
    const gift = JSON.parse(raw);
    if (!gift?.id || Date.now() - Number(gift.createdAt || 0) > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(PENDING_GIFT_KEY);
      return null;
    }
    return gift;
  } catch {
    return null;
  }
}

function clearPendingGift() {
  try { localStorage.removeItem(PENDING_GIFT_KEY); } catch {}
}

function findGiftById(giftId) {
  return appState?.gifts.find((g) => g.id === giftId) || null;
}

function normalizeQuantity(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 1;
  const match = raw.match(/^x?([1-9]\d{0,2})$/);
  if (!match) return 0;
  const quantity = Number(match[1]);
  return quantity >= 1 && quantity <= MAX_GIFT_QUANTITY ? quantity : 0;
}

function updateQuantityPreview() {
  if (!quantityGift) return;
  const quantity = normalizeQuantity(quantityInput.value);
  quantityName.textContent = `${quantityGift.name} · 单价 ￥${quantityGift.price}`;
  if (!quantity) {
    quantityTotal.textContent = '请输入 1-999，或 x10 / x100。';
    quantityTotal.classList.add('is-error');
    quantityTotal.classList.remove('is-ok');
    quantityConfirm.disabled = true;
    return;
  }
  quantityTotal.textContent = quantity > 1
    ? `数量 × ${quantity}，合计 ￥${quantityGift.price * quantity}`
    : `默认数量 1，合计 ￥${quantityGift.price}`;
  quantityTotal.classList.add('is-ok');
  quantityTotal.classList.remove('is-error');
  quantityConfirm.disabled = false;
}

function openQuantityDialog(gift) {
  quantityGift = gift;
  quantityInput.value = '1';
  updateQuantityPreview();
  quantityOverlay.hidden = false;
  document.body.classList.add('is-locked');
  setTimeout(() => quantityInput.focus(), 30);
}

function closeQuantityDialog() {
  quantityOverlay.hidden = true;
  document.body.classList.remove('is-locked');
  quantityGift = null;
}

function triggerGiftCelebration(giftId) {
  const gift = findGiftById(giftId);
  if (!gift) return;

  const giftCard = document.querySelector(`.gift-card[data-gift-id="${CSS.escape(gift.id)}"]`);
  giftCard?.classList.add('is-celebrating');
  window.setTimeout(() => giftCard?.classList.remove('is-celebrating'), 1200);

  document.querySelector('.gift-celebration')?.remove();
  window.clearTimeout(celebrationTimer);

  const layer = document.createElement('div');
  layer.className = 'gift-celebration';
  layer.setAttribute('role', 'status');
  layer.setAttribute('aria-live', 'polite');
  layer.setAttribute('aria-label', `${gift.name} 已点亮，送礼成功`);

  const burst = document.createElement('div');
  burst.className = 'gift-celebration-burst';
  burst.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < 28; i += 1) {
    const particle = document.createElement('span');
    particle.className = 'gift-particle';
    particle.style.setProperty('--angle', `${(360 / 28) * i}deg`);
    particle.style.setProperty('--distance', `${7 + (i % 5) * 1.15}rem`);
    particle.style.setProperty('--delay', `${(i % 7) * 32}ms`);
    particle.style.setProperty('--hue', String(i % 4));
    burst.append(particle);
  }

  const salutes = document.createElement('div');
  salutes.className = 'gift-salutes';
  salutes.setAttribute('aria-hidden', 'true');
  [
    ['18%', '76%', '-24deg', '0ms'],
    ['82%', '76%', '24deg', '140ms'],
    ['32%', '66%', '-12deg', '280ms'],
    ['68%', '66%', '12deg', '420ms']
  ].forEach(([x, y, tilt, delay], index) => {
    const salute = document.createElement('div');
    salute.className = 'gift-salute';
    salute.style.setProperty('--x', x);
    salute.style.setProperty('--y', y);
    salute.style.setProperty('--tilt', tilt);
    salute.style.setProperty('--delay', delay);
    salute.style.setProperty('--tone', String(index % 3));

    for (let i = 0; i < 14; i += 1) {
      const streamer = document.createElement('span');
      streamer.style.setProperty('--spread', `${-58 + i * 9}deg`);
      streamer.style.setProperty('--height', `${4.6 + (i % 4) * 0.55}rem`);
      streamer.style.setProperty('--delay', `${Number.parseInt(delay, 10) + (i % 5) * 34}ms`);
      streamer.style.setProperty('--hue', String(i % 4));
      salute.append(streamer);
    }

    salutes.append(salute);
  });

  const badge = document.createElement('div');
  badge.className = 'gift-celebration-badge';
  badge.innerHTML = `
    <span class="gift-celebration-icon">${gift.emoji}</span>
    <strong>礼物已点亮</strong>
    <em>${gift.name}</em>
  `;

  layer.append(salutes, burst, badge);
  document.body.append(layer);
  celebrationTimer = window.setTimeout(() => layer.remove(), 2300);
}

function celebratePendingGiftIfReady() {
  const pendingGift = readPendingGift();
  if (!pendingGift || !appState?.employee.litGiftIds.includes(pendingGift.id)) return;
  triggerGiftCelebration(pendingGift.id);
  clearPendingGift();
}

/* ---------- 数据 ---------- */
async function loadEmployeeState({ celebrateNewLit = false } = {}) {
  const previousLitIds = knownLitGiftIds;
  const r = await fetch(`/api/employees/${slug}/state`, { cache: 'no-store' });
  if (r.status === 404) {
    window.location.replace('/');
    throw new Error('not-found');
  }
  if (!r.ok) throw new Error('无法读取员工页面状态。');
  appState = await r.json();
  smsRequired = Boolean(appState.smsRequired);
  render();
  const currentLitIds = new Set(appState.employee.litGiftIds);
  if (celebrateNewLit && previousLitIds) {
    const pendingGift = readPendingGift();
    if (pendingGift && currentLitIds.has(pendingGift.id) && !previousLitIds.has(pendingGift.id)) {
      triggerGiftCelebration(pendingGift.id);
      clearPendingGift();
    }
  }
  knownLitGiftIds = currentLitIds;
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
      openQuantityDialog(gift);
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
  matchHint.textContent = `已匹配：${gift.name}（￥${gift.price}），点击下方按钮发起支付。`;
  matchHint.classList.add('is-ok');
  matchHint.classList.remove('is-error');
}

function findGiftByAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return appState?.gifts.find((g) => g.price === amount) || null;
}

async function createPayment(gift, quantity = 1) {
  const r = await fetch(`/api/employees/${slug}/gifts/${gift.id}/pay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-customer-token': getToken() },
    body: JSON.stringify({ amount: gift.price * quantity, quantity })
  });
  if (r.status === 401) {
    clearToken();
    showLoginGate();
    throw new Error('登录已失效，请重新输入手机号。');
  }
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || '创建支付订单失败。');
  }
  return r.json();
}

async function startPay(gift, quantity = 1) {
  if (!getToken()) { showLoginGate(); return; }
  if (!appState.paymentReady) { showToast('支付暂未配置，请联系管理员。'); return; }
  if (paying) return;
  if (!normalizeQuantity(quantity)) { showToast('请先确认礼物数量。'); return; }
  paying = true;
  payButton.disabled = true;
  quantityConfirm.disabled = true;
  try {
    const data = await createPayment(gift, quantity);
    if (!data.paymentUrl) throw new Error('支付链接生成失败。');
    savePendingGift(gift);
    showToast(`订单已创建，正在前往${data.providerName || appState.paymentProviderName || '支付通道'}。`);
    window.location.href = data.paymentUrl;
  } catch (err) {
    showToast(err.message || '支付失败。');
    paying = false;
    payButton.disabled = false;
    quantityConfirm.disabled = false;
  }
}

function handlePaymentReturnHint() {
  const params = new URLSearchParams(window.location.search);
  const outcome = params.get('pay');
  if (!outcome) return;
  if (outcome === 'success') {
    showToast('支付成功，礼物已为你点亮。');
    celebratePendingGiftIfReady();
  } else if (outcome === 'failed' || outcome === 'mismatch') {
    clearPendingGift();
    showToast('支付未完成，请重新发起支付或联系管理员。');
  }
  else showToast('支付结果处理中，请稍后刷新查看点亮状态。');
  const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
  window.history.replaceState(null, '', cleanUrl);
}

amountInput.addEventListener('input', updateMatchHint);
quantityInput.addEventListener('input', updateQuantityPreview);
quantityInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') quantityConfirm.click();
});
quantityOverlay.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-quantity]')) closeQuantityDialog();
});
quantityConfirm.addEventListener('click', () => {
  const quantity = normalizeQuantity(quantityInput.value);
  if (!quantity || !quantityGift) { updateQuantityPreview(); return; }
  const gift = quantityGift;
  closeQuantityDialog();
  startPay(gift, quantity);
});
payButton.addEventListener('click', () => {
  const gift = findGiftByAmount(amountInput.value);
  if (!gift) { showToast('请先输入礼物单上的正确金额。'); return; }
  startPay(gift, 1);
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
    handlePaymentReturnHint();
    const savedPhone = (() => { try { return localStorage.getItem(PHONE_KEY) || ''; } catch { return ''; } })();
    if (savedPhone) phoneInput.value = savedPhone;
  } catch (e) {
    if (e.message !== 'not-found') showToast(e.message || '加载失败。');
    return;
  }
  if (getToken()) {
    hideLoginGate();
    /* 周期同步状态 */
    setInterval(() => { loadEmployeeState({ celebrateNewLit: true }).catch(() => {}); }, 8000);
  } else {
    showLoginGate();
  }
}

bootstrap();
