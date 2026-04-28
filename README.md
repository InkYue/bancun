# 半寸时光甜蜜礼物单

一个可直接运行的 Node/Bun 礼物点亮项目，包含游客送礼页和管理员后台。

## 功能

- 全局背景音乐开关（右上角音量按钮，WebAudio 生成，无需音频文件）
- 16 个礼物，每个礼物拥有独立专属音效
- 游客输入金额后自动匹配礼物，点击后跳转微信收款地址并点亮图标
- 图标默认暗色，点亮后发光
- 管理员后台可编辑“半寸时光”名字栏
- 管理员后台可一键重置全部礼物为暗态
- 管理员后台可逐个自定义商品名称、商品图片、礼物触发音乐
- 管理员后台可上传自定义背景音乐
- 支持沿用甲方图片：将素材放入 `public/assets/` 即可替换

## 启动

```bash
npm run dev
```

或使用 Bun：

```bash
bun run dev:bun
```

访问：

- 游客页：`http://localhost:5173`
- 后台页：`http://localhost:5173/admin`（独立后台地址，游客页不提供入口）

默认后台口令：`bancun-admin`

后台可配置：

- 名字栏与微信收款跳转地址
- 背景音乐文件（支持 MP3 / WAV / OGG）
- 每个礼物的商品名称、图片（PNG / JPG / WebP / SVG）和触发音乐（MP3 / WAV / OGG）

生产环境建议设置：

```bash
ADMIN_TOKEN="your-strong-token" WECHAT_PAY_URL="weixin://wxpay/bizpayurl?pr=your-code&amount={amount}&gift={giftName}" npm run start
```

微信收款地址支持占位符：

- `{amount}` 礼物金额
- `{giftName}` 礼物名称
- `{giftId}` 礼物 ID

## 素材替换

详见 `public/assets/README.md`。

> 当前首版使用 CSS 氛围图和 emoji 作为兜底，正式交付时把甲方原图/切图放到 `public/assets/reference.jpg` 与 `public/assets/gifts/*.png` 即可沿用原素材。
