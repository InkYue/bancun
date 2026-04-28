#!/bin/bash
# 双击即启动半寸时光礼物单服务
# 关闭服务：在窗口里按 Ctrl+C，或直接关掉这个窗口

set -e
cd "$(dirname "$0")"

clear
cat <<'BANNER'
╔════════════════════════════════════════════╗
║                                            ║
║       半 寸 时 光  ·  礼 物 单             ║
║                                            ║
╚════════════════════════════════════════════╝
BANNER

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "✗ 没找到 node 命令"
  echo "请先去 https://nodejs.org 装 LTS 版本，再双击本脚本。"
  echo
  read -n 1 -s -r -p "按任意键关闭…"
  exit 1
fi

echo
echo "Node 版本：$(node --version)"
echo

# 拿一下局域网 IP，方便手机扫码看 H5 真机效果
LAN_IP=$(ifconfig 2>/dev/null | grep -E 'inet (192|10|172)' | awk '{print $2}' | head -1)

echo "─────────────────────────────────────────────"
echo "本机访问"
echo "  游客页：http://localhost:5173"
echo "  后台 ：http://localhost:5173/admin"
echo "  口令 ：bancun-admin"
if [ -n "$LAN_IP" ]; then
  echo
  echo "手机/平板（同一 Wi-Fi）"
  echo "  http://${LAN_IP}:5173"
fi
echo "─────────────────────────────────────────────"
echo
echo "启动中…（按 Ctrl+C 或关掉窗口即停止）"
echo

# 用浏览器自动打开游客页（macOS 自带 open）
( sleep 1 && open "http://localhost:5173" ) &

# 启动服务（前台运行，方便你看日志）
exec node server.js
