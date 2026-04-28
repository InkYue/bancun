const adminBrandName = document.querySelector('#adminBrandName');
const adminTokenInput = document.querySelector('#adminToken');
const brandInput = document.querySelector('#brandInput');
const payUrlInput = document.querySelector('#payUrlInput');
const saveAdminButton = document.querySelector('#saveAdminButton');
const resetButton = document.querySelector('#resetButton');
const toast = document.querySelector('#toast');

let appState = {
  brandName: '半寸时光',
  wechatPayUrl: '',
  litGiftIds: []
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
        wechatPayUrl: payUrlInput.value
      })
    });

    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error || '保存失败。');
    }

    await fetchState();
    showToast('后台设置已保存。');
  } catch (error) {
    showToast(error.message);
  }
});

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
