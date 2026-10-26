# GCCK Thắng Lợi — Hệ Thống Điều Hành Sản Xuất Tinh Gọn (Lean MES v2.0)

Ứng dụng Web Full-Stack điều hành phân xưởng Gia công Cơ khí Chính xác (14–20 nhân sự), kế thừa **100% dữ liệu & tính năng nghiệp vụ** từ hệ thống Google Apps Script cũ (`MES 2027 - GCCK Thắng Lợi`) đồng thời hiện thực hóa trọn vẹn **7 Trụ Cột Quản Trị Xưởng Hiện Đại** trong tài liệu `GCCK.docx`.

## Khởi chạy nhanh (Windows / Node.js v24+)

```powershell
# 1. Chạy chế độ Phát triển (Backend API port 3001 + Vite HMR port 5173)
npm run dev

# 2. Hoặc Build & Chạy Production trong 1 tiến trình duy nhất (http://localhost:3001)
npm run build
npm start
```

> Lần chạy đầu tiên, hệ thống tự động khởi tạo cơ sở dữ liệu `data/gcck_mes.sqlite` (chế độ `WAL` tốc độ cao từ `node:sqlite` tích hợp sẵn trong Node.js 24, không cần cài C++ Build Tools) và nạp sạch **100% dữ liệu thật** từ `data/seed_gcck_1233.json` (16 nhân sự, 23+ máy gia công, 63 mã dao/chíp, 334 thành phẩm, 627 nguyên công, 189 đơn hàng PO, 16 bảng công).

## 4 Không Gian Giao Diện Thích Ứng (Adaptive Shells)

- **`/worker` — Cổng Công Nhân (Mobile Shopfloor HMI `360px–430px` & Tablet):**
  - Thiết kế cảm ứng công nghiệp (`>= 52px`), quét mã QR 1 chạm, tính nhẩm lương khoán `1 + 0.33 máy` trực tiếp trên thanh Sticky Header, bấm giờ dừng máy bền vững (`localStorage`), tự kiểm `★`, duyệt con đầu `FAI`, đổi chíp dao `1-đổi-1`, nén ảnh hiện trường & hàng đợi Offline khi rớt Wi-Fi xưởng.
- **`/admin` — Trung Tâm Điều Hành Quản Đốc (Full-Width Desktop `1280px–1920px+`):**
  - 6 phân hệ chuyên sâu + Tìm kiếm toàn cục `Ctrl+K`:
    1. `Điều Độ & Tải Máy`: KPI thời gian thực, cân bằng tải 23+ máy, phát hiện cổ chai `>100%`, gom phôi SMED, lịch ca `🌙 Lights-out`, tiến độ WIP trọng số chuẩn.
    2. `Lệnh PO & Phiếu QR`: Quản lý đủ 189+ PO, xuất giao hàng từng đợt, truy vết lô phôi, mở in Phiếu Công Nghệ QR.
    3. `Nhật Ký SX, QA/QC 3 Tầng & Truy Vết`: Xem ảnh/bàn giao ca, sửa/hủy phiếu tính lại lương & tồn kho, duyệt `FAI/IPQC/OQC`, truy vết 4 tầng theo PO, xuất Excel 17 cột.
    4. `Báo Giá, Giá Thành & Lãi/Lỗ`: Đối soát 334+ SP (chống lãi ảo WIP `SP095`), cập nhật giá phôi & gia công ngoài (nhiệt luyện/mạ), xuất Excel 19 cột.
    5. `Chấm Công Thông Minh & Lương KPI 3P`: 6 thẻ Radar 1-click, ma trận 31 ngày mượt 60fps, điền nhanh hàng loạt, lũy kế 12 tháng, quyết toán Lương 3P tổng hợp & xuất Excel 4 Sheet.
    6. `Danh Mục Master & Hệ Thống`: CRUD 627+ nguyên công (`Setup + Cycle`), nạp/tải mẫu Excel `.xlsx`, quản lý máy/tủ dao/nhân sự PIN `scrypt`, bật/tắt `Strict PIN Mode`, cấu hình đồng bộ ngầm Google Apps Script `/exec` & Telegram Bot.
- **`/andon` — Màn Hình Tivi Xưởng 55 Inch (`1920×1080` Kiosk):**
  - Sơ đồ live 23+ máy 5 trạng thái màu, cảnh báo PO gấp/trễ hạn, và Bảng vàng thi đua Giờ định mức thợ (ẩn 100% tiền lương VNĐ cá nhân).
- **`/print/traveler/:poId` — In Phiếu Công Nghệ QR (`A4 / A5`):**
  - Bản in kỹ thuật trắng-đen chống lóa bọc túi nilon với mã QR vector `<svg>` riêng cho từng bước nguyên công (`GCCK|<poId>|<ncId>`).

## Kiểm thử Tự động

```powershell
npm run typecheck      # Kiểm tra TypeScript strict (0 lỗi)
npm test               # Chạy 52 bài Unit & API Integration Tests (Vitest)
npx playwright test    # Chạy 5 kịch bản E2E trình duyệt thật (Mobile 360px + Desktop 1920px + TV + Print + RBAC)
```

