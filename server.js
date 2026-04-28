import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const assetsDir = path.join(publicDir, 'assets');
const dataDir = path.join(__dirname, 'data');
const stateFile = path.join(dataDir, 'state.json');

const port = Number.parseInt(process.env.PORT || '5173', 10);
const adminToken = process.env.ADMIN_TOKEN || 'bancun-admin';
const defaultWechatPayUrl =
  process.env.WECHAT_PAY_URL ||
  'weixin://wxpay/bizpayurl?pr=replace-with-your-wechat-code&amount={amount}&gift={giftName}';

// 礼物清单（id 不要乱改，会影响已点亮记录）
const gifts = [
  createGift('lollipop', '棒棒糖', 10, '普通礼物', '🍭', 392, ['E5', 'G5', 'C6']),
  createGift('tiramisu', '提拉米苏', 28, '普通礼物', '🍰', 330, ['E4', 'B4', 'E5']),
  createGift('confession-bouquet', '告白花束', 52, '普通礼物', '💐', 523, ['C5', 'E5', 'G5']),
  createGift('strawberry-cake', '草莓蛋糕', 88, '普通礼物', '🎂', 587, ['D5', 'A5', 'F5']),
  createGift('dreamcatcher', '捕梦网', 168, '普通礼物', '🪶', 294, ['D4', 'A4', 'D5']),
  createGift('hot-air-balloon', '热气球', 288, '普通礼物', '🎈', 440, ['A4', 'C5', 'E5']),
  createGift('bear-box', '小熊礼盒', 520, '普通礼物', '🎁', 659, ['E5', 'G5', 'B5']),
  createGift('ferrari', '法拉利', 888, '普通礼物', '🏎️', 196, ['G3', 'D4', 'G4']),
  createGift('diamond-ring', '永恒钻戒', 1314, '冠名礼物', '💍', 784, ['G5', 'B5', 'D6']),
  createGift('ferris-wheel', '摩天轮', 2888, '冠名礼物', '🎡', 494, ['B4', 'D5', 'F5']),
  createGift('cupid-arrow', '爱神之箭', 3344, '冠名礼物', '💘', 698, ['F5', 'A5', 'C6']),
  createGift('carousel', '旋转木马', 5200, '冠名礼物', '🎠', 740, ['F#5', 'A5', 'D6']),
  createGift('unicorn', '梦幻独角兽', 8888, '特殊礼物', '🦄', 880, ['A5', 'C6', 'E6'], '触发陪陪包天陪伴'),
  createGift('sweet-date', '甜蜜约会', 13140, '特殊礼物', '🧸', 622, ['D#5', 'G5', 'A#5'], '触发陪陪全天陪伴'),
  createGift('romantic-castle', '浪漫城堡', 28888, '特殊礼物', '🏰', 932, ['A#5', 'D6', 'F6'], '触发陪陪包月陪伴'),
  createGift('world-tour', '环游世界', 33440, '特殊礼物', '✈️', 1047, ['C6', 'E6', 'G6'], '触发陪陪全月陪伴')
];

const giftIds = new Set(gifts.map((gift) => gift.id));

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.ogg', 'audio/ogg']
]);

function createGift(id, name, price, category, emoji, frequency, notes, benefit = '') {
  return {
    id,
    name,
    price,
    category,
    emoji,
    benefit,
    image: `/assets/gifts/${id}.png`,
    sound: { id: `${id}-sound`, frequency, notes }
  };
}

const validCategories = new Set(['普通礼物', '冠名礼物', '特殊礼物']);

function defaultState() {
  return {
    brandName: '半寸时光',
    wechatPayUrl: defaultWechatPayUrl,
    wechatQrPath: '',
    litGiftIds: [],
    disabledGiftIds: [],
    giftOverrides: {},
    updatedAt: new Date().toISOString()
  };
}

function normalizeOverride(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  if (typeof raw.name === 'string') {
    const t = raw.name.trim();
    if (t) out.name = t.slice(0, 24);
  }
  if (raw.price !== undefined && raw.price !== null && raw.price !== '') {
    const p = Math.round(Number(raw.price));
    if (Number.isFinite(p) && p > 0 && p < 10_000_000) out.price = p;
  }
  if (typeof raw.category === 'string' && validCategories.has(raw.category)) {
    out.category = raw.category;
  }
  if (typeof raw.benefit === 'string') {
    out.benefit = raw.benefit.trim().slice(0, 60);
  }
  if (typeof raw.imagePath === 'string' && raw.imagePath.trim()) {
    out.imagePath = raw.imagePath.trim().slice(0, 200);
  }
  return out;
}

