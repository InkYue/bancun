const $ = (sel) => document.querySelector(sel);

const adminBrandName = $('#adminBrandName');
const adminTokenInput = $('#adminToken');
const brandInput = $('#brandInput');
const payUrlInput = $('#payUrlInput');
const loadAdminButton = $('#loadAdminButton');
const saveAdminButton = $('#saveAdminButton');
const resetButton = $('#resetButton');

const qrPreview = $('#qrPreview');
const qrPreviewWrap = qrPreview.parentElement;
const qrPlaceholder = $('#qrPlaceholder');
const qrInput = $('#qrInput');
const qrRemoveButton = $('#qrRemoveButton');

const giftListEl = $('#giftList');
const toast = $('#toast');

const TOKEN_STORAGE_KEY = 'bancun-admin-token';

let appState = {
  brandName: '半寸时光',
  wechatPayUrl: '',
  wechatQrPath: '',
  litGiftIds: [],
  disabledGiftIds: [],
  gifts: []
};

/* ---------- token 持久化（localStorage） ---------- */
try {
  const saved = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (saved) adminTokenInput.value = saved;
} catch {}
adminTokenInput.addEventListener('change', () => {
  try { localStorage.setItem(TOKEN_STORAGE_KEY, adminTokenInput.value.trim()); } catch {}
});

function token() {
  return adminTokenInput.value.trim();
}

function authHeaders(extra = {}) {
  return { 'x-admin-token': token(), ...extra };
}

/* ---------- toast ---------- */
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
}
showToast.timer = 0;

/* ---------- 状态读取 ---------- */
async function fetchPublicState() {
  const response = await fetch('/api/state', { cache: 'no-store' });
  if (!response.ok) throw new Error('无法读取礼物状态。');
  const data = await response.json();
  // 公共接口拿到的 gifts 已经过滤掉下架，没有 disabledGiftIds
  appState.brandName = data.brandName;
  appState.wechatPayUrl = data.wechatPayUrl;
  appState.wechatQrPath = data.wechatQrPath || '';
  appState.litGiftIds = data.litGiftIds || [];
  // 不覆盖 gifts，等管理员鉴权读取
}

async function fetchAdminState() {
  const response = await fetch('/api/admin/state', {
    cache: 'no-store',
    headers: authHeaders()
  });
  if (response.status === 401) throw new Error('后台口令无效，请检查口令。');
  if (!response.ok) throw new Error('读取后台数据失败。');
  appState = await response.json();
  render();
}

/* ---------- 渲染 ---------- */
function render() {
  adminBrandName.textContent = appState.brandName || '半寸时光';
  document.title = `${appState.brandName || '半寸时光'}后台管理`;
  brandInput.value = appState.brandName || '';
  payUrlInput.value = appState.wechatPayUrl || '';
  renderQrPreview();
  renderGiftList();
}

function renderQrPreview() {
  if (appState.wechatQrPath) {
    qrPreview.src = appState.wechatQrPath;
    qrPreviewWrap.classList.add('is-loaded');
    qrPlaceholder.hidden = true;
  } else {
    qrPreview.removeAttribute('src');
    qrPreviewWrap.classList.remove('is-loaded');
    qrPlaceholder.hidden = false;
  }
}

const CATEGORIES = ['普通礼物', '冠名礼物', '特殊礼物'];
const expandedRows = new Set();

function renderGiftList() {
  giftListEl.replaceChildren();
  if (!appState.gifts || appState.gifts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'admin-tip';
    empty.textContent = '请先填入后台口令并点击"读取后台数据"。';
    giftListEl.append(empty);
    return;
  }

  // 按分类分组
  const groups = new Map(CATEGORIES.map((c) => [c, []]));
  for (const gift of appState.gifts) {
    if (groups.has(gift.category)) groups.get(gift.category).push(gift);
    else (groups.get('普通礼物') || []).push(gift);
  }

  for (const cat of CATEGORIES) {
    const list = groups.get(cat);
    if (!list || !list.length) continue;
    const header = document.createElement('div');
    header.className = 'gift-group-header';
    header.innerHTML = `<span class="butterfly">✦</span> ${cat} <span class="butterfly">✦</span>`;
    giftListEl.append(header);

    list.forEach((gift) => giftListEl.append(buildGiftRow(gift)));
  }
}

