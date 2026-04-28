# 半寸时光甜蜜礼物单

一个零依赖的 Node 单文件礼物点亮系统：

- **每位员工**有专属访问链接 `/u/<slug>` 和登录密码（slug 可自动生成）
- **客户**用手机号进入员工页面送礼（admin 选填腾讯云 SMS 后强制验证码）
- **后台**：仪表盘 / 我的页面 / 员工管理 / 礼物目录 / 送礼记录 / 客户登录 / 站点设置
- **角色**：`admin`（管理全站）、`employee`（仅管理自己），admin 至少保留 1 名
- **配色**：游客侧暖色系深色甜蜜风（中式氛围图 + 月亮装饰 + 礼物金粉光晕）、后台白色管理风，互不影响
- **响应式**：H5 移动端 + PC，安全区适配（iPhone notch / 底部 home indicator）
- **零依赖**：纯 Node 内置库（`http` / `https` / `crypto`），腾讯云 SMS 走原生 TC3-HMAC-SHA256 签名 HTTPS

> ⚠️ 当前的"我已完成支付"是**荣誉制点亮**，不是真实到账确认。详见下方 [支付确认现状](#支付确认现状)。

---

## 快速开始

需要 Node 20+，零依赖（内置 `http` / `https` / `crypto`）。

```bash
# 启动开发
npm run dev
# 或
node server.js

# 自定义端口 / 默认 admin 密码 / 默认收款链接
PORT=8080 ADMIN_PASSWORD="my-strong-password" \
WECHAT_PAY_URL="weixin://wxpay/bizpayurl?pr=xxx&amount={amount}" \
node server.js
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
| `employee` | 仪表盘、我的页面 | 只能管自己（链接、收款码、密码、灯牌全熄） |

**点亮 / 熄灭逻辑**：

- 灯牌的"点亮"由**客户送礼**触发（`POST /api/employees/:slug/gifts/:id/light`）
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
| 我的页面 | 个人访问链接 + 复制 / 头像 / 收款码 / 个人资料 / 修改密码 / 一键全部熄灭 | 全部 |
| 员工管理 | 列表 + 搜索 + 角色筛选 + 新增 / 编辑（含 slug 自动生成）/ 上下线 / 代上传 QR / 代熄灭 / 删除 / **复制链接** | admin |
| 礼物目录 | 16 个礼物的上下线 / 编辑名称价格 / 替换图 / 恢复默认 | admin |
| 送礼记录 | 完整流水表格 + 员工筛选下拉（含全站汇总）+ 关键字搜索 + 单条删除 + 按筛选清空 | admin |
| 客户登录 | 每次客户手机号登录的留痕 + 4 张 KPI（总登录数 / 客户去重数 / 今日新登录 / SMS 登录占比） | admin |
| 站点设置 | 站点名 / 默认收款链接 / 腾讯云 SMS 配置（含发测试短信）/ 危险区一键全站熄灭 | admin |

---

## 支付确认现状

> **重要：当前是荣誉制点亮，不是真实到账确认。**

| 当前能做 | 当前做不到 |
|---------|----------|
| 上传**收款码图片**（弹层显示二维码 + 金额） | 不知道客户付了没、付了多少、是否真到账 |
| 配 `weixin://wxpay/bizpayurl?pr=...` 跳转链接 | 没有微信回调、订单绑定、自动验签 |
| 客户点"我已完成支付" → 写一条流水 + 点亮 | 防止"没付钱也点亮"（理论可作弊） |

**要做到自动确认到账**，必须接微信支付商户号（mch_id）+ APIv3 + Native 下单 + 回调验签。详细实施计划见 [TODO.md](TODO.md) 的 P1 一节"接入真实微信支付"。

**过渡方案（无须商户号）**：把"我已完成支付"按钮改成"上传支付截图"，admin 在后台核单后再点亮。约 1-2 天可落。

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

所有数据存在 `data/state.json`，启动时自动创建。包含：

- `brandName` 站点名
- `defaultWechatPayUrl` 默认收款链接（员工没填自己的就用这个）
- `disabledGiftIds` / `giftOverrides` 礼物目录改动
- `smsConfig` SMS 网关配置（包含 SecretKey 明文，**生产请确保该文件权限**）
- `employees[]` 员工（id / slug / passwordHash / role / 自己的灯牌 / QR / 头像）
- `activities[]` 送礼记录（最多 1000 条，FIFO；带 employeeId / phone）
- `customerLogins[]` 客户登录留痕（最多 1000 条，FIFO；带 phone / employeeId / method）
- `passwordSalt` / `customerSecret` 服务自动生成的密钥盐

老版本的 `state.json`（v1 schema，单页面无员工）启动时会自动迁移：旧的 lit / activities 全部归到默认 admin 名下。

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
      wechat-qr.png          员工收款码
```

---

## 开发约定

- **零外部依赖**，所有第三方接口（如腾讯云 SMS）走原生 HTTPS
- 后端 = `server.js` 单文件（约 900 行）
- 前端三个页面：[visitor.html](public/visitor.html) `+visitor.js`、[admin.html](public/admin.html) `+admin.js`、[no-access.html](public/no-access.html)
- 共享一份 [styles.css](public/styles.css)（白色主题）
- 鉴权：
  - 员工 / admin token = `base64(slug:password)`，每次请求即时验证（改密码即旧 token 全失效）
  - 客户 token = `base64(phone:hmac(phone, secret))`，无服务端会话存储

---

## 常见问题

**Q: 我把所有 admin 都关了 / 删了，进不去后台怎么办？**
A: 服务自带保护：不允许把唯一的 admin 改成 employee、不允许停用最后一个启用中的 admin、不允许删唯一 admin。如果还是进不去（比如手动改坏了 state.json），停服 → 删除 `data/state.json` → 重启会按 `ADMIN_PASSWORD` 重新创建默认 admin。

**Q: 想给员工一个临时链接但只能访问一次？**
A: 暂未支持，详见 [TODO.md](TODO.md)。

**Q: 客户送礼后系统会自动跳转微信吗？**
A: 看员工配置：
- 上传了**收款码图片** → 弹层显示二维码 + 金额，客户长按扫码
- 没收款码但配了**微信跳转链接**（含 `{amount}` 占位符） → 直接 `weixin://` 跳转
- 都没配 → 仅点亮灯牌，不跳转

**Q: 怎么备份数据？**
A: 备份 `data/state.json` 和 `public/assets/employees/` 即可。

---

更多见 [DONE.md](DONE.md)（已完成功能清单）和 [TODO.md](TODO.md)（待办）。
