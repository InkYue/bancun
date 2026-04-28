import { audioEngine } from './audio.js';

const $ = (sel) => document.querySelector(sel);

const normalGiftGrid = $('#normalGiftGrid');
const premiumGiftGrid = $('#premiumGiftGrid');
const specialGiftGrid = $('#specialGiftGrid');
const brandName = $('#brandName');
const amountInput = $('#amountInput');
const matchHint = $('#matchHint');
const payButton = $('#payButton');
const musicToggle = $('#musicToggle');
const toast = $('#toast');

const overlay = $('#payOverlay');
const overlayTitle = $('#overlayTitle');
const overlayQr = $('#overlayQr');
const overlayPaid = $('#overlayPaid');

let appState = {
  brandName: '半寸时光',
  wechatPayUrl: '',
  wechatQrPath: '',
  litGiftIds: [],
  gifts: []
};

/** 当前打开支付弹层关联的礼物 */
let activeGift = null;

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 0
});

async function fetchState() {
  const response = await fetch('/api/state', { cache: 'no-store' });
  if (!response.ok) throw new Error('无法读取礼物单状态。');
  appState = await response.json();
  render();
}

function render() {
  brandName.textContent = appState.brandName;
  document.title = `${appState.brandName}甜蜜礼物单`;

  const all = appState.gifts;
  renderGiftGrid(normalGiftGrid, all.filter((g) => g.category === '普通礼物'));
  renderGiftGrid(premiumGiftGrid, all.filter((g) => g.category === '冠名礼物'));
  renderGiftGrid(specialGiftGrid, all.filter((g) => g.category === '特殊礼物'));
  updateMatchHint();
}

function renderGiftGrid(container, gifts) {
  container.replaceChildren();
  const litIds = new Set(appState.litGiftIds);

  gifts.forEach((gift) => {
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

    image.addEventListener('error', () => {
      image.remove();
      emoji.hidden = false;
    });

    iconWrap.append(image, emoji);

    const name = document.createElement('strong');
    name.textContent = gift.name;

    const price = document.createElement('span');
    price.className = 'gift-price';
    price.textContent = `—￥${gift.price}—`;

    button.append(iconWrap, name, price);

    if (gift.benefit) {
      const benefit = document.createElement('small');
      benefit.textContent = gift.benefit;
      button.append(benefit);
    }

    button.addEventListener('click', () => {
      amountInput.value = String(gift.price);
      updateMatchHint();
      // 直接触发支付
      startPay(gift);
    });

    container.append(button);
  });
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
  return appState.gifts.find((g) => g.price === amount) || null;
}

function buildWechatUrl(gift) {
  const fallbackUrl = 'weixin://wxpay/bizpayurl?pr=replace-with-your-wechat-code';
  const rawUrl = appState.wechatPayUrl || fallbackUrl;
  return rawUrl
    .replaceAll('{amount}', encodeURIComponent(String(gift.price)))
    .replaceAll('{giftName}', encodeURIComponent(gift.name))
    .replaceAll('{giftId}', encodeURIComponent(gift.id));
}

async function lightGift(gift) {
  const response = await fetch(`/api/gifts/${gift.id}/light`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount: gift.price })
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || '点亮礼物失败。');
  }
  await audioEngine.playGift(gift.sound);
  await fetchState();
}

function startPay(gift) {
  activeGift = gift;
  // 优先：收款码图片
  if (appState.wechatQrPath) {
    openOverlay(gift);
    return;
  }
  // 否则：跳 weixin:// 链接
  const url = buildWechatUrl(gift);
  window.location.href = url;
  // 同步点亮（即便跳转失败也保留状态）
  lightGift(gift)
    .then(() => showToast(`${gift.name} 已点亮，正在跳转微信。`))
    .catch((err) => showToast(err.message || '点亮失败。'));
}

function openOverlay(gift) {
  overlayTitle.textContent = `— ${gift.name} · ¥${gift.price} —`;
  overlayQr.src = appState.wechatQrPath;
  overlayQr.alt = `${gift.name} 收款码`;
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeOverlay() {
  overlay.hidden = true;
  activeGift = null;
  document.body.style.overflow = '';
}

overlay.addEventListener('click', (event) => {
  if (event.target.matches('[data-close-overlay]')) closeOverlay();
});

overlayPaid.addEventListener('click', async () => {
  if (!activeGift) return closeOverlay();
  const gift = activeGift;
  try {
    await lightGift(gift);
    showToast(`${gift.name} 已点亮 · 感谢你的甜蜜！`);
  } catch (err) {
    showToast(err.message || '点亮失败');
  } finally {
    closeOverlay();
  }
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2600);
}
showToast.timer = 0;

amountInput.addEventListener('input', updateMatchHint);

payButton.addEventListener('click', async () => {
  const gift = findGiftByAmount(amountInput.value);
  if (!gift) {
    showToast('请先输入礼物单上的正确金额。');
    return;
  }
  startPay(gift);
});

musicToggle.addEventListener('click', async () => {
  try {
    const enabled = await audioEngine.toggleBgm();
    musicToggle.setAttribute('aria-label', enabled ? '关闭背景音乐' : '开启背景音乐');
    musicToggle.setAttribute('aria-pressed', String(enabled));
    musicToggle.querySelector('span').textContent = enabled ? '🔊' : '🔇';
    musicToggle.classList.toggle('is-active', enabled);
  } catch (error) {
    showToast('当前浏览器暂不支持 WebAudio。');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !overlay.hidden) closeOverlay();
});

fetchState().catch((error) => showToast(error.message));

// 轻量轮询同步点亮状态（管理员可能在另一端重置/上下线）
window.setInterval(() => {
  fetchState().catch(() => showToast('状态同步失败，请检查服务是否在线。'));
}, 8000);
