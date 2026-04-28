import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const dataDir = path.join(__dirname, 'data');
const stateFile = path.join(dataDir, 'state.json');
const uploadDir = path.join(publicDir, 'uploads');
const giftUploadDir = path.join(uploadDir, 'gifts');
const audioUploadDir = path.join(uploadDir, 'audio');

const port = Number.parseInt(process.env.PORT || '5173', 10);
const adminToken = process.env.ADMIN_TOKEN || 'bancun-admin';
const defaultWechatPayUrl =
  process.env.WECHAT_PAY_URL ||
  'weixin://wxpay/bizpayurl?pr=replace-with-your-wechat-code&amount={amount}&gift={giftName}';

const gifts = [
  createGift('lollipop', '棒棒糖', 10, '普通礼物', '🍭', 392, ['E5', 'G5', 'C6']),
  createGift('tiramisu', '提拉米苏', 28, '普通礼物', '🍰', 330, ['E4', 'B4', 'E5']),
  createGift('confession-bouquet', '告白花束', 52, '普通礼物', '💐', 523, ['C5', 'E5', 'G5']),
  createGift('strawberry-cake', '草莓蛋糕', 88, '普通礼物', '🎂', 587, ['D5', 'A5', 'F5']),
  createGift('dreamcatcher', '捕梦网', 168, '普通礼物', '🪶', 294, ['D4', 'A4', 'D5']),
  createGift('hot-air-balloon', '热气球', 288, '普通礼物', '🎈', 440, ['A4', 'C5', 'E5']),
  createGift('bear-box', '小熊礼盒', 520, '普通礼物', '🎁', 659, ['E5', 'G5', 'B5']),
  createGift('ferrari', '法拉利', 888, '普通礼物', '🏎️', 196, ['G3', 'D4', 'G4']),
  createGift('diamond-ring', '永恒钻戒', 1314, '普通礼物', '💍', 784, ['G5', 'B5', 'D6'], '赠送以上4项任一礼物，即可获得专属冠名卡一张'),
  createGift('ferris-wheel', '摩天轮', 2888, '普通礼物', '🎡', 494, ['B4', 'D5', 'F5'], '赠送以上4项任一礼物，即可获得专属冠名卡一张'),
  createGift('cupid-arrow', '爱神之箭', 3344, '普通礼物', '💘', 698, ['F5', 'A5', 'C6'], '赠送以上4项任一礼物，即可获得专属冠名卡一张'),
  createGift('carousel', '旋转木马', 5200, '普通礼物', '🎠', 740, ['F#5', 'A5', 'D6'], '赠送以上4项任一礼物，即可获得专属冠名卡一张'),
  createGift('unicorn', '梦幻独角兽', 8888, '特殊礼物', '🦄', 880, ['A5', 'C6', 'E6'], '触发陪伴包天陪伴'),
  createGift('sweet-date', '甜蜜约会', 13140, '特殊礼物', '🧸', 622, ['D#5', 'G5', 'A#5'], '触发陪伴全天陪伴'),
  createGift('romantic-castle', '浪漫城堡', 28888, '特殊礼物', '🏰', 932, ['A#5', 'D6', 'F6'], '触发陪伴包月陪伴'),
  createGift('world-tour', '环游世界', 33440, '特殊礼物', '✈️', 1047, ['C6', 'E6', 'G6'], '触发陪伴全月陪伴')
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
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.ogg', 'audio/ogg']
]);

const imageMimeExtensions = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/svg+xml', '.svg']
]);

const audioMimeExtensions = new Map([
  ['audio/mpeg', '.mp3'],
  ['audio/mp3', '.mp3'],
  ['audio/wav', '.wav'],
  ['audio/x-wav', '.wav'],
  ['audio/ogg', '.ogg']
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
    sound: {
      id: `${id}-sound`,
      frequency,
      notes
    }
  };
}

function defaultState() {
  return {
    brandName: '半寸时光',
    wechatPayUrl: defaultWechatPayUrl,
    backgroundMusicUrl: '',
    giftOverrides: {},
    litGiftIds: [],
    updatedAt: new Date().toISOString()
  };
}

function normalizeState(value) {
  const fallback = defaultState();
  const rawLitIds = Array.isArray(value?.litGiftIds) ? value.litGiftIds : [];

  return {
    brandName: normalizeText(value?.brandName, fallback.brandName, 24),
    wechatPayUrl: normalizeText(value?.wechatPayUrl, fallback.wechatPayUrl, 600),
    backgroundMusicUrl: normalizeOptionalUrl(value?.backgroundMusicUrl, 600),
    giftOverrides: normalizeGiftOverrides(value?.giftOverrides),
    litGiftIds: [...new Set(rawLitIds.filter((id) => giftIds.has(id)))],
    updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : fallback.updatedAt
  };
}

function normalizeText(value, fallback, maxLength) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeOptionalText(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function normalizeOptionalUrl(value, maxLength) {
  const text = normalizeOptionalText(value, maxLength);
  if (!text) {
    return '';
  }

  if (text.startsWith('/assets/') || text.startsWith('/uploads/') || text.startsWith('http://') || text.startsWith('https://')) {
    return text;
  }

  return '';
}

function normalizeGiftOverrides(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const overrides = {};
  gifts.forEach((gift) => {
    const raw = value[gift.id];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return;
    }

    const name = normalizeOptionalText(raw.name, 24);
    const image = normalizeOptionalUrl(raw.image, 600);
    const music = normalizeOptionalUrl(raw.music, 600);
    if (name || image || music) {
      overrides[gift.id] = { name, image, music };
    }
  });

  return overrides;
}