function normalizeState(value) {
  const fallback = defaultState();
  const rawLitIds = Array.isArray(value?.litGiftIds) ? value.litGiftIds : [];
  const rawDisabledIds = Array.isArray(value?.disabledGiftIds) ? value.disabledGiftIds : [];
  const rawOverrides = (value?.giftOverrides && typeof value.giftOverrides === 'object') ? value.giftOverrides : {};
  const overrides = {};
  for (const [k, v] of Object.entries(rawOverrides)) {
    if (giftIds.has(k)) {
      const norm = normalizeOverride(v);
      if (Object.keys(norm).length) overrides[k] = norm;
    }
  }

  return {
    brandName: normalizeText(value?.brandName, fallback.brandName, 24),
    wechatPayUrl: normalizeText(value?.wechatPayUrl, fallback.wechatPayUrl, 600),
    wechatQrPath: normalizeText(value?.wechatQrPath, '', 200),
    litGiftIds: [...new Set(rawLitIds.filter((id) => giftIds.has(id)))],
    disabledGiftIds: [...new Set(rawDisabledIds.filter((id) => giftIds.has(id)))],
    giftOverrides: overrides,
    updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : fallback.updatedAt
  };
}

function normalizeText(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

async function ensureStateFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    const content = await fs.readFile(stateFile, 'utf8');
    return normalizeState(JSON.parse(content));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`State file was unreadable, recreating it: ${error.message}`);
    }
    const state = defaultState();
    await writeState(state);
    return state;
  }
}

async function writeState(state) {
  const nextState = normalizeState({ ...state, updatedAt: new Date().toISOString() });
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(stateFile, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
  return nextState;
}

async function readRequestJson(request, maxBytes = 6_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawBody) return {};
  return JSON.parse(rawBody);
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify(body));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

function isAdminRequest(request) {
  const providedToken = request.headers['x-admin-token'];
  return typeof providedToken === 'string' && providedToken === adminToken;
}

function applyOverride(gift, override) {
  if (!override) return gift;
  return {
    ...gift,
    name: override.name ?? gift.name,
    price: override.price ?? gift.price,
    category: override.category ?? gift.category,
    benefit: override.benefit !== undefined ? override.benefit : gift.benefit,
    image: override.imagePath || gift.image
  };
}

function withFlags(state) {
  const disabled = new Set(state.disabledGiftIds);
  return gifts.map((gift) => {
    const merged = applyOverride(gift, state.giftOverrides?.[gift.id]);
    return { ...merged, enabled: !disabled.has(gift.id) };
  });
}

