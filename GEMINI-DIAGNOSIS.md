# Chẩn đoán Gemini — 09/10/2026

## Cập nhật: kiểm chứng chính 06_light.pdf và sửa model

Phần này thay thế kết luận chưa kiểm tra PDF riêng trong báo cáo lịch sử bên dưới.

File thực tế: 214.506 byte, 3 trang, không mã hóa. SHA-256: `a0f745446e6768ca219247255b6821eb6be4b600e79f309bf76eca79c2a8a0d0`.

| Đường gọi | Model | Kết quả trên cùng PDF |
| --- | --- | --- |
| Lượt người dùng vừa gửi trên web | gemini-3.8-flash | HTTP 503 / UNAVAILABLE sau 54,626 giây; message: `This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.` |
| Script trực tiếp, gọi chính `analyzePdf` của backend | gemini-3.8-flash | HTTP 503 / UNAVAILABLE, cùng message, sau 3,963 giây |
| Script gửi multipart qua endpoint web | gemini-3.8-flash | Google HTTP 504 / DEADLINE_EXCEEDED sau 89,639 giây: `Deadline expired before operation could complete.` Backend cũ map thành HTTP 502 GEMINI_SERVER_ERROR |
| Script trực tiếp, chỉ thay model | gemini-3.5-flash-lite | Thành công 3,680 giây; `Physics 4C Worksheet 06`, môn Physics, 4 đề mục; schema hợp lệ |
| Endpoint sau khi sửa cấu hình model | gemini-3.5-flash-lite | HTTP 200, 3,516 giây; 4 đề mục, schema hợp lệ |
| Trình duyệt chọn chính file rồi bấm phân tích | gemini-3.5-flash-lite | HTTP 200, 5,6 giây; tổng quan render đúng worksheet và đề mục vật lý cùng trang nguồn |

Đã kiểm tra DOM và ảnh giao diện `tmp/diagnostics/06-light-frontend.jpg`. Kết quả trực tiếp và endpoint lưu tại `tmp/diagnostics/`, được Git bỏ qua. Không đưa kết quả này vào frontend như mock hoặc fallback.

### Đối chiếu payload và timeout

- Script `diagnose-pdf.mjs` gọi đúng hàm production `lib/gemini.ts`, không tự dựng prompt/config riêng. Script và endpoint đọc cùng bytes PDF, cùng base64 `application/pdf`, cùng prompt tiếng Việt, system instruction và `analysisJsonSchema`. Chỉ model thay đổi trong phép thử đối chứng.
- SDK `@google/genai`: timeout 90.000 ms, attempts 1, maxOutputTokens để mặc định model, không thêm thinking config. Direct có signal ngoài 110.000 ms; script endpoint và frontend có timeout 110.000 ms; route maxDuration 120 giây. Không tăng timeout hoặc thêm retry để che lỗi.
- Script cũ `diagnose-gemini.mjs` dùng PDF mẫu, prompt khác, không system instruction, maxOutputTokens 2048, timeout 45/90 giây. Kết quả cũ không chứng minh file người dùng chạy được; lần kiểm tra mới loại bỏ các khác biệt đó.

### Nguyên nhân và sửa đổi

Lỗi được tái hiện tại API Gemini bằng file thật ngay khi gọi trực tiếp; không cần frontend để xảy ra lỗi. Thông báo upstream chỉ rõ high demand / deadline. Cùng file/payload với model free-tier thay thế chạy được trên cả direct, endpoint và frontend. Đây là bằng chứng cho vấn đề phục vụ request của model cũ tại thời điểm thử; không thể xác định nguyên nhân nội bộ sâu hơn của Google.

