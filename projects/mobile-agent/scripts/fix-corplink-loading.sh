#!/bin/zsh

set -euo pipefail

APP="/Applications/CorpLink.app"
APP_SUPPORT="$HOME/Library/Application Support/CorpLink"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="$HOME/Library/Application Support/CorpLink-backup-$STAMP"

STATE_DIRS=(
  "Cache"
  "Code Cache"
  "GPUCache"
  "DawnCache"
  "Local Storage"
  "Session Storage"
  "blob_storage"
)

SINGLETON_FILES=(
  "SingletonCookie"
  "SingletonLock"
  "SingletonSocket"
)

if [[ ! -d "$APP_SUPPORT" ]]; then
  echo "未找到 CorpLink 本地数据目录: $APP_SUPPORT" >&2
  exit 1
fi

mkdir -p "$BACKUP_ROOT"

echo "关闭小米人..."
pkill -f "$APP/Contents/MacOS/CorpLink" || true
sleep 2

echo "备份前端缓存和状态到:"
echo "  $BACKUP_ROOT"

for name in "${STATE_DIRS[@]}"; do
  if [[ -e "$APP_SUPPORT/$name" ]]; then
    mv "$APP_SUPPORT/$name" "$BACKUP_ROOT/$name"
  fi
done

for name in "${SINGLETON_FILES[@]}"; do
  if [[ -L "$APP_SUPPORT/$name" || -e "$APP_SUPPORT/$name" ]]; then
    mv "$APP_SUPPORT/$name" "$BACKUP_ROOT/$name"
  fi
done

echo "重新启动小米人..."
open "$APP"

cat <<EOF
处理完成。

如果客户端卡在“初始化加载中…”，现在会重建前端本地状态。
保留项:
  Cookies
  config.json
备份目录:
  $BACKUP_ROOT
EOF
