# 素材替换说明

当前项目已经按甲方截图做了暗金玫瑰风格和 emoji 兜底图标。要“沿用”甲方提供的正式图片素材时，直接把文件放到这些位置即可：

- 背景/整张参考图：`public/assets/reference.jpg`
- 16 个礼物图标：`public/assets/gifts/{gift-id}.png`
- 可选音频素材：`public/assets/audio/`

后台上传的素材会自动保存到：

- 自定义商品图片：`public/uploads/gifts/`
- 自定义商品音乐和背景音乐：`public/uploads/audio/`

手动放入 `public/assets/` 的文件适合做默认素材；后台上传适合日常运营修改。

礼物 ID 对应关系：

1. `lollipop` 棒棒糖
2. `tiramisu` 提拉米苏
3. `confession-bouquet` 告白花束
4. `strawberry-cake` 草莓蛋糕
5. `dreamcatcher` 捕梦网
6. `hot-air-balloon` 热气球
7. `bear-box` 小熊礼盒
8. `ferrari` 法拉利
9. `diamond-ring` 永恒钻戒
10. `ferris-wheel` 摩天轮
11. `cupid-arrow` 爱神之箭
12. `carousel` 旋转木马
13. `unicorn` 梦幻独角兽
14. `sweet-date` 甜蜜约会
15. `romantic-castle` 浪漫城堡
16. `world-tour` 环游世界