function buildGiftRow(gift) {
  const row = document.createElement('div');
  row.className = `gift-row ${gift.enabled ? '' : 'is-disabled'} ${expandedRows.has(gift.id) ? 'is-open' : ''}`;
  row.dataset.giftId = gift.id;

  // 头部：缩略图 + 名称价格 + 开关
  const head = document.createElement('div');
  head.className = 'gift-row-head';

  const thumb = document.createElement('div');
  thumb.className = 'gift-row-thumb';
  const img = document.createElement('img');
  img.src = gift.image;
  img.alt = gift.name;
  img.loading = 'lazy';
  const fallback = document.createElement('span');
  fallback.className = 'gift-row-emoji';
  fallback.textContent = gift.emoji;
  fallback.hidden = true;
  img.addEventListener('error', () => { img.remove(); fallback.hidden = false; });
  thumb.append(img, fallback);

  const meta = document.createElement('div');
  meta.className = 'gift-row-meta-wrap';
  const name = document.createElement('div');
  name.className = 'gift-row-name';
  name.textContent = `${gift.name} · ¥${gift.price}`;
  const sub = document.createElement('div');
  sub.className = 'gift-row-meta';
  sub.textContent = gift.category + (gift.benefit ? ` · ${gift.benefit}` : '');
  meta.append(name, sub);

  const switchLabel = document.createElement('label');
  switchLabel.className = 'switch';
  switchLabel.title = gift.enabled ? '已上线（点击下架）' : '已下架（点击上线）';
  switchLabel.addEventListener('click', (e) => e.stopPropagation());
  const cbx = document.createElement('input');
  cbx.type = 'checkbox';
  cbx.checked = gift.enabled;
  cbx.addEventListener('change', () => toggleGift(gift, cbx));
  const slider = document.createElement('span');
  slider.className = 'slider';
  switchLabel.append(cbx, slider);

  const expandIcon = document.createElement('span');
  expandIcon.className = 'gift-row-expand';
  expandIcon.setAttribute('aria-hidden', 'true');
  expandIcon.textContent = '▾';

  head.append(thumb, meta, switchLabel, expandIcon);
  head.addEventListener('click', () => {
    if (expandedRows.has(gift.id)) expandedRows.delete(gift.id);
    else expandedRows.add(gift.id);
    row.classList.toggle('is-open');
  });

  // 编辑面板
  const editor = document.createElement('div');
  editor.className = 'gift-row-editor';
  editor.innerHTML = `
    <div class="editor-image">
      <div class="editor-image-preview">
        <img src="${escapeAttr(gift.image)}" alt="${escapeAttr(gift.name)}">
      </div>
      <div class="editor-image-actions">
        <label class="ghost-button file-button" title="支持 PNG / JPG / WEBP / GIF，4MB 以内">
          替换图片
          <input data-field="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
        </label>
        <button type="button" class="ghost-button" data-action="reset-image" title="清除自定义图，恢复默认切图">清除自定义图</button>
      </div>
    </div>
    <div class="editor-grid">
      <label><span>名称</span><input data-field="name" type="text" maxlength="24" value="${escapeAttr(gift.name)}"></label>
      <label><span>价格 (¥)</span><input data-field="price" type="number" inputmode="numeric" min="1" step="1" value="${gift.price}"></label>
      <label><span>分类</span><select data-field="category">
        ${CATEGORIES.map((c) => `<option value="${c}" ${c === gift.category ? 'selected' : ''}>${c}</option>`).join('')}
      </select></label>
      <label class="wide-field"><span>福利文字（可选，仅展示）</span><input data-field="benefit" type="text" maxlength="60" value="${escapeAttr(gift.benefit || '')}" placeholder="例如：触发陪陪包天陪伴"></label>
    </div>
    <div class="editor-actions">
      <button type="button" class="ghost-button" data-action="reset">恢复默认</button>
      <button type="button" class="primary-button" data-action="save">保存修改</button>
    </div>
  `;

  editor.addEventListener('click', (e) => e.stopPropagation());
  editor.querySelector('[data-action="save"]').addEventListener('click', async () => {
    const data = {
      name: editor.querySelector('[data-field="name"]').value,
      price: editor.querySelector('[data-field="price"]').value,
      category: editor.querySelector('[data-field="category"]').value,
      benefit: editor.querySelector('[data-field="benefit"]').value
    };
    await saveGift(gift.id, data);
  });
  editor.querySelector('[data-action="reset"]').addEventListener('click', async () => {
    if (!confirm(`确认把 ${gift.name} 恢复为默认值（图片、名称、价格、分类、福利全部恢复）？`)) return;
    await resetGift(gift.id);
  });

  const fileInput = editor.querySelector('[data-field="imageFile"]');
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 4_000_000) { showToast('图片大小需在 4MB 以内。'); return; }
    try {
      const dataUrl = await fileToDataUrl(file);
      const response = await fetch(`/api/admin/gifts/${gift.id}/image`, {
        method: 'POST',
        headers: authHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({ dataUrl })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || '上传失败。');
      }
      appState = await response.json();
      // 维持当前展开的状态
      expandedRows.add(gift.id);
      render();
      showToast(`${gift.name} 的图片已替换。`);
    } catch (err) {
      showToast(err.message || '上传失败。');
    }
  });

  editor.querySelector('[data-action="reset-image"]').addEventListener('click', async () => {
    if (!confirm(`确认清除 ${gift.name} 的自定义图，恢复默认切图？`)) return;
    try {
      const response = await fetch(`/api/admin/gifts/${gift.id}/image`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || '清除失败。');
      }
      appState = await response.json();
      expandedRows.add(gift.id);
      render();
      showToast(`${gift.name} 已恢复默认图。`);
    } catch (err) {
      showToast(err.message || '清除失败。');
    }
  });

  row.append(head, editor);
  return row;
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function saveGift(id, data) {
  try {
    const response = await fetch(`/api/admin/gifts/${id}`, {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || '保存失败。');
    }
    appState = await response.json();
    render();
    showToast('已保存修改。');
  } catch (err) {
    showToast(err.message);
  }
}