Đã đổi `GEMINI_MODEL` trong `.env.local` sang `gemini-3.5-flash-lite` (giữ key), cập nhật `.env.example` và default chung `lib/gemini-config.ts`. [Tài liệu model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) xác nhận PDF và structured output; [bảng giá](https://ai.google.dev/gemini-api/docs/pricing) xác nhận Standard Free Tier cho input/output. Key hiện có đã gọi model này thành công. Không chỉnh cấu hình billing, không sử dụng model paid-only hay tools tính phí.

Sửa thêm phân loại HTTP 504 thành GEMINI_TIMEOUT / HTTP 504, thay vì lỗi dịch vụ chung HTTP 502. Không thay UI, schema, prompt, key, giới hạn PDF hay retry. 22 test, typecheck, build đều qua; kiểm chứng file thật độc lập với các kiểm tra này.

Chạy lại bằng file thật (SDK server-only yêu cầu conditions):

```bash
node --experimental-strip-types --conditions=react-server scripts/diagnose-pdf.mjs direct 06_light.pdf
node --experimental-strip-types --conditions=react-server scripts/diagnose-pdf.mjs endpoint 06_light.pdf
```

Để đối chứng trực tiếp với model khác mà không sửa `.env.local`, thêm model cho mode direct:

```bash
node --experimental-strip-types --conditions=react-server scripts/diagnose-pdf.mjs direct 06_light.pdf gemini-3.8-flash
```

## Báo cáo lịch sử trước khi có file người dùng

Không thay API key, model, billing, schema hoặc retry trong ứng dụng. Tất cả request dùng cùng cấu hình backend; mỗi phép thử chỉ gửi một lần. Không dùng PDF riêng của người dùng: PDF chẩn đoán hợp lệ một trang chứa kiến thức đại số được tạo trong RAM, dùng để kiểm tra API, không đưa vào UI hoặc dùng để thay kết quả lỗi.

| Phép thử | Model | Kết quả |
| --- | --- | --- |
| Đọc log backend cũ | gemini-3.8-flash | HTTP 503; 58,2 và 64,9 giây. Log cũ không giữ thông báo gốc nên không thể khôi phục. |
| Văn bản rất ngắn, không PDF/JSON schema | gemini-3.8-flash | Thành công, `OK`, 4,079 giây. |
| Văn bản + structured output đơn giản | gemini-3.8-flash | Thành công, `{"answer":"OK"}`, 2,269 giây. |
| PDF một trang + schema tổng quan của project, timeout chẩn đoán 45 giây | gemini-3.8-flash | Bị hủy sau 45,010 giây. Thông báo SDK gốc `This operation was aborted`; không nhận HTTP 503 ở lần này. |
| Chỉ bước PDF, timeout 90 giây như backend | gemini-3.8-flash | Thành công, 29,774 giây. Zod chấp nhận kết quả đại số và trang nguồn `[1]`. |

## Kết luận và giới hạn

Key, văn bản, structured output và PDF nhỏ đều hoạt động tại thời điểm kiểm tra. Không tái hiện được lỗi 503 trong các request này. 503 trước đó là lỗi phía upstream, nhưng thông báo gốc không còn trong log nên không thể khẳng định nguyên nhân cụ thể là tải cao, model hay backend dịch vụ. Thời gian biến động không chứng minh PDF của người dùng hỏng hoặc schema sai. Chưa thử lại chính PDF 0,2 MB vì project không lưu file upload.

Không đổi model hoặc schema, không thêm retry. Chỉ bổ sung backend log các trường lỗi gốc `code/status/message` từ JSON Google, che key, không xuất stack, request hoặc PDF; lỗi gốc không gửi về frontend. Nếu tái diễn, log mới sẽ cung cấp bằng chứng để sửa tiếp.

Đã mở [status chính thức](https://aistudio.google.com/status), nhưng trình đọc web không lấy được nội dung trạng thái từ trang động; không xác nhận toàn dịch vụ đang lỗi hay đã phục hồi. Không suy luận tình trạng toàn dịch vụ từ lần gọi thành công này.

Model thay thế được xác minh là [gemini-3.5-flash-lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite): hỗ trợ PDF và structured output; [bảng giá](https://ai.google.dev/gemini-api/docs/pricing) liệt kê Standard Free Tier miễn phí input/output. Chưa gọi model thay thế vì văn bản model hiện tại chạy được; chưa xác nhận quota/quyền miễn phí của project trên model thay thế. Có free tier không đồng nghĩa xác nhận tài khoản cụ thể có quota còn lại.

## Chạy lại chẩn đoán

```bash
node --experimental-strip-types scripts/diagnose-gemini.mjs
```

Script đọc key từ `.env.local`, không in key, chạy tuần tự text → structured → PDF và dừng các bước phụ thuộc khi lỗi. Timeout mặc định 45 giây để chẩn đoán nhanh. Để thử riêng PDF với timeout 90 giây như backend:

```bash
node --experimental-strip-types scripts/diagnose-gemini.mjs --pdf-only
```

Chỉ nếu text trả 503, có thể thử model thay thế đã xác minh free tier:

```bash
node --experimental-strip-types scripts/diagnose-gemini.mjs gemini-3.5-flash-lite
```

Script kiểm tra model thay thế bằng cùng key trước, mỗi bước chỉ một lần, không sửa `.env.local` hoặc cấu hình billing. Chỉ cho phép hai model đã kiểm tra tài liệu free tier; không dùng tools/grounding/batch/Flex/Priority.
