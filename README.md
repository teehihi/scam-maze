# SCAMMAZE

Landing page cho **SCAMMAZE** — tập nhận diện bẫy lừa đảo Internet bằng tình huống tương tác, sau đó áp dụng checklist kiểm tra trước khi hành động ngoài đời. Dự án tham dự **Kiroween**.

**Vòng lặp:** học tình huống → quan sát tín hiệu → áp dụng checklist.

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · pnpm

## Chạy local

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # typecheck + build ra dist/
pnpm preview
```

Yêu cầu Node.js >= 22.12.

## Cấu trúc

- `src/data/scenario.ts` — kịch bản demo phân nhánh (dữ liệu giả lập)
- `src/lib/urlCheck.ts` — heuristics URL xác định, chỉ phân tích chuỗi, không gọi mạng
- `src/components/` — các section của landing page
- `.kiro/steering/safety.md` — quy tắc: không bao giờ khẳng định URL "an toàn"

## Deploy

Workflow `.github/workflows/deploy.yml` build và deploy lên GitHub Pages khi push vào `main`
(bật Settings → Pages → Source: GitHub Actions).

## Lưu ý an toàn

Mọi tên miền trong demo đều giả lập và không bao giờ được truy cập. Công cụ kiểm tra URL chỉ nêu tín hiệu; "chưa thấy tín hiệu xấu" không có nghĩa là an toàn.

## Đóng góp

- [CONTRIBUTING.md](CONTRIBUTING.md) — cách cài đặt, quy trình branch/PR, quy tắc an toàn khi viết kịch bản
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — quy tắc ứng xử
- [SECURITY.md](SECURITY.md) — báo cáo lỗ hổng bảo mật (không mở issue công khai)
- [ACCESSIBILITY.md](ACCESSIBILITY.md) — cam kết và giới hạn về khả năng tiếp cận

## Giấy phép

[MIT](LICENSE) © 2026 SCAMMAZE contributors
