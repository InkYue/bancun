const adminBrandName = document.querySelector('#adminBrandName');
const adminTokenInput = document.querySelector('#adminToken');
const brandInput = document.querySelector('#brandInput');
const payUrlInput = document.querySelector('#payUrlInput');
const backgroundMusicInput = document.querySelector('#backgroundMusicInput');
const saveAdminButton = document.querySelector('#saveAdminButton');
const resetButton = document.querySelector('#resetButton');
const giftEditorList = document.querySelector('#giftEditorList');
const toast = document.querySelector('#toast');

let appState = {
  brandName: '半寸时光',
  wechatPayUrl: '',
  backgroundMusicUrl: '',
  litGiftIds: [],
  gifts: []
};

async function fetchState() {
  const response = await fetch('/api/state', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('无法读取后台状态。');
  }

  appState = await response.json();
  render();
}

function render() {
  adminBrandName.textContent = appState.brandName;
  document.title = `${appState.brandName}后台管理`;
  brandInput.value = appState.brandName;
  payUrlInput.value = appState.wechatPayUrl;
  renderGiftEditors();
}

function renderGiftEditors() {
  giftEditorList.replaceChildren();

  appState.gifts.forEach((gift) => {
    const card = document.createElement('article');
    card.className = 'gift-editor-card';
    card.dataset.giftId = gift.id;

    const preview = document.createElement('img');
    preview.className = 'gift-editor-preview';
    preview.src = gift.image;
    preview.alt = gift.name;

    const fallback = document.createElement('span');
    fallback.className = 'gift-editor-emoji';
    fallback.textContent = gift.emoji;
    fallback.hidden = true;
    preview.addEventListener('error', () => {
      preview.hidden = true;
      fallback.hidden = false;
    });

    const title = document.createElement('div');
    title.className = 'gift-editor-title';
    const titleName = document.createElement('strong');
    titleName.textContent = gift.name;
    const titleMeta = document.createElement('span');
    titleMeta.textContent = `￥${gift.price} · ${gift.category}`;
    title.append(titleName, titleMeta);

    const nameLabel = document.createElement('label');
    nameLabel.innerHTML = '<span>商品名称</span>';
    const nameInput = document.createElement('input');
    nameInput.name = 'giftName';
    nameInput.maxLength = 24;
    nameInput.value = gift.name;
    nameLabel.append(nameInput);

    const imageLabel = document.createElement('label');
    imageLabel.innerHTML = '<span>商品图片</span>';
    const imageInput = document.createElement('input');
    imageInput.name = 'giftImage';
    imageInput.type = 'file';
    imageInput.accept = 'image/png,image/jpeg,image/webp,image/svg+xml';
    imageLabel.append(imageInput);

    const musicLabel = document.createElement('label');
    musicLabel.innerHTML = '<span>礼物音乐</span>';
    const musicInput = document.createElement('input');
    musicInput.name = 'giftMusic';
    musicInput.type = 'file';
    musicInput.accept = 'audio/mpeg,audio/mp3,audio/wav,audio/ogg';
    musicLabel.append(musicInput);

    const status = document.createElement('p');
    status.className = 'gift-editor-status';
    status.textContent = gift.music ? '已设置自定义音乐' : '未设置自定义音乐，将使用默认音效';

    const saveButton = document.createElement('button');
    saveButton.className = 'primary-button';
    saveButton.type = 'button';
    saveButton.textContent = '保存该商品';
    saveButton.addEventListener('click', () => saveGift(gift.id, card));

    const fields = document.createElement('div');
    fields.className = 'gift-editor-fields';
    fields.append(nameLabel, imageLabel, musicLabel, status, saveButton);

    const media = document.createElement('div');
    media.className = 'gift-editor-media';
    media.append(preview, fallback);

    card.append(media, title, fields);
    giftEditorList.append(card);
  });
}

async function fileToDataUrl(file) {
  if (!file) {
    return '';
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')));
    reader.addEventListener('error', () => reject(new Error('文件读取失败。')));
    reader.readAsDataURL(file);
  });
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

saveAdminButton.addEventListener('click', async () => {
  try {
    const response = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminTokenInput.value.trim()
      },
      body: JSON.stringify({
        brandName: brandInput.value,
        wechatPayUrl: payUrlInput.value,
        backgroundMusicUrl: appState.backgroundMusicUrl,
        backgroundMusicDataUrl: await fileToDataUrl(backgroundMusicInput.files[0])
      })
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error || '保存失败。');
    }

    await fetchState();
    backgroundMusicInput.value = '';
    showToast('后台设置已保存。');
  } catch (error) {
    showToast(error.message);
  }
});

async function saveGift(giftId, card) {
  try {
    const nameInput = card.querySelector('input[name="giftName"]');
    const imageInput = card.querySelector('input[name="giftImage"]');
    const musicInput = card.querySelector('input[name="giftMusic"]');
    const response = await fetch(`/api/admin/gifts/${giftId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminTokenInput.value.trim()
      },
      body: JSON.stringify({
        name: nameInput.value,
        imageDataUrl: await fileToDataUrl(imageInput.files[0]),
        musicDataUrl: await fileToDataUrl(musicInput.files[0])
      })
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error || '商品保存失败。');
    }

    await fetchState();
    showToast('商品自定义已保存。');
  } catch (error) {
    showToast(error.message);
  }
}

resetButton.addEventListener('click', async () => {
  try {
    const response = await fetch('/api/admin/reset', {
      method: 'POST',
      headers: { 'x-admin-token': adminTokenInput.value.trim() }
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error || '重置失败。');
    }

    await fetchState();
    showToast('全部礼物已恢复暗态。');
  } catch (error) {
    showToast(error.message);
  }
});

fetchState().catch((error) => {
  showToast(error.message);
});
