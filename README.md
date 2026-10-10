# self-learning — MVP

Website học bằng PDF: upload → tổng quan → chọn đề mục → bài giảng tiếng Việt, công thức KaTeX, video YouTube và quiz riêng 5 câu. Next.js App Router + TypeScript + React; backend dùng Gemini SDK chính thức và YouTube Data API v3. Chưa có đăng nhập, database hoặc lưu tiến độ bền vững.

## Cấu hình và chạy

Yêu cầu Node.js 24 và npm. Tại thư mục project:

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Tự điền vào `.env.local` (giữ file này ngoài Git):

```dotenv
GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
YOUTUBE_API_KEY=your_youtube_key_here
```

- **Gemini:** tạo key ở [Google AI Studio](https://aistudio.google.com/apikey). `GEMINI_MODEL` là tùy chọn; mặc định model ở trên, phải có quyền sử dụng và hỗ trợ PDF/structured output. MVP giữ model đã chạy thành công; không tự đổi model, bật billing hay retry.
- **YouTube:** mở [Google Cloud Console](https://console.cloud.google.com/), chọn/tạo project → APIs & Services → Library → **YouTube Data API v3 → Enable** → Credentials → Create credentials → **API key**. Giới hạn API cho YouTube Data API v3. Nếu giới hạn ứng dụng cho key, dùng IP backend phù hợp; HTTP referrer dành cho browser không phù hợp request backend. Tìm video công khai chỉ cần key, không cần OAuth. Xem [hướng dẫn chính thức](https://developers.google.com/youtube/registering_an_application).
- Cả hai key chỉ dùng backend, có `server-only`. Không dùng tiền tố `NEXT_PUBLIC_`. `.env.example` chỉ chứa key trống. Sau khi đổi env, restart server. Môi trường deploy cần tự cấu hình các biến tương ứng.

```powershell
npm run dev
```

Mở [localhost:3000](http://localhost:3000); nếu cổng bận, xem cổng terminal in ra. Ctrl+C để dừng. Chạy production cục bộ:

```powershell
npm run build
npm start
```

## Kiểm tra

```powershell
npm run typecheck
npm test
npm run build
```

Các test không cần key, không gọi Google thật. Xem [MVP-QA.md](MVP-QA.md) để phân biệt kiểm chứng thực tế và lỗi được mô phỏng trong test.

Để tự kiểm tra giao diện:

1. Chọn PDF hợp lệ, không mật khẩu, dưới 10 MB → phân tích → đối chiếu tiêu đề, tóm tắt, đề mục và trang nguồn.
2. Mở đề mục: bài học và video tải song song. Xem mục tiêu, kiến thức, công thức/ký hiệu/đơn vị, ví dụ và nhầm lẫn. Ví dụ bổ sung được gắn nhãn riêng.
3. Chọn đủ 5 câu → nộp → xem điểm /10, đáp án và giải thích. Chuyển bài rồi quay lại: vẫn giữ đúng đáp án/điểm. Mở bài cũ không có POST thêm trong Network hoặc log backend. “Làm lại quiz” chỉ xóa đáp án/điểm của bài đó.
4. Video có thumbnail, tên kênh và link YouTube thật. Kiểm tra link mở đúng video; video mở tab mới, không nhúng player. Nút “Thử lại video” chỉ gọi YouTube, không gọi lại Gemini.
5. Quay lại tổng quan giữ phiên; chọn PDF khác xóa tổng quan, bài, quiz và video của tài liệu cũ. Reload cũng xóa phiên. Chuyển đề mục khi tải không được hiện nhầm kết quả.
6. File sai định dạng/rỗng/quá dung lượng/hỏng phải báo lỗi. Khi Gemini hoặc YouTube lỗi, thông báo phải hiện rõ và không fallback mẫu. Lỗi YouTube vẫn đọc bài/làm quiz được. Chỉ thao tác thử lại mới gọi thêm API cho lỗi đó.
7. Kiểm tra điện thoại 375px: mục lục cuộn ngang, nội dung một cột; công thức và bảng dài cuộn trong khung. Dùng Tab để kiểm tra thao tác bàn phím.

## Flow dữ liệu và file chính

### Frontend và phiên học

- `app/page.tsx`: giữ `File` PDF gốc trong RAM trình duyệt, điều khiển upload/loading/tổng quan/bài học, gọi endpoint và kiểm tra Zod trước khi render. File không tự lưu vào localStorage hoặc database.
- `app/components/document-overview.tsx`: tổng quan và nút mở đề mục thật.
- `app/components/lesson-view.tsx`: mục lục, bài giảng, quiz và kết quả. `math-text.tsx` + `lib/math-format.ts` hiển thị LaTeX bằng KaTeX; ghi nội dung model bằng text, không render HTML từ model.
- `app/components/topic-videos.tsx`: loading, lỗi/thử lại, rỗng hoặc tối đa 3 thẻ video.
- `lib/lesson-session.ts`: Map bài học/quiz theo topicId; dùng chung request đang chạy, không gọi lại bài đã tạo. `lib/video-session.ts` cache video riêng, kể cả kết quả rỗng/lỗi. Cả hai hủy request và bỏ phản hồi đến muộn khi đổi PDF, kể cả tài liệu mới có cùng topicId.
- `app/globals.css`: bố cục và responsive; `app/layout.tsx`: metadata, tiếng Việt và CSS KaTeX.

### Backend và Gemini

`File` → FormData trường `file` → POST `/api/analyze` → `app/api/analyze/route.ts` → `lib/analyze-handler.ts` → `lib/gemini.ts` → Zod `lib/analysis-schema.ts` → `{data}` → tổng quan.

Chọn đề mục → FormData gồm PDF gốc `file` + JSON `topic` (id, tên, mô tả, trang nguồn) → POST `/api/lesson` → `lib/lesson-handler.ts` → cùng model/cấu hình Gemini → `lib/lesson-schema.ts` → `{data}` → cache và bài học.

`lib/pdf-upload.ts` kiểm tra body stream, một file, kích thước, MIME, phần mở rộng, chữ ký PDF và dùng `pdf-lib` kiểm tra tài liệu đọc được/có trang. Tổng quan và bài học đều kiểm tra số trang nguồn không vượt PDF. Gemini nhận PDF inline base64, không chỉ tóm tắt. JSON Schema thu gọn hướng dẫn structured output; Zod kiểm tra đầy đủ chuỗi, số lượng, đúng đề mục, 5 quiz × 4 lựa chọn khác nhau, đáp án 0–3 và ID câu duy nhất. `lib/analysis-errors.ts` chuyển lỗi thành `{error:{code,message}}`; không trả key hoặc lỗi Google thô cho frontend.

### YouTube

Mở đề mục → JSON `{topicId,name,subject,concepts}` từ metadata đề mục → POST `/api/videos` → `lib/video-handler.ts` → `lib/youtube.ts` → YouTube `search.list` → Zod `lib/video-schema.ts` → cache video riêng. Request này không gửi PDF.

Query gồm tên đề mục, môn học và tối đa 6 từ khóa thêm từ mô tả; loại từ nối/trùng/toán tử. Dùng `type=video`, `part=snippet`, `maxResults=3`, `order=relevance`, `relevanceLanguage=vi`. Giữ thứ tự liên quan của YouTube; tiếng Anh và ngôn ngữ khác vẫn có thể xuất hiện. Tiêu đề/kênh/thumbnail/ID chỉ lấy từ API, giải mã ký tự HTML thành text; không để Gemini tạo link. Xem [search.list](https://developers.google.com/youtube/v3/docs/search/list).

### Quiz

`lib/lesson-schema.ts` chứa `gradeLesson`: đếm đáp án trùng `correctIndex`, mỗi câu 2 điểm. Chấm hoàn toàn trong code frontend; không gọi Gemini khi nộp. Câu hỏi, đáp án và giải thích do Gemini tạo riêng cho đề mục. Đây là quiz tự học, đáp án đã có trong dữ liệu frontend; không dùng cho thi có bảo mật đáp án. `lib/demo-data.ts` là dữ liệu cũ, không được import vào UI/API thật và không dùng làm fallback.

## Giới hạn MVP trước deploy

- PDF tối đa **10 MB**, multipart body tối đa 10 MB + 64 KB; request video JSON tối đa 8 KB. PDF hỏng/mật khẩu/không có trang bị từ chối. Parser xác minh khả năng đọc, không bảo đảm mọi trang có nội dung hữu ích.
- Gemini SDK timeout **90 giây**, frontend 110 giây; YouTube backend 15 giây, frontend 20 giây. Không retry tự động hoặc vô hạn. Hạn mức/model của tài khoản vẫn áp dụng.
- Cache chỉ trong RAM phiên tab; reload/đổi PDF mất tiến độ. Server không lưu PDF hoặc kết quả vào database; PDF và metadata được chuyển tới các dịch vụ tương ứng khi gọi API.
- AI có thể sai kiến thức, phép tính hoặc gán sai trang. Zod kiểm tra cấu trúc và phạm vi số trang, không chứng minh nội dung trên trang. Video là kết quả tìm kiếm, chưa duyệt chất lượng thủ công, có thể bị xóa/hạn chế sau đó.
- Chưa có xác thực, rate limit theo người dùng hoặc giới hạn chi phí ứng dụng. Backend công khai khi deploy có thể bị gọi để tiêu quota. Cần xác định cách kiểm soát quota và host phù hợp trước khi mở công khai.
- Host có thể đặt giới hạn body/timeout thấp hơn MVP. `maxDuration` trong route không bảo đảm host hỗ trợ 90 giây/10 MB. Chưa kiểm chứng trên host deploy hoặc kiểm thử tải nhiều người dùng.

## Git và bảo vệ dữ liệu riêng

`.gitignore` bỏ qua `.env*` (trừ `.env.example`), mọi PDF, `tmp/`, dependencies, build và cache TypeScript. PDF riêng dùng để kiểm tra không nằm trong commit. Không dùng `git add -f` cho file riêng. Trước commit:

```powershell
git add .
npm run check:secrets
git diff --cached --stat
git commit -m "Finalize self-learning MVP"
```

`scripts/audit-secrets.mjs` kiểm tra chính nội dung staged, chặn env/PDF/tmp, key Google thật hoặc key đang cấu hình, đồng thời kiểm tra assets frontend đã build. Chỉ in tên file vi phạm, không in key. Đây là kiểm tra hỗ trợ, không thay thế việc rà soát các secret khác. Chạy build trước để kiểm tra assets mới nhất.

Các script `scripts/diagnose-pdf.mjs`/`diagnose-lesson.mjs` hỗ trợ kiểm chứng PDF riêng đặt cục bộ; kết quả nằm trong `tmp/diagnostics/`, không dùng làm fallback. `GEMINI-DIAGNOSIS.md` giữ lịch sử chẩn đoán, không phải báo cáo trạng thái hiện tại.
