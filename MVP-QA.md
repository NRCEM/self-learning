# MVP verification

## Đã kiểm chứng với dịch vụ thật

- Trình duyệt upload `06_light.pdf` (PDF vật lý 3 trang) → tổng quan đúng tài liệu → bài khúc xạ → 3 video YouTube thật → nộp quiz, thấy điểm, đáp án và giải thích.
- Chuyển sang phản xạ toàn phần, chọn một đáp án, quay lại khúc xạ: vẫn giữ điểm đã nộp. Mở lại phản xạ: giữ đúng một lựa chọn, không lấy điểm bài trước. Log không có thêm POST lesson/videos khi mở lại.
- Lượt kiểm tra chính: tổng quan khoảng 2,4 giây; bài khúc xạ khoảng 7,2 giây; phản xạ toàn phần khoảng 9,2 giây; tìm YouTube khoảng 0,3 giây. Đây là số đo từng lượt, không phải SLA.
- Các video có thumbnail tải được và href dạng `https://www.youtube.com/watch?v=<ID>` từ API. Có cả video Việt và Anh. Không kiểm tra phát trọn từng video hoặc tính chính xác của toàn bộ nội dung video.
- Đổi PDF sang file chỉ trích trang cuối của chính PDF thật: tổng quan còn một đề mục tán sắc, nguồn trang 1; bài và video tải mới, 5 câu quiz mới, chưa chọn/nộp. Không còn bài/điểm khúc xạ hay phản xạ toàn phần. File trích nằm trong `tmp/`, không commit.
- Mobile viewport 375 × 812: sidebar cuộn ngang; nội dung, quiz và video không tràn trang; 53 biểu thức KaTeX trên bài khúc xạ không có `.katex-error`. Không kiểm chứng mọi kích thước thiết bị hoặc mọi công thức model có thể sinh.
- Browser: file `.txt`, PDF rỗng và PDF có chữ ký nhưng bị hỏng đều báo lỗi rõ. PDF hỏng có nút thử lại; thử lại vẫn báo đúng lỗi và không gọi Gemini.
- Bản production cục bộ ở cổng riêng, cố ý để key trống trong process (không sửa `.env.local`): upload PDF thật → thông báo thiếu Gemini key → thử lại được, giữ file. Endpoint YouTube trả 503 `MISSING_YOUTUBE_KEY`, không lộ key. Server kiểm tra đã dừng.

## Test tự động / kiểm tra code

- Typecheck, 44 test và production build thành công.
- Test các giới hạn upload/stream, schema tổng quan/bài/video, số trang nguồn, quiz 5 × 4, đáp án và chấm điểm.
- Test dedup request, cache rỗng/lỗi video, retry, phản hồi ngược thứ tự, đổi tài liệu hủy và bỏ kết quả cũ (kể cả cùng topicId).
- Gemini 429/503/504, YouTube quota/API/mạng lỗi và dữ liệu sai được mô phỏng tại biên generator/fetch. Không cố tình làm hết quota hoặc gây outage Google. Nhánh video thiếu key và quiz độc lập cũng đã kiểm chứng trên trình duyệt ở chặng trước.
- Audit Git kiểm tra staged files và assets frontend: env thật, key đang cấu hình và PDF riêng không được đưa vào commit. Diagnostics/ảnh/PDF nằm ngoài Git.

## Sửa trong đợt chốt MVP

- Đưa parser PDF vào validation chung: cả tổng quan và bài học đều từ chối PDF hỏng/mật khẩu/không có trang trước Gemini.
- Kiểm tra trang nguồn tổng quan không vượt số trang PDF.
- Cho phép chọn lại cùng file trong ô upload, tránh input không phát sự kiện change.
- Giải mã ký tự HTML trong tiêu đề/kênh YouTube thành text (ví dụ `&#39;` → dấu nháy); không render HTML.
- Bỏ qua mọi PDF và `tmp/` trong Git; thêm lệnh audit secret trước commit, README cập nhật MVP.

## Chưa kiểm chứng

Chưa deploy lên host, chưa đo giới hạn body/timeout của host, load test nhiều người dùng, rate limit/bảo vệ quota ứng dụng, kiểm chứng lỗi Google thật ở lượt audit này hoặc duyệt đúng/sai toàn bộ kiến thức AI. Chưa kiểm tra PDF mật khẩu bằng file riêng; nhánh parser từ chối đã được đọc code. Chưa có đăng nhập/database/lưu tiến độ qua reload. Full flow thành công được kiểm tra trên dev server; production đã build và kiểm tra nhánh lỗi cấu hình riêng.