async function resetGift(id) {
  try {
    const response = await fetch(`/api/admin/gifts/${id}/reset`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || '恢复失败。');
    }
    appState = await response.json();
    render();
    showToast('已恢复为默认。');
  } catch (err) {
    showToast(err.message);
  }
}

/* ---------- 上下线 ---------- */
async function toggleGift(gift, cbx) {
  const nextEnabled = cbx.checked;
  cbx.disabled = true;
  try {
    const response = await fetch(`/api/admin/gifts/${gift.id}/toggle`, {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ enabled: nextEnabled })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || '操作失败。');
    }
    appState = await response.json();
    render();
    showToast(`${gift.name} 已${nextEnabled ? '上线' : '下架'}`);
  } catch (err) {
    cbx.checked = !nextEnabled; // 回滚
    showToast(err.message);
  } finally {
    cbx.disabled = false;
  }
}

/* ---------- 名称 / 链接保存 ---------- */
saveAdminButton.addEventListener('click', async () => {
  try {
    const response = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        brandName: brandInput.value,
        wechatPayUrl: payUrlInput.value
      })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || '保存失败。');
    }
    const data = await response.json();
    appState = { ...appState, ...data };
    render();
    showToast('已保存名称 / 跳转链接。');
  } catch (error) {
    showToast(error.message);
  }
});

/* ---------- 重置 ---------- */
resetButton.addEventListener('click', async () => {
  if (!confirm('确认把所有礼物图标重置为暗态吗？')) return;
  try {
    const response = await fetch('/api/admin/reset', {
      method: 'POST',
      headers: authHeaders()
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || '重置失败。');
    }
    const data = await response.json();
    appState = { ...appState, ...data };
    render();
    showToast('全部礼物已恢复暗态。');
  } catch (error) {
    showToast(error.message);
  }
});

/* ---------- 收款码上传 ---------- */
qrInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > 4_000_000) {
    showToast('图片大小需在 4MB 以内。');
    return;
  }
  try {
    const dataUrl = await fileToDataUrl(file);
    const response = await fetch('/api/admin/wechat-qr', {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ dataUrl })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || '上传失败。');
    }
    const data = await response.json();
    appState = { ...appState, ...data };
    render();
    showToast('收款码已上传。');
  } catch (err) {
    showToast(err.message || '上传失败。');
  }
});

qrRemoveButton.addEventListener('click', async () => {
  if (!appState.wechatQrPath) return;
  if (!confirm('确认移除当前收款码？移除后将回退到跳转链接。')) return;
  try {
    const response = await fetch('/api/admin/wechat-qr', {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || '移除失败。');
    }
    const data = await response.json();
    appState = { ...appState, ...data };
    render();
    showToast('收款码已移除。');
  } catch (err) {
    showToast(err.message || '移除失败。');
  }
});

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取文件失败。'));
    reader.readAsDataURL(file);
  });
}

/* ---------- 入口 ---------- */
loadAdminButton.addEventListener('click', () => {
  if (!token()) {
    showToast('请先输入后台口令。');
    return;
  }
  fetchAdminState().catch((err) => showToast(err.message));
});

// 启动时先用公共接口读基本信息（不需要鉴权），让品牌名 / 收款码缩略图先显出来
fetchPublicState()
  .then(render)
  .catch(() => render());

// 如果浏览器记住了口令，自动尝试拉一次后台数据
if (token()) {
  fetchAdminState().catch(() => {/* 静默；用户点击按钮时再提示错误 */});
}
