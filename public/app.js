import { audioEngine } from './audio.js';

const normalGiftGrid = document.querySelector('#normalGiftGrid');
const specialGiftGrid = document.querySelector('#specialGiftGrid');
const brandName = document.querySelector('#brandName');
const amountInput = document.querySelector('#amountInput');
const matchHint = document.querySelector('#matchHint');
const payButton = document.querySelector('#payButton');
const musicToggle = document.querySelector('#musicToggle');
const toast = document.querySelector('#toast');

let appState = {
  brandName: '半寸时光',
  wechatPayUrl: '',
  backgroundMusicUrl: '',
  litGiftIds: [],
  gifts: []
};

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 0
});

async function fetchState() {
  const response = await fetch('/api/state', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('无法读取礼物单状态。');
  }

  appState = await response.json();
  render();
}

function render() {
  brandName.textContent = appState.brandName;
  document.title = `${appState.brandName}甜蜜礼物单`;

  renderGiftGrid(normalGiftGrid, appState.gifts.filter((gift) => gift.category === '普通礼物'));
  renderGiftGrid(specialGiftGrid, appState.gifts.filter((gift) => gift.category === '特殊礼物'));
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
      showToast(`已选择 ${gift.name}，点击支付后点亮。`);
    });

    container.append(button);
  });
}

function updateMatchHint() {
  const gift = findGiftByAmount(amountInput.value);
  if (!amountInput.value.trim()) {
    matchHint.textContent = '输入金额后会自动匹配对应礼物。';
    matchHint.classList.remove('is-ok', 'is-error');
    return;
  }

  if (!gift) {
    matchHint.textContent = '暂无匹配礼物，请输入礼物单上的金额。';
    matchHint.classList.add('is-error');
    matchHint.classList.remove('is-ok');
    return;
  }

  matchHint.textContent = `已匹配：${gift.name}（￥${gift.price}），支付后将自动点亮并播放专属音效。`;
  matchHint.classList.add('is-ok');
  matchHint.classList.remove('is-error');
}

function findGiftByAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return null;
  }

  return appState.gifts.find((gift) => gift.price === amount) || null;
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
    const body = await response.json();
    throw new Error(body.error || '点亮礼物失败。');
  }

  await audioEngine.playGift(gift.sound);
  await fetchState();
}

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

  const wechatUrl = buildWechatUrl(gift);
  const paymentWindow = window.open(wechatUrl, '_blank');

  try {
    await lightGift(gift);
    showToast(`${gift.name} 已点亮，正在跳转微信收款。`);
  } catch (error) {
    if (paymentWindow && !paymentWindow.closed) {
      paymentWindow.close();
    }
    showToast(error.message);
  }
});

musicToggle.addEventListener('click', async () => {
  try {
    const enabled = await audioEngine.toggleBgm(appState.backgroundMusicUrl);
    musicToggle.setAttribute('aria-label', enabled ? '关闭背景音乐' : '开启背景音乐');
    musicToggle.setAttribute('aria-pressed', String(enabled));
    musicToggle.querySelector('span').textContent = enabled ? '🔊' : '🔇';
    musicToggle.classList.toggle('is-active', enabled);
  } catch (error) {
    showToast('当前浏览器暂不支持 WebAudio。');
  }
});

fetchState().catch((error) => {
  showToast(error.message);
});

window.setInterval(() => {
  fetchState().catch(() => {
    showToast('状态同步失败，请检查服务是否在线。');
  });
}, 8000);
