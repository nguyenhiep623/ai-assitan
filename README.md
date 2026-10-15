# Trợ lý phát triển (ứng dụng macOS)

Quả cầu hạt tương tác + trợ lý phát triển cá nhân. Chat chạy bằng **Claude Code CLI** trên máy bạn (dùng tài khoản Claude đã đăng nhập, không cần API key). Giọng nói dùng lệnh `say` của macOS.

## Yêu cầu
1. **Node.js** 18+ (`node -v`).
2. **Claude Code** đã cài và đăng nhập: mở Terminal, chạy `claude`, đăng nhập một lần.
3. **Giọng tiếng Việt** (để nghe đọc): Cài đặt hệ thống → Trợ năng → Nội dung được đọc → Giọng nói hệ thống → Quản lý giọng nói → Tiếng Việt (Linh).

## Chạy
```bash
cd /Users/hiepnguyen/5_AI/claude/ai-assistant
npm install
npm start
```

## Đóng gói thành app (.dmg)
```bash
npm run dist     # file nằm trong thư mục dist/
```
App chưa ký số: lần đầu mở, chuột phải → Mở.

## Chi phí / token
- Chat tốn lượng dùng của tài khoản Claude bạn đã đăng nhập vào Claude Code. App hiển thị số token thực tế của mỗi lượt ở cuối khung phản hồi.
- Claude Code luôn gửi thêm một phần nền (prompt hệ thống, công cụ) nên mỗi lượt thường tốn nhiều hơn gọi API trần. App đã tắt công cụ, MCP, hook và lịch sử phiên để giảm tối đa.
- Lệnh `/…`, bấm quả cầu và giọng nói **không** tốn token.

## Cấu hình (tùy chọn)
Tạo `~/Library/Application Support/Trợ lý phát triển/config.json`:
```json
{
  "claudePath": "/Users/ban/.local/bin/claude",
  "models": { "quick": "haiku", "default": "sonnet", "complex": "opus" },
  "voice": "Linh"
}
```
- `claudePath`: chỉ cần khi app không tự tìm thấy `claude`. Xem đường dẫn bằng `which claude`.
- `models`: model cho từng chế độ (mặc định chế độ Nhanh = haiku).
- `voice`: tên giọng; xem danh sách bằng `say -v '?'`.

## Lỗi thường gặp
- "Không tìm thấy Claude Code": đặt `claudePath` như trên.
- "Chưa đăng nhập": chạy `claude` trong Terminal và đăng nhập.
- Không có tiếng: cài giọng Vietnamese (mục Yêu cầu).
