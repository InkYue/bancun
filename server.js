/**
 * 半寸时光礼物单 · 单文件 Node 服务（零依赖）
 *
 * 核心模型：
 * - 员工（employee）：每位员工有自己的 slug（URL）+ 密码 + 收款码 + 头像 + 灯牌状态
 *   - 角色 admin：可管理全站（员工 / 礼物目录 / 站点 / SMS）
 *   - 角色 employee：只可管理自己
 * - 客户（customer）：以手机号绑定身份；后台开启 SMS 后需短信验证码登录，否则只填手机号
 * - 礼物目录（16 个 + 上下线 / 名称价格 / 自定义图）：全站共享，admin 维护
 * - 灯牌点亮 / 熄灭：完全由"客户送礼"驱动，admin 不直接操作单个礼物（只可代员工"全部熄灭"）
 *
 * URL 路由：
 *   /                   → 无法连接页
 *   /u/<slug>           → 员工专属送礼页（slug 不存在或下架 → 无法连接页）
 *   /admin              → 员工 / admin 登录后台
 *   /api/...            → JSON API
 *   其他                → 无法连接页
 */
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const assetsDir = path.join(publicDir, 'assets');
const employeeAssetsDir = path.join(assetsDir, 'employees');
const dataDir = path.join(__dirname, 'data');
const stateFile = path.join(dataDir, 'state.json');

const port = Number.parseInt(process.env.PORT || '5173', 10);
const bootstrapAdminPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN || 'bancun-admin';
const defaultWechatPayUrl =
  process.env.WECHAT_PAY_URL ||
  'weixin://wxpay/bizpayurl?pr=replace-with-your-wechat-code&amount={amount}&gift={giftName}';

const MAX_ACTIVITIES = 1000;
const MAX_CUSTOMER_LOGINS = 1000;
const VISITOR_FEED_LIMIT = 30;
const SMS_CODE_TTL_MS = 5 * 60_000;
const SMS_RESEND_INTERVAL_MS = 60_000;

/* ============================================================
 * 礼物目录（id 不要乱改，会影响已点亮记录）
 * ============================================================ */
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

const giftIds = new Set(gifts.map((g) => g.id));
const validCategories = new Set(['普通礼物', '冠名礼物', '特殊礼物']);
const validRoles = new Set(['admin', 'employee']);

function createGift(id, name, price, category, emoji, frequency, notes, benefit = '') {
  return {
    id, name, price, category, emoji, benefit,
    image: `/assets/gifts/${id}.png`,
    sound: { id: `${id}-sound`, frequency, notes }
  };
}

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'], ['.webp', 'image/webp'], ['.gif', 'image/gif'],
  ['.mp3', 'audio/mpeg'], ['.wav', 'audio/wav'], ['.ogg', 'audio/ogg']
]);

/* ============================================================
 * 工具函数
 * ============================================================ */
function normalizeText(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function isValidSlug(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/i.test(value);
}

function isValidPhone(value) {
  return typeof value === 'string' && /^1[3-9]\d{9}$/.test(value);
}

function maskPhone(phone) {
  if (!isValidPhone(phone)) return phone || '';
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function sha256(input, salt) {
  return crypto.createHash('sha256').update(`${salt || ''}::${input}`).digest('hex');
}

function hmacHex(input, key) {
  return crypto.createHmac('sha256', key).update(input).digest('hex');
}

/* ============================================================
 * State 模型
 * ============================================================ */
function defaultState() {
  return {
    schemaVersion: 2,
    brandName: '半寸时光',
    defaultWechatPayUrl,
    disabledGiftIds: [],
    giftOverrides: {},
    smsConfig: {
      enabled: false,
      provider: 'tencent',
      secretId: '',
      secretKey: '',
      sdkAppId: '',
      region: 'ap-guangzhou',
      signName: '',
      templateId: ''
    },
    employees: [],
    activities: [],
    customerLogins: [],
    passwordSalt: crypto.randomBytes(8).toString('hex'),
    customerSecret: crypto.randomBytes(16).toString('hex'),
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

function normalizeEmployee(raw, salt) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isValidSlug(raw.slug)) return null;
  const role = validRoles.has(raw.role) ? raw.role : 'employee';
  const id = typeof raw.id === 'string' && raw.id ? raw.id : makeId('emp');
  return {
    id,
    slug: raw.slug.toLowerCase(),
    name: normalizeText(raw.name, raw.slug, 24),
    role,
    enabled: raw.enabled !== false,
    passwordHash: typeof raw.passwordHash === 'string' && raw.passwordHash ? raw.passwordHash : sha256('changeme', salt),
    avatarPath: typeof raw.avatarPath === 'string' ? raw.avatarPath.slice(0, 200) : '',
    wechatPayUrl: typeof raw.wechatPayUrl === 'string' ? raw.wechatPayUrl.slice(0, 600) : '',
    wechatQrPath: typeof raw.wechatQrPath === 'string' ? raw.wechatQrPath.slice(0, 200) : '',
    intro: typeof raw.intro === 'string' ? raw.intro.slice(0, 120) : '',
    litGiftIds: Array.isArray(raw.litGiftIds) ? [...new Set(raw.litGiftIds.filter((x) => giftIds.has(x)))] : [],
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString()
  };
}

function normalizeActivity(raw, employeeIds) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.giftId !== 'string' || !giftIds.has(raw.giftId)) return null;
  if (typeof raw.employeeId !== 'string' || !employeeIds.has(raw.employeeId)) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeId('act'),
    employeeId: raw.employeeId,
    giftId: raw.giftId,
    giftName: typeof raw.giftName === 'string' ? raw.giftName.slice(0, 40) : '',
    price: Number.isFinite(Number(raw.price)) ? Number(raw.price) : 0,
    phone: isValidPhone(raw.phone) ? raw.phone : '',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
  };
}

function normalizeCustomerLogin(raw, employeeIds) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isValidPhone(raw.phone)) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeId('cl'),
    phone: raw.phone,
    employeeId: typeof raw.employeeId === 'string' && employeeIds.has(raw.employeeId) ? raw.employeeId : '',
    method: raw.method === 'sms' ? 'sms' : 'phone',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
  };
}

