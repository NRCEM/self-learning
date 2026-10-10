// Leave room for translation JSON and multipart framing below Vercel's 4.5 MB payload cap.
export const MAX_PDF_MIB = 3;
export const MAX_PDF_BYTES = MAX_PDF_MIB * 1024 * 1024;
export const MAX_PDF_BODY_BYTES = MAX_PDF_BYTES + 256 * 1024;
export const MAX_TRANSLATION_BYTES = 192 * 1024;
