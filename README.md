# 半寸时光甜蜜礼物单

一个零依赖的 Node 单文件礼物点亮系统：

- **每位员工**有专属访问链接 `/u/<slug>` 和登录密码（slug 可自动生成）
- **客户**用手机号进入员工页面送礼（admin 选填腾讯云 SMS 后强制验证码）
- **后台**：仪表盘 / 我的页面 / 员工管理 / 礼物目录 / 送礼记录 / 客户登录 / 站点设置
- **角色**：`admin`（管理全站）、`employee`（仅管理自己），admin 至少保留 1 名
- **配色**：游客侧暖色系深色甜蜜风（中式氛围图 + 月亮装饰 + 礼物金粉光晕）、后台白色管理风，互不影响
- **响应式**：H5 移动端 + PC，安全区适配（iPhone notch / 底部 home indicator）
- **零依赖**：纯 Node 内置库（`http` / `https` / `crypto` / `sqlite`），腾讯云 SMS、易支付、拉卡拉签名与回调验签都走原生实现

> 支付已接入易支付与拉卡拉：客户付款后必须收到所选通道的异步通知且验签成功，系统才会点亮礼物。

---

## 快速开始

需要 Node 22.5+，零依赖（内置 `http` / `https` / `crypto` / `sqlite`）。

```bash
# 启动开发
npm run dev
# 或
node server.js

# 自定义端口 / 默认 admin 密码
PORT=8080 ADMIN_PASSWORD="my-strong-password" node server.js

# 自定义数据目录（默认 ./data）
DATA_DIR="/var/lib/bancun" node server.js

# 易支付商户 KEY 推荐在后台填写；也可用环境变量作为兼容兜底
YIPAY_KEY="your-yipay-merchant-key" node server.js

# 拉卡拉也推荐在后台填写；环境变量可作为兼容兜底
LAKALA_APP_ID="app-id" LAKALA_SERIAL_NO="cert-serial" LAKALA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..." LAKALA_PUBLIC_KEY="-----BEGIN CERTIFICATE-----..." node server.js
```

启动日志会打印默认 admin 账号：

```
首次启动：已创建默认 admin（slug=admin，密码=bancun-admin）
```

> 首次启动后请尽快进入后台 → 我的页面 → 修改密码。

---

## URL 一览

| 地址 | 用途 | 权限 |
|------|------|------|
| `/u/<slug>` | 员工的客户送礼页 | 客户（手机号登录） |
| `/admin` | 后台登录入口 | 员工 / admin |
| `/`、其他未匹配路径 | "无法连接" 页 | — |
| `/api/*` | JSON API | 见下方鉴权说明 |

**示例**：员工 slug 为 `sakura` → 客户访问 `https://your-host/u/sakura`。

---

## 角色与权限

| 角色 | 可见视图 | 能做什么 |
|------|---------|----------|
| `admin` | 仪表盘、我的页面、员工管理、礼物目录、送礼记录、站点设置 | 管全站；维护自己 |
| `employee` | 仪表盘、我的页面 | 只能管自己（链接、密码、灯牌全熄） |

**点亮 / 熄灭逻辑**：

- 灯牌的"点亮"由**所选支付通道成功回调**触发（客户先 `POST /api/employees/:slug/gifts/:id/pay` 创建订单）
- 旧的直接点亮接口 `POST /api/employees/:slug/gifts/:id/light` 已关闭，避免未付款也能点亮
- 后台**不提供**手动点亮单个礼物的开关（与员工和客户挂钩，不归运营）
- 员工 / admin 可以**一键全部熄灭**自己 / 指定员工的灯牌（运营复位用）

---

## 客户登录流程

1. 访问 `/u/<slug>` → 出现手机号登录闸门
2. **若 admin 未配置 SMS**：填手机号即可进入（前端校验 11 位中国大陆手机号）
3. **若 admin 已配置腾讯云 SMS**：填手机号 → 点"获取验证码" → 输入 6 位验证码 → 进入
4. 登录后客户 token 写入 localStorage，下次自动跳过登录
5. 顶部的"⎋ 退出"可以清掉手机号身份

客户身份**全站绑定手机号**，所有送礼记录的 `phone` 字段都来自此。后台 → 客户登录 视图可查看每次登录留痕（含员工归属 / 登录方式 / 时间），手机号显示为掩码 `138****8000`。

---

## 后台数据视图

