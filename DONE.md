# 已完成功能清单

> 截至 2026-04-28 的实现状态。新功能上线请同步追加。

## v0.3 · 多员工 + 客户身份化（当前版本）

### 路由 / 多租户
- [x] `/u/<slug>` 员工专属客户页（slug 不存在 / 已下架 → 404 无法连接页）
- [x] `/admin` 后台登录入口
- [x] `/`、其他未匹配路径 → 无法连接页（不再有公开主页）
- [x] `data/state.json` v1 schema 自动迁移到 v2（保留旧数据，归到默认 admin）

### 员工 / 角色
- [x] 员工实体：slug + name + role + password + avatar + 自己的收款码 + 自己的 wechatPayUrl + intro + litGiftIds
- [x] 角色：`admin`（管全站）/ `employee`（仅管自己）
- [x] 至少保留一名启用中的 admin（删除 / 停用 / 降权保护）
- [x] 员工管理视图：搜索 / 角色筛选 / 创建 / 编辑 / 启停 / 删除
- [x] admin 代员工：上传收款码、一键熄灭

### 客户身份
- [x] 手机号格式校验（前端 + 后端 11 位中国大陆 1[3-9]\d{9}）
- [x] 手机号绑定身份，全站共用一个客户 token（HMAC + customerSecret）
- [x] SMS 关闭：填手机号即可登录
- [x] SMS 开启：发码 / 验证 / 60s 重发冷却（前端） + 5min 服务端有效期
- [x] 客户登出按钮（hero 卡片右上角）
- [x] 送礼记录的 phone 字段，admin 看到掩码后的 `138****8000`

### 后台控制台
- [x] 顶栏（品牌 + 同步状态 + 角色 chip + 刷新 + 退出）
- [x] 侧边栏（角色感知 — employee 看不见 admin-only 入口）
- [x] 仪表盘：累计 / 总次数 / 今日 / 员工启用比 (admin) / 已点亮比 (employee) + 礼物分布 + 最近送礼
- [x] 我的页面：访问链接 + 一键复制 / 个人资料 / 头像上传 / 我的收款码 / 修改密码 / 一键全部熄灭
- [x] 员工管理（仅 admin）
- [x] 礼物目录（仅 admin）：搜索 / 分类筛选 / 上下线 / 编辑 / 替换图 / 恢复默认（移除了之前的"单条点亮 chip"）
- [x] 送礼记录（仅 admin）：员工筛选下拉（含"全站汇总"）+ 搜索 + 按筛选清空
- [x] 站点设置（仅 admin）：站点名 / 默认收款链接 / SMS 配置 / 测试短信

### SMS 网关
- [x] 后台 SMS 配置 UI：开关 + SecretId/SecretKey/SdkAppId/Region/SignName/TemplateId
- [x] SecretKey 留空保留原值（避免每次保存都要重填）
- [x] SecretId 默认掩码显示 `xxxx****xxxx`
- [x] 服务端原生 HTTPS + TC3-HMAC-SHA256 签名调用 `sms.tencentcloudapi.com`（零依赖）
- [x] 前后端"实际启用"判定：开关 + 6 个字段必须都全
- [x] 客户登录接口根据 `smsRequired` 自动切换流程

### 鉴权
- [x] 员工 token：base64("slug:password")，每次请求重新校验（密码改 → 旧 token 立即失效）
- [x] 客户 token：base64("phone:hmac(phone, customerSecret)")，无服务端会话
- [x] 角色保护：admin-only API 返回 403；客户 API 未登录返回 401
- [x] 密码 sha256(salt + password)，盐随实例生成存于 state.json

### 视觉
- [x] **整体白色配色**（visitor + admin + no-access 同一主题）
- [x] 樱粉 (`#e85f7c`) 主色 + 金色点缀，移除暗色风
- [x] 移动端：客户页 + 后台侧边栏抽屉
- [x] 礼物卡片：暗态 grayscale → 亮态粉金光晕

### 数据保护
- [x] 删除员工 → 自动清理头像 / QR 文件 + 该员工的全部 activities
- [x] activities 上限 1000 条，FIFO
- [x] 60s SMS 重发冷却防滥用

---

## v0.2 · 后台控制台升级（已被 v0.3 覆盖重写）

历史变更，不再重复。

---

## v0.1 · 初版（已被 v0.3 覆盖重写）

- 单页面 + 单 admin token + 全站共享灯牌；现已重构为多员工模型。