function mergeGifts(state) {
  return gifts.map((gift) => {
    const override = state.giftOverrides[gift.id] || {};
    const customMusic = override.music ? { ...gift.sound, url: override.music } : gift.sound;
    return {
      ...gift,
      name: override.name || gift.name,
      image: override.image || gift.image,
      music: override.music || '',
      sound: customMusic
    };
  });
}

async function saveDataUrl(dataUrl, options) {
  if (typeof dataUrl !== 'string' || !dataUrl.trim()) {
    return '';
  }

  const match = dataUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error(`${options.label}文件格式不正确。`);
  }

  const mimeType = match[1].toLowerCase();
  const extension = options.allowedTypes.get(mimeType);
  if (!extension) {
    throw new Error(`${options.label}仅支持：${[...options.allowedTypes.keys()].join('、')}。`);
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > options.maxBytes) {
    throw new Error(`${options.label}不能超过 ${Math.round(options.maxBytes / 1024 / 1024)}MB。`);
  }

  await fs.mkdir(options.directory, { recursive: true });
  const fileName = `${options.prefix}-${Date.now()}${extension}`;
  await fs.writeFile(path.join(options.directory, fileName), buffer);
  return `${options.publicPath}/${fileName}`;
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
  const nextState = normalizeState({
    ...state,
    updatedAt: new Date().toISOString()
  });
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(stateFile, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
  return nextState;
}

async function readRequestJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_000_000) {
      throw new Error('Request body is too large.');
    }
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawBody) {
    return {};
  }

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

async function handleApi(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/state') {
    const state = await ensureStateFile();
    sendJson(response, 200, { ...state, gifts: mergeGifts(state) });
    return;
  }

  const lightMatch = pathname.match(/^\/api\/gifts\/([a-z0-9-]+)\/light$/);
  if (request.method === 'POST' && lightMatch) {
    const gift = gifts.find((item) => item.id === lightMatch[1]);
    if (!gift) {
      sendError(response, 404, 'Gift not found.');
      return;
    }

    const body = await readRequestJson(request);
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount !== gift.price) {
      sendError(response, 400, 'Gift amount does not match the selected gift.');
      return;
    }

    const state = await ensureStateFile();
    const nextLitIds = new Set(state.litGiftIds);
    nextLitIds.add(gift.id);
    const nextState = await writeState({ ...state, litGiftIds: [...nextLitIds] });
    sendJson(response, 200, { ...nextState, gifts: mergeGifts(nextState), gift: mergeGifts(nextState).find((item) => item.id === gift.id) });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/admin/settings') {
    if (!isAdminRequest(request)) {
      sendError(response, 401, 'Admin token is invalid.');
      return;
    }

    const body = await readRequestJson(request);
    const state = await ensureStateFile();
    const backgroundMusicUpload = await saveDataUrl(body.backgroundMusicDataUrl, {
      label: '背景音乐',
      allowedTypes: audioMimeExtensions,
      maxBytes: 8_000_000,
      directory: audioUploadDir,
      publicPath: '/uploads/audio',
      prefix: 'bgm'
    });
    const nextState = await writeState({
      ...state,
      brandName: normalizeText(body.brandName, state.brandName, 24),
      wechatPayUrl: normalizeText(body.wechatPayUrl, state.wechatPayUrl, 600),
      backgroundMusicUrl: backgroundMusicUpload || normalizeOptionalUrl(body.backgroundMusicUrl, 600)
    });
    sendJson(response, 200, { ...nextState, gifts: mergeGifts(nextState) });
    return;
  }

  const adminGiftMatch = pathname.match(/^\/api\/admin\/gifts\/([a-z0-9-]+)$/);
  if (request.method === 'POST' && adminGiftMatch) {
    if (!isAdminRequest(request)) {
      sendError(response, 401, 'Admin token is invalid.');
      return;
    }

    const gift = gifts.find((item) => item.id === adminGiftMatch[1]);
    if (!gift) {
      sendError(response, 404, 'Gift not found.');
      return;
    }

    const body = await readRequestJson(request);
    const state = await ensureStateFile();
    const currentOverride = state.giftOverrides[gift.id] || {};
    const imageUpload = await saveDataUrl(body.imageDataUrl, {
      label: '商品图片',
      allowedTypes: imageMimeExtensions,
      maxBytes: 5_000_000,
      directory: giftUploadDir,
      publicPath: '/uploads/gifts',
      prefix: gift.id
    });
    const musicUpload = await saveDataUrl(body.musicDataUrl, {
      label: '商品音乐',
      allowedTypes: audioMimeExtensions,
      maxBytes: 8_000_000,
      directory: audioUploadDir,
      publicPath: '/uploads/audio',
      prefix: gift.id
    });
    const nextOverrides = {
      ...state.giftOverrides,
      [gift.id]: {
        name: normalizeOptionalText(body.name, 24) || currentOverride.name || gift.name,
        image: imageUpload || normalizeOptionalUrl(body.image, 600) || currentOverride.image || '',
        music: musicUpload || normalizeOptionalUrl(body.music, 600) || currentOverride.music || ''
      }
    };
    const nextState = await writeState({ ...state, giftOverrides: nextOverrides });
    sendJson(response, 200, { ...nextState, gifts: mergeGifts(nextState) });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/admin/reset') {
    if (!isAdminRequest(request)) {
      sendError(response, 401, 'Admin token is invalid.');
      return;
    }

    const state = await ensureStateFile();
    const nextState = await writeState({ ...state, litGiftIds: [] });
    sendJson(response, 200, { ...nextState, gifts: mergeGifts(nextState) });
    return;
  }

  sendError(response, 404, 'API route not found.');
}

async function serveStatic(response, pathname) {
  const normalizedPath = pathname === '/' ? '/index.html' : pathname === '/admin' ? '/admin.html' : pathname;
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