| 视图 | 内容 | 角色 |
|------|------|------|
| 仪表盘 | 累计金额 / 总送礼次数 / 今日 / **客户人数（去重）** / 员工启用比 / 礼物分布柱状图 / 最近送礼 | 全部 |
| 我的页面 | 个人访问链接 + 复制 / 头像 / 个人资料 / 修改密码 / 一键全部熄灭 | 全部 |
| 员工管理 | 列表 + 搜索 + 角色筛选 + 新增 / 编辑（含 slug 自动生成）/ 上下线 / 代熄灭 / 删除 / **复制链接** | admin |
| 礼物目录 | 16 个礼物的上下线 / 编辑名称价格 / 替换图 / 恢复默认 | admin |
| 送礼记录 | 完整流水表格 + 员工筛选下拉（含全站汇总）+ 关键字搜索 + 单条删除 + 按筛选清空 | admin |
| 客户登录 | 每次客户手机号登录的留痕 + 4 张 KPI（总登录数 / 客户去重数 / 今日新登录 / SMS 登录占比） | admin |
| 站点设置 | 站点名 / 对外访问域名 / 易支付配置 / 腾讯云 SMS 配置（含发测试短信） | admin |

---

## 收款通道

后台 → 站点设置 → 基础信息，可选择当前收款通道：`易支付` 或 `拉卡拉`。同一时间客户下单只走一个通道；历史待支付订单仍按创建时的通道验签回调。

### 易支付收款流程

后台 → 站点设置 → 易支付。需要填：

| 字段 | 说明 |
|------|------|
| 启用开关 | 开启后客户才能创建支付订单 |
| 网关地址 | 默认 `https://ezfp.cn` |
| 商户 ID（pid） | 易支付商户后台提供 |
| 商户密钥 KEY | 在后台填写并保存到 SQLite；已设置时留空保存不会覆盖原值，也可用 `YIPAY_KEY` / `EASYPAY_KEY` 作为兼容兜底 |
| 默认支付方式 | `wxpay` / `alipay` / `qqpay` / `bank` |
| 对外访问域名 | 用于生成 `notify_url` 和 `return_url`，生产必须是公网可访问 HTTPS 域名 |

客户流程：

1. 客户登录 `/u/<slug>`。
2. 选择礼物或输入金额，前端请求 `POST /api/employees/:slug/gifts/:id/pay`。
3. 服务端生成商户订单号 `out_trade_no`，按易支付文档 ASCII 参数排序 + MD5 签名，返回 `https://ezfp.cn/submit.php?...`。
4. 客户跳转易支付付款。
5. 易支付 GET 回调 `/api/pay/yipay/notify`；服务端校验 `sign`、`pid`、`money`、`trade_status=TRADE_SUCCESS`。
6. 验签成功后写入送礼记录、点亮礼物，并返回纯文本 `success`。

同步跳转 `/api/pay/yipay/return` 也会尝试验签和补点亮，但真实到账以异步通知为准；失败 / 金额不匹配 / 未知状态会回到员工页并显示不同提示。

有待支付订单时，后台会暂时禁止修改易支付网关、商户 ID 或支付方式，避免客户付款后回调无法验签；pending 订单不会被历史订单裁剪掉。

### 拉卡拉收款流程

后台 → 站点设置 → 拉卡拉。当前接入的是开放平台 Labs 动态二维码接口 `labs_dycode_create`，返回 `qrCodeUrl` 后客户会跳转到拉卡拉收银二维码页。

需要填：

| 字段 | 说明 |
|------|------|
| 启用开关 | 开启后且被选为当前收款通道时，客户才能创建拉卡拉订单 |
| 接口地址 | 默认生产 `https://s2.lakala.com/labs/txn/labs_dycode_create`；测试可填 `https://test.wsmsd.cn/sit/labs/txn/labs_dycode_create` |
| appId / serial_no | 拉卡拉开放平台分配的应用 ID 与接入方证书序列号 |
| 接入方私钥 | 用于 `LKLAPI-SHA256withRSA` 请求签名，已设置时留空保存不会覆盖 |
| 拉卡拉公钥 / 证书 | 用于验签拉卡拉响应与异步通知，已设置时留空保存不会覆盖 |
| 商户号 / 终端号 / 商户名称 | 动态二维码接口必填的 `mercId` / `termNo` / `merName` |
| 订单来源 | 拉卡拉分配的 `exterOrderSource` |
| 二维码有效期 | 60-300 秒 |

客户流程：

1. 客户登录 `/u/<slug>`。
2. 选择礼物，前端请求 `POST /api/employees/:slug/gifts/:id/pay`。
3. 服务端生成商户订单号，按拉卡拉文档 `appid\nserialNo\ntimestamp\nnonceStr\nbody\n` 进行 RSA-SHA256 签名。
4. 服务端请求拉卡拉动态二维码接口，验签响应后返回 `qrCodeUrl`。
5. 客户跳转拉卡拉付款。
6. 拉卡拉 POST 回调 `/api/pay/lakala/notify`；服务端验签、校验商户号 / 金额 / `payStatus=S` 后点亮礼物，并返回 `{ "code":"SUCCESS", "message":"执行成功" }`。