function normalizeSmsConfig(raw) {
  const fb = defaultState().smsConfig;
  if (!raw || typeof raw !== 'object') return fb;
  return {
    enabled: Boolean(raw.enabled),
    provider: 'tencent',
    secretId: normalizeText(raw.secretId, '', 200),
    secretKey: normalizeText(raw.secretKey, '', 200),
    sdkAppId: normalizeText(raw.sdkAppId, '', 50),
    region: normalizeText(raw.region, fb.region, 30),
    signName: normalizeText(raw.signName, '', 50),
    templateId: normalizeText(raw.templateId, '', 50)
  };
}

function isSmsActuallyEnabled(cfg) {
  return Boolean(cfg && cfg.enabled && cfg.secretId && cfg.secretKey && cfg.sdkAppId && cfg.signName && cfg.templateId);
}

function normalizeState(value) {
  const fb = defaultState();
  if (!value || typeof value !== 'object') return fb;

  const passwordSalt = typeof value.passwordSalt === 'string' && value.passwordSalt ? value.passwordSalt : fb.passwordSalt;
  const customerSecret = typeof value.customerSecret === 'string' && value.customerSecret ? value.customerSecret : fb.customerSecret;

  /* 礼物 overrides */
  const rawOverrides = (value.giftOverrides && typeof value.giftOverrides === 'object') ? value.giftOverrides : {};
  const overrides = {};
  for (const [k, v] of Object.entries(rawOverrides)) {
    if (giftIds.has(k)) {
      const norm = normalizeOverride(v);
      if (Object.keys(norm).length) overrides[k] = norm;
    }
  }

  /* 员工 */
  const rawEmployees = Array.isArray(value.employees) ? value.employees : [];
  const employees = [];
  const seenSlugs = new Set();
  for (const r of rawEmployees) {
    const e = normalizeEmployee(r, passwordSalt);
    if (!e) continue;
    if (seenSlugs.has(e.slug)) continue;
    seenSlugs.add(e.slug);
    employees.push(e);
  }
  const employeeIds = new Set(employees.map((e) => e.id));

  /* 活动 */
  const rawActivities = Array.isArray(value.activities) ? value.activities : [];
  const activities = rawActivities
    .map((a) => normalizeActivity(a, employeeIds))
    .filter(Boolean)
    .slice(0, MAX_ACTIVITIES);

  const rawLogins = Array.isArray(value.customerLogins) ? value.customerLogins : [];
  const customerLogins = rawLogins
    .map((c) => normalizeCustomerLogin(c, employeeIds))
    .filter(Boolean)
    .slice(0, MAX_CUSTOMER_LOGINS);

  return {
    schemaVersion: 2,
    brandName: normalizeText(value.brandName, fb.brandName, 24),
    defaultWechatPayUrl: normalizeText(value.defaultWechatPayUrl, fb.defaultWechatPayUrl, 600),
    disabledGiftIds: Array.isArray(value.disabledGiftIds)
      ? [...new Set(value.disabledGiftIds.filter((x) => giftIds.has(x)))]
      : [],
    giftOverrides: overrides,
    smsConfig: normalizeSmsConfig(value.smsConfig),
    employees,
    activities,
    customerLogins,
    passwordSalt,
    customerSecret,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : fb.updatedAt
  };
}

/**
 * 旧版 state（v1 schema, 单页面 + 无员工）迁移到 v2：
 * 创建一个 slug='admin' 的默认 admin，把旧的 lit / wechat / activities 全归到他名下
 */
function migrateLegacyState(legacy) {
  const fb = defaultState();
  const adminId = makeId('emp');
  const admin = {
    id: adminId,
    slug: 'admin',
    name: '默认主页',
    role: 'admin',
    enabled: true,
    passwordHash: sha256(bootstrapAdminPassword, fb.passwordSalt),
    avatarPath: '',
    wechatPayUrl: typeof legacy.wechatPayUrl === 'string' ? legacy.wechatPayUrl : '',
    wechatQrPath: typeof legacy.wechatQrPath === 'string' ? legacy.wechatQrPath : '',
    intro: '',
    litGiftIds: Array.isArray(legacy.litGiftIds) ? legacy.litGiftIds.filter((x) => giftIds.has(x)) : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const activities = (Array.isArray(legacy.activities) ? legacy.activities : []).map((a) => ({
    id: typeof a.id === 'string' && a.id ? a.id : makeId('act'),
    employeeId: adminId,
    giftId: a.giftId,
    giftName: typeof a.giftName === 'string' ? a.giftName : '',
    price: Number.isFinite(Number(a.price)) ? Number(a.price) : 0,
    phone: '',
    createdAt: typeof a.createdAt === 'string' ? a.createdAt : new Date().toISOString()
  })).filter((a) => giftIds.has(a.giftId));

  return {
    ...fb,
    brandName: typeof legacy.brandName === 'string' ? legacy.brandName : fb.brandName,
    disabledGiftIds: Array.isArray(legacy.disabledGiftIds) ? legacy.disabledGiftIds.filter((x) => giftIds.has(x)) : [],
    giftOverrides: (legacy.giftOverrides && typeof legacy.giftOverrides === 'object') ? legacy.giftOverrides : {},
    employees: [admin],
    activities,
    updatedAt: new Date().toISOString()
  };
}

async function ensureStateFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    const raw = JSON.parse(await fs.readFile(stateFile, 'utf8'));
    if (!raw.schemaVersion || raw.schemaVersion < 2) {
      // 旧 schema：迁移
      const migrated = migrateLegacyState(raw);
      await writeState(migrated);
      console.log('已把旧版 state.json 迁移为 v2 schema（创建默认 admin: slug=admin）');
      return migrated;
    }
    return normalizeState(raw);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`State file was unreadable, recreating it: ${error.message}`);
    }
    /* 全新启动：创建默认 admin */
    const fb = defaultState();
    const adminId = makeId('emp');
    fb.employees = [{
      id: adminId,
      slug: 'admin',
      name: '默认主页',
      role: 'admin',
      enabled: true,
      passwordHash: sha256(bootstrapAdminPassword, fb.passwordSalt),
      avatarPath: '',
      wechatPayUrl: '',
      wechatQrPath: '',
      intro: '',
      litGiftIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }];
    await writeState(fb);
    console.log(`首次启动：已创建默认 admin（slug=admin，密码=${bootstrapAdminPassword}）`);
    return fb;
  }
}

