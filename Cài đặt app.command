#!/bin/bash
# Đóng gói "Trợ lý phát triển" thành app và đưa vào Applications. Chỉ cần chạy 1 lần (nhấp đúp file này).
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1

if ! command -v npm >/dev/null; then
  echo "Chưa có Node.js. Cài tại https://nodejs.org (bản LTS) rồi chạy lại file này."; read -n1 -p "Nhấn phím bất kỳ để đóng..."; exit 1
fi
echo "▸ Cài thư viện (lần đầu mất vài phút)..."
npm install || { echo "npm install lỗi."; read -n1 -p "Nhấn phím bất kỳ để đóng..."; exit 1; }
echo "▸ Đóng gói app..."
rm -rf dist
npm run dist || { echo "Đóng gói lỗi."; read -n1 -p "Nhấn phím bất kỳ để đóng..."; exit 1; }
APP=$(find dist -maxdepth 2 -name "*.app" -type d | head -1)
[ -z "$APP" ] && { echo "Không thấy file .app trong dist/."; read -n1 -p "Nhấn phím bất kỳ để đóng..."; exit 1; }
codesign --force --deep --sign - "$APP" 2>/dev/null
DEST="/Applications/$(basename "$APP")"
rm -rf "$DEST"; cp -R "$APP" "$DEST" || { echo "Không chép được vào /Applications."; exit 1; }
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null
echo "✔ Xong: $DEST"
echo "Mở bằng Launchpad / Spotlight (gõ 'Trợ lý'), hoặc kéo biểu tượng vào Dock."
open "$DEST"