有待支付拉卡拉订单时，后台会暂时禁止修改拉卡拉网关、证书、商户号、终端号或订单来源，避免回调无法验签。

---

## 短信网关（腾讯云）

后台 → 站点设置 → 腾讯云 SMS。需要填：

| 字段 | 说明 |
|------|------|
| SecretId / SecretKey | 腾讯云访问密钥 |
| SmsSdkAppId | 短信应用 ID（如 `1400000000`） |
| Region | 默认 `ap-guangzhou` |
| SignName | 短信签名（已审核通过） |
| TemplateId | 短信模板 ID |
| 启用开关 | 开启后客户登录需验证码 |

**模板要求**：两个变量参数 — `{1}` = 验证码（6 位数字）、`{2}` = 有效分钟（固定 5）。

例：`您的验证码 {1}，{2} 分钟内有效，请勿告知他人。`

填完后可用"发测试短信"按钮验证配置。

---

## 状态文件

所有业务数据默认存在 `data/state.sqlite`，启动时自动创建；也可以用 `DATA_DIR=/path/to/dir` 指定数据目录。SQLite 中保存：

- `brandName` 站点名
- `defaultWechatPayUrl` 旧版默认微信收款链接（保留兼容，当前访客支付不再使用）
- `disabledGiftIds` / `giftOverrides` 礼物目录改动
- `smsConfig` SMS 网关配置（包含腾讯云 SecretKey 明文，**生产请确保数据库文件权限**）
- `paymentProvider` 当前收款通道（`yipay` / `lakala`）
- `yipayConfig` 易支付配置（包含商户 KEY；已设置时后台输入框留空不会覆盖，环境变量 `YIPAY_KEY` / `EASYPAY_KEY` 可作为兜底）
- `lakalaConfig` 拉卡拉配置（包含接入方私钥与拉卡拉公钥 / 证书；也可用 `LAKALA_*` 环境变量作为兜底）
- `employees` 员工（id / slug / passwordHash / role / 自己的灯牌 / 头像）
- `activities` 送礼记录（最多 1000 条，FIFO；带 employeeId / phone / 支付通道订单号）
- `customer_logins` 客户登录留痕（最多 1000 条，FIFO；带 phone / employeeId / method）
- `payment_orders` 支付订单（最多 1000 条，FIFO；pending / paid；pending 订单不会被裁剪）
- `passwordSalt` / `customerSecret` 服务自动生成的密钥盐

老版本的 `data/state.json` 启动时会自动迁移到 `data/state.sqlite`：旧的 lit / activities 全部归到默认 admin 名下。迁移后 `state.json` 只作为历史来源保留，不再作为主存储。

---

## 资源目录

```
public/
  assets/
    reference.jpg            背景氛围图
    gifts/<id>.png           礼物默认图
    gifts/custom-<id>.png    礼物自定义图（admin 上传）
    employees/<empId>/
      avatar.png             员工头像
```

---

## 开发约定

- **零外部依赖**，所有第三方接口（如腾讯云 SMS）走原生 HTTPS；本地持久化走 Node 内置 `node:sqlite`
- 后端 = `server.js` 单文件（约 900 行）
- 前端三个页面：[visitor.html](public/visitor.html) `+visitor.js`、[admin.html](public/admin.html) `+admin.js`、[no-access.html](public/no-access.html)
- 共享一份 [styles.css](public/styles.css)（白色主题）
- 鉴权：
  - 员工 / admin token = `base64(slug:password)`，每次请求即时验证（改密码即旧 token 全失效）
  - 客户 token = `base64(phone:hmac(phone, secret))`，无服务端会话存储

---

## 常见问题

**Q: 我把所有 admin 都关了 / 删了，进不去后台怎么办？**
A: 服务自带保护：不允许把唯一的 admin 改成 employee、不允许停用最后一个启用中的 admin、不允许删唯一 admin。如果还是进不去（比如手动改坏了数据库），停服 → 备份并删除 `data/state.sqlite` → 重启会按 `ADMIN_PASSWORD` 重新创建默认 admin。

**Q: 想给员工一个临时链接但只能访问一次？**
A: 暂未支持，详见 [TODO.md](TODO.md)。

**Q: 客户送礼后系统会自动跳转微信吗？**
A: 不再使用旧微信跳转。客户会先进入当前收款通道的收银台，只有异步回调验签成功后，系统才会自动点亮礼物。

**Q: 怎么备份数据？**
A: 备份 `data/state.sqlite` 和 `public/assets/employees/` 即可；如果设置了 `DATA_DIR`，请备份该目录下的 `state.sqlite`。

---

更多见 [DONE.md](DONE.md)（已完成功能清单）和 [TODO.md](TODO.md)（待办）。