async function writeState(state) {
  const next = normalizeState({ ...state, updatedAt: new Date().toISOString() });
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(stateFile, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

/* ============================================================
 * 礼物呈现
 * ============================================================ */
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

function withCatalog(state, includeDisabled = false) {
  const disabled = new Set(state.disabledGiftIds);
  return gifts
    .map((g) => {
      const merged = applyOverride(g, state.giftOverrides?.[g.id]);
      return { ...merged, enabled: !disabled.has(g.id) };
    })
    .filter((g) => includeDisabled || g.enabled);
}

/* ============================================================
 * 鉴权
 * ============================================================ */
/**
 * 员工 / admin 登录 token：base64("slug:password") 形式
 * 每次请求即时校验，无服务端会话存储
 */
function decodeStaffToken(token) {
  if (typeof token !== 'string' || !token) return null;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx <= 0) return null;
    return { slug: decoded.slice(0, idx).toLowerCase(), password: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

function makeStaffToken(slug, password) {
  return Buffer.from(`${slug}:${password}`, 'utf8').toString('base64');
}

function authenticateStaff(state, request) {
  const header = request.headers['x-auth-token'];
  if (!header || typeof header !== 'string') return null;
  const decoded = decodeStaffToken(header);
  if (!decoded) return null;
  const employee = state.employees.find((e) => e.slug === decoded.slug);
  if (!employee || !employee.enabled) return null;
  if (employee.passwordHash !== sha256(decoded.password, state.passwordSalt)) return null;
  return employee;
}

/**
 * 客户 token：HMAC( phone, customerSecret ) 派生，自带签名，无服务端存储
 * 形式：base64("phone:hmac")
 */
function makeCustomerToken(phone, secret) {
  const sig = hmacHex(phone, secret).slice(0, 32);
  return Buffer.from(`${phone}:${sig}`, 'utf8').toString('base64');
}

function decodeCustomerToken(token, secret) {
  if (typeof token !== 'string' || !token) return null;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx <= 0) return null;
    const phone = decoded.slice(0, idx);
    const sig = decoded.slice(idx + 1);
    if (!isValidPhone(phone)) return null;
    const expect = hmacHex(phone, secret).slice(0, 32);
    if (sig !== expect) return null;
    return { phone };
  } catch {
    return null;
  }
}

function authenticateCustomer(state, request) {
  const header = request.headers['x-customer-token'];
  if (!header || typeof header !== 'string') return null;
  return decodeCustomerToken(header, state.customerSecret);
}

/* ============================================================
 * SMS 验证码（内存存储，5 分钟过期）
 * ============================================================ */
const smsCodeStore = new Map(); // phone -> { code, expiresAt, lastSentAt }

function setSmsCode(phone, code) {
  smsCodeStore.set(phone, {
    code,
    expiresAt: Date.now() + SMS_CODE_TTL_MS,
    lastSentAt: Date.now()
  });
}

function consumeSmsCode(phone, code) {
  const rec = smsCodeStore.get(phone);
  if (!rec) return false;
  if (Date.now() > rec.expiresAt) { smsCodeStore.delete(phone); return false; }
  if (rec.code !== code) return false;
  smsCodeStore.delete(phone);
  return true;
}

function generateCode() {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

/* ============================================================
 * 腾讯云 SMS（TC3-HMAC-SHA256 raw HTTPS，零依赖）
 * 文档: https://cloud.tencent.com/document/api/382/55981
 * ============================================================ */
function tc3Sign(cfg, payload, timestamp) {
  const service = 'sms';
  const host = 'sms.tencentcloudapi.com';
  const algorithm = 'TC3-HMAC-SHA256';
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  /* 1. 构造规范请求串 */
  const canonicalUri = '/';
  const canonicalQuery = '';
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:sendsms\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const hashedRequestPayload = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = `POST\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${hashedRequestPayload}`;

  /* 2. 构造待签名字符串 */
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

  /* 3. 派生签名密钥 */
  const secretDate = crypto.createHmac('sha256', `TC3${cfg.secretKey}`).update(date).digest();
  const secretService = crypto.createHmac('sha256', secretDate).update(service).digest();
  const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  return `${algorithm} Credential=${cfg.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

function sendTencentSms(cfg, phone, code) {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      PhoneNumberSet: [`+86${phone}`],
      SmsSdkAppId: cfg.sdkAppId,
      SignName: cfg.signName,
      TemplateId: cfg.templateId,
      TemplateParamSet: [code, '5']
    });
    const authorization = tc3Sign(cfg, payload, timestamp);
    const req = https.request({
      hostname: 'sms.tencentcloudapi.com',
      method: 'POST',
      path: '/',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'host': 'sms.tencentcloudapi.com',
        'authorization': authorization,
        'x-tc-action': 'SendSms',
        'x-tc-version': '2021-01-11',
        'x-tc-region': cfg.region || 'ap-guangzhou',
        'x-tc-timestamp': String(timestamp),
        'content-length': Buffer.byteLength(payload).toString()
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (body.Response?.Error) {
            reject(new Error(`Tencent SMS: ${body.Response.Error.Code} ${body.Response.Error.Message}`));
            return;
          }
          const send = body.Response?.SendStatusSet?.[0];
          if (send && send.Code !== 'Ok') {
            reject(new Error(`Tencent SMS: ${send.Code} ${send.Message}`));
            return;
          }
          resolve(body.Response);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/* ============================================================
 * HTTP 帮助
 * ============================================================ */
function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(body));
}
function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function readJson(request, maxBytes = 6_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

/* ============================================================
 * 视图：员工对外公开数据
 * ============================================================ */
function publicEmployeeView(state, employee) {
  const catalog = withCatalog(state);
  return {
    brandName: state.brandName,
    smsRequired: isSmsActuallyEnabled(state.smsConfig),
    employee: {
      slug: employee.slug,
      name: employee.name,
      avatarPath: employee.avatarPath,
      intro: employee.intro,
      wechatPayUrl: employee.wechatPayUrl || state.defaultWechatPayUrl,
      wechatQrPath: employee.wechatQrPath,
      litGiftIds: employee.litGiftIds
    },
    gifts: catalog
  };
}

function selfEmployeeView(state, employee) {
  return {
    id: employee.id,
    slug: employee.slug,
    name: employee.name,
    role: employee.role,
    enabled: employee.enabled,
    avatarPath: employee.avatarPath,
    wechatPayUrl: employee.wechatPayUrl,
    wechatQrPath: employee.wechatQrPath,
    intro: employee.intro,
    litGiftIds: employee.litGiftIds,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt
  };
}

function adminEmployeeView(employee) {
  return {
    id: employee.id,
    slug: employee.slug,
    name: employee.name,
    role: employee.role,
    enabled: employee.enabled,
    avatarPath: employee.avatarPath,
    wechatPayUrl: employee.wechatPayUrl,
    wechatQrPath: employee.wechatQrPath,
    intro: employee.intro,
    litCount: employee.litGiftIds.length,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt
  };
}

function publicSmsConfigView(cfg) {
  /* 给前端用：不暴露 secret */
  return {
    enabled: Boolean(cfg.enabled),
    provider: 'tencent',
    secretId: cfg.secretId ? `${cfg.secretId.slice(0, 4)}****${cfg.secretId.slice(-4)}` : '',
    secretKeySet: Boolean(cfg.secretKey),
    sdkAppId: cfg.sdkAppId,
    region: cfg.region,
    signName: cfg.signName,
    templateId: cfg.templateId,
    actuallyEnabled: isSmsActuallyEnabled(cfg)
  };
}

/* ============================================================
 * 资源文件保存
 * ============================================================ */
async function saveDataUrlImage(dataUrl, dir, baseName, allowGif = false) {
  const re = allowGif ? /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i : /^data:image\/(png|jpe?g|webp);base64,(.+)$/i;
  const match = dataUrl.match(re);
  if (!match) throw new Error('请上传 PNG/JPG/WEBP' + (allowGif ? '/GIF' : '') + ' 格式的图片。');
  const ext = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length === 0 || buf.length > 4_000_000) throw new Error('图片大小需在 4MB 以内。');
  await fs.mkdir(dir, { recursive: true });
  /* 删除旧文件 */
  for (const e of ['png', 'jpeg', 'webp', 'gif']) {
    try { await fs.unlink(path.join(dir, `${baseName}.${e}`)); } catch {}
  }
  const fileName = `${baseName}.${ext}`;
  await fs.writeFile(path.join(dir, fileName), buf);
  return { ext, fileName };
}

async function clearImagesByPrefix(dir, baseName) {
  for (const e of ['png', 'jpeg', 'webp', 'gif']) {
    try { await fs.unlink(path.join(dir, `${baseName}.${e}`)); } catch {}
  }
}

/* ============================================================
 * API 处理
 * ============================================================ */
async function handleApi(request, response, pathname, query) {
  const state = await ensureStateFile();

  /* ---------- 公开 ---------- */

  /* 站点元数据：是否需要 SMS */
  if (request.method === 'GET' && pathname === '/api/public/site') {
    sendJson(response, 200, {
      brandName: state.brandName,
      smsRequired: isSmsActuallyEnabled(state.smsConfig)
    });
    return;
  }

  /* 员工公开数据（未登录的客户也能拿到，让页面先显示） */
  const slugStateMatch = pathname.match(/^\/api\/employees\/([a-z0-9-]+)\/state$/);
  if (request.method === 'GET' && slugStateMatch) {
    const slug = slugStateMatch[1].toLowerCase();
    const employee = state.employees.find((e) => e.slug === slug);
    if (!employee || !employee.enabled) {
      sendError(response, 404, '该员工链接不存在或已下架。');
      return;
    }
    sendJson(response, 200, publicEmployeeView(state, employee));
    return;
  }

  /* ---------- 客户登录 ---------- */

  if (request.method === 'POST' && pathname === '/api/customer/sms/send') {
    const body = await readJson(request);
    const phone = String(body.phone || '').trim();
    if (!isValidPhone(phone)) { sendError(response, 400, '手机号格式不正确。'); return; }
    if (!isSmsActuallyEnabled(state.smsConfig)) { sendError(response, 400, '当前未启用 SMS，无需验证码。'); return; }
    const last = smsCodeStore.get(phone)?.lastSentAt || 0;
    if (Date.now() - last < SMS_RESEND_INTERVAL_MS) {
      sendError(response, 429, '请求过于频繁，请稍后再试。');
      return;
    }
    const code = generateCode();
    setSmsCode(phone, code);
    try {
      await sendTencentSms(state.smsConfig, phone, code);
      sendJson(response, 200, { ok: true, ttlSeconds: Math.floor(SMS_CODE_TTL_MS / 1000) });
    } catch (err) {
      smsCodeStore.delete(phone);
      console.warn('SMS 发送失败:', err.message);
      sendError(response, 502, `短信发送失败：${err.message}`);
    }
    return;
  }

  if (request.method === 'POST' && pathname === '/api/customer/login') {
    const body = await readJson(request);
    const phone = String(body.phone || '').trim();
    if (!isValidPhone(phone)) { sendError(response, 400, '手机号格式不正确。'); return; }
    const smsOn = isSmsActuallyEnabled(state.smsConfig);
    if (smsOn) {
      const code = String(body.code || '').trim();
      if (!/^\d{6}$/.test(code)) { sendError(response, 400, '请输入 6 位短信验证码。'); return; }
      if (!consumeSmsCode(phone, code)) { sendError(response, 400, '验证码错误或已失效。'); return; }
    }
    const token = makeCustomerToken(phone, state.customerSecret);

    /* 记录登录事件（带可选员工归属） */
    const slug = String(body.slug || '').trim().toLowerCase();
    const employee = isValidSlug(slug) ? state.employees.find((e) => e.slug === slug) : null;
    const login = {
      id: makeId('cl'),
      phone,
      employeeId: employee?.id || '',
      method: smsOn ? 'sms' : 'phone',
      createdAt: new Date().toISOString()
    };
    const nextLogins = [login, ...state.customerLogins].slice(0, MAX_CUSTOMER_LOGINS);
    await writeState({ ...state, customerLogins: nextLogins });

    sendJson(response, 200, { token, phone });
    return;
  }

  /* 客户送礼 */
  const lightMatch = pathname.match(/^\/api\/employees\/([a-z0-9-]+)\/gifts\/([a-z0-9-]+)\/light$/);
  if (request.method === 'POST' && lightMatch) {
    const slug = lightMatch[1].toLowerCase();
    const giftId = lightMatch[2];
    const customer = authenticateCustomer(state, request);
    if (!customer) { sendError(response, 401, '请先用手机号登录。'); return; }
    const employee = state.employees.find((e) => e.slug === slug);
    if (!employee || !employee.enabled) { sendError(response, 404, '员工不存在或已下架。'); return; }
    const baseGift = gifts.find((g) => g.id === giftId);
    if (!baseGift || state.disabledGiftIds.includes(giftId)) { sendError(response, 404, '礼物不存在或已下架。'); return; }
    const gift = applyOverride(baseGift, state.giftOverrides?.[giftId]);
    const body = await readJson(request);
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount !== gift.price) { sendError(response, 400, '金额与礼物不匹配。'); return; }

    const activity = {
      id: makeId('act'),
      employeeId: employee.id,
      giftId: gift.id,
      giftName: gift.name,
      price: gift.price,
      phone: customer.phone,
      createdAt: new Date().toISOString()
    };
    const employees = state.employees.map((e) => {
      if (e.id !== employee.id) return e;
      const lit = new Set(e.litGiftIds);
      lit.add(gift.id);
      return { ...e, litGiftIds: [...lit], updatedAt: new Date().toISOString() };
    });
    const activities = [activity, ...state.activities].slice(0, MAX_ACTIVITIES);
    const next = await writeState({ ...state, employees, activities });
    const updatedEmployee = next.employees.find((e) => e.id === employee.id);
    sendJson(response, 200, {
      gift,
      activity: { ...activity, phone: maskPhone(activity.phone) },
      litGiftIds: updatedEmployee.litGiftIds
    });
    return;
  }

  /* ---------- 员工 / admin 登录 ---------- */

  if (request.method === 'POST' && pathname === '/api/auth/login') {
    const body = await readJson(request);
    const slug = String(body.slug || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!slug || !password) { sendError(response, 400, '请输入账号和密码。'); return; }
    const employee = state.employees.find((e) => e.slug === slug);
    if (!employee || !employee.enabled || employee.passwordHash !== sha256(password, state.passwordSalt)) {
      sendError(response, 401, '账号或密码不正确。');
      return;
    }
    sendJson(response, 200, {
      token: makeStaffToken(slug, password),
      role: employee.role,
      employee: selfEmployeeView(state, employee)
    });
    return;
  }

  if (request.method === 'GET' && pathname === '/api/auth/me') {
    const me = authenticateStaff(state, request);
    if (!me) { sendError(response, 401, '未登录。'); return; }
    sendJson(response, 200, { role: me.role, employee: selfEmployeeView(state, me) });
    return;
  }

  /* ---------- 员工自助 /api/me/* ---------- */

  if (pathname.startsWith('/api/me/')) {
    const me = authenticateStaff(state, request);
    if (!me) { sendError(response, 401, '未登录。'); return; }

    if (request.method === 'GET' && pathname === '/api/me/state') {
      const myActs = state.activities.filter((a) => a.employeeId === me.id).map((a) => ({
        ...a, phone: maskPhone(a.phone)
      }));
      sendJson(response, 200, {
        role: me.role,
        employee: selfEmployeeView(state, me),
        activities: myActs.slice(0, 100),
        catalog: withCatalog(state, true),
        smsRequired: isSmsActuallyEnabled(state.smsConfig),
        brandName: state.brandName
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/me/profile') {
      const body = await readJson(request);
      const employees = state.employees.map((e) => e.id === me.id ? {
        ...e,
        name: normalizeText(body.name, e.name, 24),
        intro: normalizeText(body.intro, e.intro, 120),
        wechatPayUrl: typeof body.wechatPayUrl === 'string' ? body.wechatPayUrl.slice(0, 600) : e.wechatPayUrl,
        updatedAt: new Date().toISOString()
      } : e);
      const next = await writeState({ ...state, employees });
      sendJson(response, 200, { employee: selfEmployeeView(next, next.employees.find((e) => e.id === me.id)) });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/me/password') {
      const body = await readJson(request);
      const oldPassword = String(body.oldPassword || '');
      const newPassword = String(body.newPassword || '');
      if (newPassword.length < 6) { sendError(response, 400, '新密码至少 6 位。'); return; }
      if (me.passwordHash !== sha256(oldPassword, state.passwordSalt)) { sendError(response, 400, '旧密码不正确。'); return; }
      const employees = state.employees.map((e) => e.id === me.id ? {
        ...e, passwordHash: sha256(newPassword, state.passwordSalt), updatedAt: new Date().toISOString()
      } : e);
      await writeState({ ...state, employees });
      sendJson(response, 200, { ok: true, token: makeStaffToken(me.slug, newPassword) });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/me/wechat-qr') {
      const body = await readJson(request);
      try {
        const dir = path.join(employeeAssetsDir, me.id);
        const { fileName } = await saveDataUrlImage(body.dataUrl, dir, 'wechat-qr', false);
        const wechatQrPath = `/assets/employees/${me.id}/${fileName}?v=${Date.now()}`;
        const employees = state.employees.map((e) => e.id === me.id ? { ...e, wechatQrPath, updatedAt: new Date().toISOString() } : e);
        const next = await writeState({ ...state, employees });
        sendJson(response, 200, { employee: selfEmployeeView(next, next.employees.find((e) => e.id === me.id)) });
      } catch (err) { sendError(response, 400, err.message); }
      return;
    }

    if (request.method === 'DELETE' && pathname === '/api/me/wechat-qr') {
      await clearImagesByPrefix(path.join(employeeAssetsDir, me.id), 'wechat-qr');
      const employees = state.employees.map((e) => e.id === me.id ? { ...e, wechatQrPath: '', updatedAt: new Date().toISOString() } : e);
      const next = await writeState({ ...state, employees });
      sendJson(response, 200, { employee: selfEmployeeView(next, next.employees.find((e) => e.id === me.id)) });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/me/avatar') {
      const body = await readJson(request);
      try {
        const dir = path.join(employeeAssetsDir, me.id);
        const { fileName } = await saveDataUrlImage(body.dataUrl, dir, 'avatar', false);
        const avatarPath = `/assets/employees/${me.id}/${fileName}?v=${Date.now()}`;
        const employees = state.employees.map((e) => e.id === me.id ? { ...e, avatarPath, updatedAt: new Date().toISOString() } : e);
        const next = await writeState({ ...state, employees });
        sendJson(response, 200, { employee: selfEmployeeView(next, next.employees.find((e) => e.id === me.id)) });
      } catch (err) { sendError(response, 400, err.message); }
      return;
    }

    if (request.method === 'POST' && pathname === '/api/me/reset') {
      const employees = state.employees.map((e) => e.id === me.id ? { ...e, litGiftIds: [], updatedAt: new Date().toISOString() } : e);
      const next = await writeState({ ...state, employees });
      sendJson(response, 200, { employee: selfEmployeeView(next, next.employees.find((e) => e.id === me.id)) });
      return;
    }
  }

  /* ---------- Admin（master）/api/admin/* ---------- */

  if (pathname.startsWith('/api/admin/')) {
    const me = authenticateStaff(state, request);
    if (!me || me.role !== 'admin') { sendError(response, 403, '需要 admin 权限。'); return; }

    /* 全站状态 */
    if (request.method === 'GET' && pathname === '/api/admin/state') {
      sendJson(response, 200, {
        brandName: state.brandName,
        defaultWechatPayUrl: state.defaultWechatPayUrl,
        catalog: withCatalog(state, true),
        employees: state.employees.map(adminEmployeeView),
        sms: publicSmsConfigView(state.smsConfig)
      });
      return;
    }

    /* 站点设置 */
    if (request.method === 'POST' && pathname === '/api/admin/settings') {
      const body = await readJson(request);
      const next = await writeState({
        ...state,
        brandName: normalizeText(body.brandName, state.brandName, 24),
        defaultWechatPayUrl: normalizeText(body.defaultWechatPayUrl, state.defaultWechatPayUrl, 600)
      });
      sendJson(response, 200, { brandName: next.brandName, defaultWechatPayUrl: next.defaultWechatPayUrl });
      return;
    }

    /* SMS 设置 */
    if (request.method === 'POST' && pathname === '/api/admin/sms') {
      const body = await readJson(request);
      /* 留空的 secretKey 维持原值，避免每次保存都要重填 */
      const merged = {
        ...state.smsConfig,
        enabled: Boolean(body.enabled),
        secretId: typeof body.secretId === 'string' && body.secretId.trim() && !body.secretId.includes('****')
          ? body.secretId.trim() : state.smsConfig.secretId,
        secretKey: typeof body.secretKey === 'string' && body.secretKey.trim()
          ? body.secretKey.trim() : state.smsConfig.secretKey,
        sdkAppId: typeof body.sdkAppId === 'string' ? body.sdkAppId.trim() : state.smsConfig.sdkAppId,
        region: typeof body.region === 'string' ? body.region.trim() : state.smsConfig.region,
        signName: typeof body.signName === 'string' ? body.signName.trim() : state.smsConfig.signName,
        templateId: typeof body.templateId === 'string' ? body.templateId.trim() : state.smsConfig.templateId
      };
      const next = await writeState({ ...state, smsConfig: normalizeSmsConfig(merged) });
      sendJson(response, 200, { sms: publicSmsConfigView(next.smsConfig) });
      return;
    }

    /* 测试 SMS */
    if (request.method === 'POST' && pathname === '/api/admin/sms/test') {
      const body = await readJson(request);
      const phone = String(body.phone || '').trim();
      if (!isValidPhone(phone)) { sendError(response, 400, '手机号格式不正确。'); return; }
      if (!isSmsActuallyEnabled(state.smsConfig)) { sendError(response, 400, '请先完整填写 SMS 配置并开启。'); return; }
      const code = generateCode();
      try {
        await sendTencentSms(state.smsConfig, phone, code);
        sendJson(response, 200, { ok: true, code });
      } catch (err) {
        sendError(response, 502, err.message);
      }
      return;
    }

    /* 员工 CRUD */
    if (request.method === 'POST' && pathname === '/api/admin/employees') {
      const body = await readJson(request);
      const slug = String(body.slug || '').trim().toLowerCase();
      const name = String(body.name || '').trim();
      const password = String(body.password || '');
      const role = validRoles.has(body.role) ? body.role : 'employee';
      if (!isValidSlug(slug)) { sendError(response, 400, 'slug 必须是 3-32 位字母 / 数字 / 连字符。'); return; }
      if (state.employees.some((e) => e.slug === slug)) { sendError(response, 400, '该 slug 已存在。'); return; }
      if (!name) { sendError(response, 400, '请填写员工名称。'); return; }
      if (password.length < 6) { sendError(response, 400, '密码至少 6 位。'); return; }
      const now = new Date().toISOString();
      const employee = {
        id: makeId('emp'), slug, name: name.slice(0, 24), role, enabled: true,
        passwordHash: sha256(password, state.passwordSalt),
        avatarPath: '', wechatPayUrl: '', wechatQrPath: '', intro: '',
        litGiftIds: [], createdAt: now, updatedAt: now
      };
      const next = await writeState({ ...state, employees: [...state.employees, employee] });
      sendJson(response, 200, { employee: adminEmployeeView(next.employees.find((e) => e.id === employee.id)) });
      return;
    }

    const empMatch = pathname.match(/^\/api\/admin\/employees\/([a-z0-9-]+)$/);
    if (request.method === 'POST' && empMatch) {
      const id = empMatch[1];
      const target = state.employees.find((e) => e.id === id);
      if (!target) { sendError(response, 404, '员工不存在。'); return; }
      const body = await readJson(request);
      const updates = { updatedAt: new Date().toISOString() };
      if (typeof body.slug === 'string') {
        const newSlug = body.slug.trim().toLowerCase();
        if (newSlug !== target.slug) {
          if (!isValidSlug(newSlug)) { sendError(response, 400, 'slug 不合法。'); return; }
          if (state.employees.some((e) => e.slug === newSlug && e.id !== id)) { sendError(response, 400, '该 slug 已存在。'); return; }
          updates.slug = newSlug;
        }
      }
      if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim().slice(0, 24);
      if (typeof body.intro === 'string') updates.intro = body.intro.slice(0, 120);
      if (typeof body.wechatPayUrl === 'string') updates.wechatPayUrl = body.wechatPayUrl.slice(0, 600);
      if (validRoles.has(body.role)) {
        /* 不允许把唯一 admin 改成 employee */
        if (target.role === 'admin' && body.role !== 'admin' && state.employees.filter((e) => e.role === 'admin').length === 1) {
          sendError(response, 400, '至少需保留一名 admin。');
          return;
        }
        updates.role = body.role;
      }
      if (typeof body.enabled === 'boolean') {
        if (target.role === 'admin' && !body.enabled && state.employees.filter((e) => e.role === 'admin' && e.enabled).length === 1) {
          sendError(response, 400, '至少需保留一名启用中的 admin。');
          return;
        }
        updates.enabled = body.enabled;
      }
      if (typeof body.password === 'string' && body.password) {
        if (body.password.length < 6) { sendError(response, 400, '密码至少 6 位。'); return; }
        updates.passwordHash = sha256(body.password, state.passwordSalt);
      }
      const employees = state.employees.map((e) => e.id === id ? { ...e, ...updates } : e);
      const next = await writeState({ ...state, employees });
      sendJson(response, 200, { employee: adminEmployeeView(next.employees.find((e) => e.id === id)) });
      return;
    }

    if (request.method === 'DELETE' && empMatch) {
      const id = empMatch[1];
      const target = state.employees.find((e) => e.id === id);
      if (!target) { sendError(response, 404, '员工不存在。'); return; }
      if (target.role === 'admin' && state.employees.filter((e) => e.role === 'admin').length === 1) {
        sendError(response, 400, '至少需保留一名 admin。');
        return;
      }
      /* 清理资源 */
      const dir = path.join(employeeAssetsDir, id);
      try { await fs.rm(dir, { recursive: true, force: true }); } catch {}
      const employees = state.employees.filter((e) => e.id !== id);
      const activities = state.activities.filter((a) => a.employeeId !== id);
      await writeState({ ...state, employees, activities });
      sendJson(response, 200, { ok: true });
      return;
    }

    /* 员工 reset / qr / avatar（admin 代操作） */
    const empOpMatch = pathname.match(/^\/api\/admin\/employees\/([a-z0-9-]+)\/(reset|wechat-qr|avatar)$/);
    if (empOpMatch) {
      const id = empOpMatch[1];
      const op = empOpMatch[2];
      const target = state.employees.find((e) => e.id === id);
      if (!target) { sendError(response, 404, '员工不存在。'); return; }

      if (op === 'reset' && request.method === 'POST') {
        const employees = state.employees.map((e) => e.id === id ? { ...e, litGiftIds: [], updatedAt: new Date().toISOString() } : e);
        await writeState({ ...state, employees });
        sendJson(response, 200, { ok: true });
        return;
      }

      if (op === 'wechat-qr' && request.method === 'POST') {
        const body = await readJson(request);
        try {
          const dir = path.join(employeeAssetsDir, id);
          const { fileName } = await saveDataUrlImage(body.dataUrl, dir, 'wechat-qr', false);
          const wechatQrPath = `/assets/employees/${id}/${fileName}?v=${Date.now()}`;
          const employees = state.employees.map((e) => e.id === id ? { ...e, wechatQrPath, updatedAt: new Date().toISOString() } : e);
          const next = await writeState({ ...state, employees });
          sendJson(response, 200, { employee: adminEmployeeView(next.employees.find((e) => e.id === id)) });
        } catch (err) { sendError(response, 400, err.message); }
        return;
      }

      if (op === 'wechat-qr' && request.method === 'DELETE') {
        await clearImagesByPrefix(path.join(employeeAssetsDir, id), 'wechat-qr');
        const employees = state.employees.map((e) => e.id === id ? { ...e, wechatQrPath: '', updatedAt: new Date().toISOString() } : e);
        const next = await writeState({ ...state, employees });
        sendJson(response, 200, { employee: adminEmployeeView(next.employees.find((e) => e.id === id)) });
        return;
      }

      if (op === 'avatar' && request.method === 'POST') {
        const body = await readJson(request);
        try {
          const dir = path.join(employeeAssetsDir, id);
          const { fileName } = await saveDataUrlImage(body.dataUrl, dir, 'avatar', false);
          const avatarPath = `/assets/employees/${id}/${fileName}?v=${Date.now()}`;
          const employees = state.employees.map((e) => e.id === id ? { ...e, avatarPath, updatedAt: new Date().toISOString() } : e);
          const next = await writeState({ ...state, employees });
          sendJson(response, 200, { employee: adminEmployeeView(next.employees.find((e) => e.id === id)) });
        } catch (err) { sendError(response, 400, err.message); }
        return;
      }
    }

    /* 礼物目录管理 */
    const giftEditMatch = pathname.match(/^\/api\/admin\/gifts\/([a-z0-9-]+)$/);
    if (request.method === 'POST' && giftEditMatch) {
      const giftId = giftEditMatch[1];
      if (!giftIds.has(giftId)) { sendError(response, 404, '礼物不存在。'); return; }
      const body = await readJson(request);
      const cleaned = normalizeOverride(body);
      const overrides = { ...(state.giftOverrides || {}) };
      const base = gifts.find((g) => g.id === giftId);
      const next = {};
      if (cleaned.name && cleaned.name !== base.name) next.name = cleaned.name;
      if (cleaned.price && cleaned.price !== base.price) next.price = cleaned.price;
      if (cleaned.category && cleaned.category !== base.category) next.category = cleaned.category;
      if (cleaned.benefit !== undefined && cleaned.benefit !== base.benefit) next.benefit = cleaned.benefit;
      const prev = overrides[giftId] || {};
      if (prev.imagePath) next.imagePath = prev.imagePath;
      if (Object.keys(next).length) overrides[giftId] = next;
      else delete overrides[giftId];
      const updated = await writeState({ ...state, giftOverrides: overrides });
      sendJson(response, 200, { catalog: withCatalog(updated, true) });
      return;
    }

    const giftToggleMatch = pathname.match(/^\/api\/admin\/gifts\/([a-z0-9-]+)\/toggle$/);
    if (request.method === 'POST' && giftToggleMatch) {
      const giftId = giftToggleMatch[1];
      if (!giftIds.has(giftId)) { sendError(response, 404, '礼物不存在。'); return; }
      const body = await readJson(request);
      const enabled = Boolean(body.enabled);
      const set = new Set(state.disabledGiftIds);
      if (enabled) set.delete(giftId);
      else set.add(giftId);
      const updated = await writeState({ ...state, disabledGiftIds: [...set] });
      sendJson(response, 200, { catalog: withCatalog(updated, true) });
      return;
    }

    const giftImgMatch = pathname.match(/^\/api\/admin\/gifts\/([a-z0-9-]+)\/image$/);
    if (request.method === 'POST' && giftImgMatch) {
      const giftId = giftImgMatch[1];
      if (!giftIds.has(giftId)) { sendError(response, 404, '礼物不存在。'); return; }
      const body = await readJson(request);
      try {
        const dir = path.join(assetsDir, 'gifts');
        const { fileName } = await saveDataUrlImage(body.dataUrl, dir, `custom-${giftId}`, true);
        const overrides = { ...(state.giftOverrides || {}) };
        overrides[giftId] = { ...(overrides[giftId] || {}), imagePath: `/assets/gifts/${fileName}?v=${Date.now()}` };
        const updated = await writeState({ ...state, giftOverrides: overrides });
        sendJson(response, 200, { catalog: withCatalog(updated, true) });
      } catch (err) { sendError(response, 400, err.message); }
      return;
    }

    if (request.method === 'DELETE' && giftImgMatch) {
      const giftId = giftImgMatch[1];
      if (!giftIds.has(giftId)) { sendError(response, 404, '礼物不存在。'); return; }
      await clearImagesByPrefix(path.join(assetsDir, 'gifts'), `custom-${giftId}`);
      const overrides = { ...(state.giftOverrides || {}) };
      if (overrides[giftId]) {
        const { imagePath: _drop, ...rest } = overrides[giftId];
        if (Object.keys(rest).length) overrides[giftId] = rest;
        else delete overrides[giftId];
      }
      const updated = await writeState({ ...state, giftOverrides: overrides });
      sendJson(response, 200, { catalog: withCatalog(updated, true) });
      return;
    }

    const giftResetMatch = pathname.match(/^\/api\/admin\/gifts\/([a-z0-9-]+)\/reset$/);
    if (request.method === 'POST' && giftResetMatch) {
      const giftId = giftResetMatch[1];
      if (!giftIds.has(giftId)) { sendError(response, 404, '礼物不存在。'); return; }
      await clearImagesByPrefix(path.join(assetsDir, 'gifts'), `custom-${giftId}`);
      const overrides = { ...(state.giftOverrides || {}) };
      delete overrides[giftId];
      const updated = await writeState({ ...state, giftOverrides: overrides });
      sendJson(response, 200, { catalog: withCatalog(updated, true) });
      return;
    }

    /* 活动 */
    if (request.method === 'GET' && pathname === '/api/admin/activities') {
      const employeeId = query.get('employeeId') || '';
      const empMap = new Map(state.employees.map((e) => [e.id, e]));
      const list = state.activities
        .filter((a) => !employeeId || a.employeeId === employeeId)
        .map((a) => ({
          ...a,
          phone: maskPhone(a.phone),
          employeeSlug: empMap.get(a.employeeId)?.slug || '',
          employeeName: empMap.get(a.employeeId)?.name || '已删除'
        }));
      sendJson(response, 200, { activities: list });
      return;
    }

    const actDelMatch = pathname.match(/^\/api\/admin\/activities\/([a-z0-9-]+)$/);
    if (request.method === 'DELETE' && actDelMatch) {
      const id = actDelMatch[1];
      const activities = state.activities.filter((a) => a.id !== id);
      await writeState({ ...state, activities });
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/admin/activities/clear') {
      const body = await readJson(request).catch(() => ({}));
      const employeeId = body.employeeId || '';
      const activities = employeeId
        ? state.activities.filter((a) => a.employeeId !== employeeId)
        : [];
      await writeState({ ...state, activities });
      sendJson(response, 200, { ok: true });
      return;
    }

    /* 客户登录记录 */
    if (request.method === 'GET' && pathname === '/api/admin/customer-logins') {
      const employeeId = query.get('employeeId') || '';
      const empMap = new Map(state.employees.map((e) => [e.id, e]));
      const list = state.customerLogins
        .filter((c) => !employeeId || c.employeeId === employeeId)
        .map((c) => ({
          ...c,
          phone: maskPhone(c.phone),
          employeeSlug: empMap.get(c.employeeId)?.slug || '',
          employeeName: empMap.get(c.employeeId)?.name || (c.employeeId ? '已删除' : '未知')
        }));
      const uniquePhones = new Set(state.customerLogins.map((c) => c.phone));
      sendJson(response, 200, { logins: list, totalUniquePhones: uniquePhones.size });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/admin/customer-logins/clear') {
      const body = await readJson(request).catch(() => ({}));
      const employeeId = body.employeeId || '';
      const customerLogins = employeeId
        ? state.customerLogins.filter((c) => c.employeeId !== employeeId)
        : [];
      await writeState({ ...state, customerLogins });
      sendJson(response, 200, { ok: true });
      return;
    }
  }

  sendError(response, 404, 'API 路由不存在。');
}

/* ============================================================
 * 静态资源 / 路由
 * ============================================================ */
async function serveFile(response, filePath, statusCode = 200) {
  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(statusCode, { 'content-type': mimeTypes.get(ext) || 'application/octet-stream' });
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

async function serveNoAccess(response) {
  await serveFile(response, path.join(publicDir, 'no-access.html'), 404);
}

async function serveStatic(response, pathname) {
  const decoded = decodeURIComponent(pathname);
  const safe = path.normalize(decoded).replace(/^([/\\])+/, '');
  const filePath = path.join(publicDir, safe);
  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }
  await serveFile(response, filePath);
}

const ALLOW_TOP_LEVEL_FILES = new Set(['/styles.css', '/app.js', '/admin.js', '/audio.js', '/visitor.js', '/no-access.html', '/admin.html', '/visitor.html']);

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    /* API */
    if (pathname.startsWith('/api/')) {
      await handleApi(request, response, pathname, url.searchParams);
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendError(response, 405, 'Method not allowed.');
      return;
    }

    /* /admin → admin.html */
    if (pathname === '/admin' || pathname === '/admin/') {
      await serveFile(response, path.join(publicDir, 'admin.html'));
      return;
    }

    /* /u/<slug> → visitor.html（仅当 slug 存在且启用） */
    const slugMatch = pathname.match(/^\/u\/([a-z0-9-]+)\/?$/i);
    if (slugMatch) {
      const slug = slugMatch[1].toLowerCase();
      const state = await ensureStateFile();
      const employee = state.employees.find((e) => e.slug === slug);
      if (employee && employee.enabled) {
        await serveFile(response, path.join(publicDir, 'visitor.html'));
        return;
      }
      await serveNoAccess(response);
      return;
    }

    /* assets / 静态文件 */
    if (pathname.startsWith('/assets/') || ALLOW_TOP_LEVEL_FILES.has(pathname)) {
      await serveStatic(response, pathname);
      return;
    }

    /* 其他全部走 no-access 页 */
    await serveNoAccess(response);
  } catch (error) {
    console.error(error);
    sendError(response, 500, '服务器异常。');
  }
});

await ensureStateFile();

server.listen(port, () => {
  console.log(`半寸时光礼物单已启动：http://localhost:${port}`);
  console.log(`后台地址：http://localhost:${port}/admin`);
  console.log(`默认 admin 账号：slug=admin，密码=${bootstrapAdminPassword}（首次启动后请尽快修改）`);
});