async function handleApi(request, response, pathname) {
  // 游客侧：只返回上线的礼物，且不暴露 disabledGiftIds 集合
  if (request.method === 'GET' && pathname === '/api/state') {
    const state = await ensureStateFile();
    const visibleGifts = withFlags(state).filter((gift) => gift.enabled);
    sendJson(response, 200, {
      brandName: state.brandName,
      wechatPayUrl: state.wechatPayUrl,
      wechatQrPath: state.wechatQrPath,
      litGiftIds: state.litGiftIds,
      updatedAt: state.updatedAt,
      gifts: visibleGifts
    });
    return;
  }

  // 管理端：完整状态 + 全量礼物（带 enabled 标记）
  if (request.method === 'GET' && pathname === '/api/admin/state') {
    if (!isAdminRequest(request)) {
      sendError(response, 401, 'Admin token is invalid.');
      return;
    }
    const state = await ensureStateFile();
    sendJson(response, 200, { ...state, gifts: withFlags(state) });
    return;
  }

  const lightMatch = pathname.match(/^\/api\/gifts\/([a-z0-9-]+)\/light$/);
  if (request.method === 'POST' && lightMatch) {
    const baseGift = gifts.find((item) => item.id === lightMatch[1]);
    if (!baseGift) {
      sendError(response, 404, 'Gift not found.');
      return;
    }
    const state = await ensureStateFile();
    if (state.disabledGiftIds.includes(baseGift.id)) {
      sendError(response, 410, '该礼物已下架。');
      return;
    }
    const gift = applyOverride(baseGift, state.giftOverrides?.[baseGift.id]);
    const body = await readRequestJson(request);
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount !== gift.price) {
      sendError(response, 400, '礼物金额与所选礼物不一致。');
      return;
    }

    const nextLitIds = new Set(state.litGiftIds);
    nextLitIds.add(gift.id);
    const nextState = await writeState({ ...state, litGiftIds: [...nextLitIds] });
    sendJson(response, 200, { ...nextState, gift });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/admin/settings') {
    if (!isAdminRequest(request)) {
      sendError(response, 401, 'Admin token is invalid.');
      return;
    }
    const body = await readRequestJson(request);
    const state = await ensureStateFile();
    const nextState = await writeState({
      ...state,
      brandName: normalizeText(body.brandName, state.brandName, 24),
      wechatPayUrl: normalizeText(body.wechatPayUrl, state.wechatPayUrl, 600)
    });
    sendJson(response, 200, nextState);
    return;
  }

  if (request.method === 'POST' && pathname === '/api/admin/reset') {
    if (!isAdminRequest(request)) {
      sendError(response, 401, 'Admin token is invalid.');
      return;
    }
    const state = await ensureStateFile();
    const nextState = await writeState({ ...state, litGiftIds: [] });
    sendJson(response, 200, nextState);
    return;
  }

  // 切换上下线
  const toggleMatch = pathname.match(/^\/api\/admin\/gifts\/([a-z0-9-]+)\/toggle$/);
  if (request.method === 'POST' && toggleMatch) {
    if (!isAdminRequest(request)) {
      sendError(response, 401, 'Admin token is invalid.');
      return;
    }
    const giftId = toggleMatch[1];
    if (!giftIds.has(giftId)) {
      sendError(response, 404, 'Gift not found.');
      return;
    }
    const body = await readRequestJson(request);
    const nextEnabled = Boolean(body.enabled);
    const state = await ensureStateFile();
    const disabled = new Set(state.disabledGiftIds);
    if (nextEnabled) disabled.delete(giftId);
    else disabled.add(giftId);
    const nextState = await writeState({ ...state, disabledGiftIds: [...disabled] });
    sendJson(response, 200, { ...nextState, gifts: withFlags(nextState) });
    return;
  }

  // 单条礼物更新（名称 / 价格 / 分类 / 福利文字）
  const editMatch = pathname.match(/^\/api\/admin\/gifts\/([a-z0-9-]+)$/);
  if (request.method === 'POST' && editMatch) {
    if (!isAdminRequest(request)) {
      sendError(response, 401, 'Admin token is invalid.');
      return;
    }
    const giftId = editMatch[1];
    if (!giftIds.has(giftId)) {
      sendError(response, 404, 'Gift not found.');
      return;
    }
    const body = await readRequestJson(request);
    const cleaned = normalizeOverride(body);

    const state = await ensureStateFile();
    const overrides = { ...(state.giftOverrides || {}) };

    // 与基线礼物对比，相同字段去掉，节省状态
    const base = gifts.find((g) => g.id === giftId);
    const next = {};
    if (cleaned.name && cleaned.name !== base.name) next.name = cleaned.name;
    if (cleaned.price && cleaned.price !== base.price) next.price = cleaned.price;
    if (cleaned.category && cleaned.category !== base.category) next.category = cleaned.category;
    if (cleaned.benefit !== undefined && cleaned.benefit !== base.benefit) next.benefit = cleaned.benefit;

    if (Object.keys(next).length) overrides[giftId] = next;
    else delete overrides[giftId];

    const nextState = await writeState({ ...state, giftOverrides: overrides });
    sendJson(response, 200, { ...nextState, gifts: withFlags(nextState) });
    return;
  }

  // 单条礼物图片上传（覆盖默认图）
  const giftImgMatch = pathname.match(/^\/api\/admin\/gifts\/([a-z0-9-]+)\/image$/);
  if (request.method === 'POST' && giftImgMatch) {
    if (!isAdminRequest(request)) {
      sendError(response, 401, 'Admin token is invalid.');
      return;
    }
    const giftId = giftImgMatch[1];
    if (!giftIds.has(giftId)) {
      sendError(response, 404, 'Gift not found.');
      return;
    }
    const body = await readRequestJson(request);
    const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
    const m = dataUrl.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i);
    if (!m) {
      sendError(response, 400, '请上传 PNG/JPG/WEBP/GIF 格式的图片。');
      return;
    }
    const ext = m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase();
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length === 0 || buf.length > 4_000_000) {
      sendError(response, 400, '单张图片大小需在 4MB 以内。');
      return;
    }
    const giftDir = path.join(assetsDir, 'gifts');
    await fs.mkdir(giftDir, { recursive: true });
    // 清掉同 id 的旧自定义文件
    for (const e of ['png', 'jpeg', 'webp', 'gif']) {
      try { await fs.unlink(path.join(giftDir, `custom-${giftId}.${e}`)); } catch {}
    }
    const fileName = `custom-${giftId}.${ext}`;
    await fs.writeFile(path.join(giftDir, fileName), buf);
    const imagePath = `/assets/gifts/${fileName}?v=${Date.now()}`;

    const state = await ensureStateFile();
    const overrides = { ...(state.giftOverrides || {}) };
    overrides[giftId] = { ...(overrides[giftId] || {}), imagePath };
    const nextState = await writeState({ ...state, giftOverrides: overrides });
    sendJson(response, 200, { ...nextState, gifts: withFlags(nextState) });
    return;
  }

  if (request.method === 'DELETE' && giftImgMatch) {
    if (!isAdminRequest(request)) {
      sendError(response, 401, 'Admin token is invalid.');
      return;
    }
    const giftId = giftImgMatch[1];
    if (!giftIds.has(giftId)) {
      sendError(response, 404, 'Gift not found.');
      return;
    }
    const giftDir = path.join(assetsDir, 'gifts');
    for (const e of ['png', 'jpeg', 'webp', 'gif']) {
      try { await fs.unlink(path.join(giftDir, `custom-${giftId}.${e}`)); } catch {}
    }
    const state = await ensureStateFile();
    const overrides = { ...(state.giftOverrides || {}) };
    if (overrides[giftId]) {
      const { imagePath: _drop, ...rest } = overrides[giftId];
      if (Object.keys(rest).length) overrides[giftId] = rest;
      else delete overrides[giftId];
    }
    const nextState = await writeState({ ...state, giftOverrides: overrides });
    sendJson(response, 200, { ...nextState, gifts: withFlags(nextState) });
    return;
  }

  // 重置单条 override（恢复默认）
  const resetGiftMatch = pathname.match(/^\/api\/admin\/gifts\/([a-z0-9-]+)\/reset$/);
  if (request.method === 'POST' && resetGiftMatch) {
    if (!isAdminRequest(request)) {
      sendError(response, 401, 'Admin token is invalid.');
      return;
    }
    const giftId = resetGiftMatch[1];
    if (!giftIds.has(giftId)) {
      sendError(response, 404, 'Gift not found.');
      return;
    }
    // 清掉自定义图片文件
    const giftDir = path.join(assetsDir, 'gifts');
    for (const e of ['png', 'jpeg', 'webp', 'gif']) {
      try { await fs.unlink(path.join(giftDir, `custom-${giftId}.${e}`)); } catch {}
    }
    const state = await ensureStateFile();
    const overrides = { ...(state.giftOverrides || {}) };
    delete overrides[giftId];
    const nextState = await writeState({ ...state, giftOverrides: overrides });
    sendJson(response, 200, { ...nextState, gifts: withFlags(nextState) });
    return;
  }

  // 上传微信收款码
  if (request.method === 'POST' && pathname === '/api/admin/wechat-qr') {
    if (!isAdminRequest(request)) {
      sendError(response, 401, 'Admin token is invalid.');
      return;
    }
    const body = await readRequestJson(request);
    const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
    const match = dataUrl.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
    if (!match) {
      sendError(response, 400, '请上传 PNG/JPG/WEBP 格式的图片。');
      return;
    }
    const ext = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0 || buffer.length > 4_000_000) {
      sendError(response, 400, '图片大小需在 4MB 以内。');
      return;
    }
    await fs.mkdir(assetsDir, { recursive: true });
    // 旧文件清理
    for (const e of ['png', 'jpeg', 'webp']) {
      try { await fs.unlink(path.join(assetsDir, `wechat-qr.${e}`)); } catch {}
    }
    const fileName = `wechat-qr.${ext}`;
    await fs.writeFile(path.join(assetsDir, fileName), buffer);
    const wechatQrPath = `/assets/${fileName}?v=${Date.now()}`;
    const state = await ensureStateFile();
    const nextState = await writeState({ ...state, wechatQrPath });
    sendJson(response, 200, nextState);
    return;
  }

  if (request.method === 'DELETE' && pathname === '/api/admin/wechat-qr') {
    if (!isAdminRequest(request)) {
      sendError(response, 401, 'Admin token is invalid.');
      return;
    }
    for (const e of ['png', 'jpeg', 'webp']) {
      try { await fs.unlink(path.join(assetsDir, `wechat-qr.${e}`)); } catch {}
    }
    const state = await ensureStateFile();
    const nextState = await writeState({ ...state, wechatQrPath: '' });
    sendJson(response, 200, nextState);
    return;
  }

  sendError(response, 404, 'API route not found.');
}

async function serveStatic(response, pathname) {
  const normalizedPath =
    pathname === '/' ? '/index.html' : pathname === '/admin' ? '/admin.html' : pathname;
  const decodedPath = decodeURIComponent(normalizedPath);
  const safePath = path.normalize(decodedPath).replace(/^([/\\])+/, '');
  const filePath = path.join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }
  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'content-type': mimeTypes.get(extension) || 'application/octet-stream'
    });
    response.end(file);
  } catch (error) {
    if (error.code === 'ENOENT') {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url.pathname);
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendError(response, 405, 'Method not allowed.');
      return;
    }
    // 去掉 ?v=xxx 这种查询串
    await serveStatic(response, url.pathname);
  } catch (error) {
    console.error(error);
    sendError(response, 500, 'Unexpected server error.');
  }
});

await ensureStateFile();

server.listen(port, () => {
  console.log(`半寸时光礼物单已启动：http://localhost:${port}`);
  console.log(`后台地址：http://localhost:${port}/admin，默认后台口令：${adminToken}`);
});
