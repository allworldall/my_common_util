/**
 * 前端 API 配置（仅开发者修改，不对用户展示）
 *
 * - 线上 Nginx 同源代理：apiBase 留空，请求走 /api/...
 * - 本地 python 起前端、后端 8080：自动用 http://localhost:8080
 * - 若后端开了 api-token，在这里填 apiToken
 */
window.APP_CONFIG = {
  apiBase: "",
  apiToken: "",
  /** PDF 上传大小上限（字节），需与后端 pdf.split.max-file-size-bytes 保持一致 */
  pdfMaxFileSizeBytes: 50 * 1024 * 1024,
  /** 图片扫描：单张上限 / 最多张数，需与后端 pdf.scan.* 保持一致 */
  scanMaxFileSizeBytes: 8 * 1024 * 1024,
  scanMaxImages: 10,
  /** Word↔PDF：单文件上限，需与后端 doc.convert.max-file-size-bytes 保持一致 */
  wordPdfMaxFileSizeBytes: 20 * 1024 * 1024,
};

(function resolveApiBase() {
  if (window.APP_CONFIG.apiBase) {
    return;
  }
  // 本地用 python3 -m http.server / Live Server 调试时，自动指向本机后端。
  // 注意：POST 打到静态服务器会返回 501，因此非 8080 端口必须改写 apiBase。
  const host = location.hostname;
  const port = location.port;
  const isLoopback =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1";
  if (isLoopback && port && port !== "8080") {
    window.APP_CONFIG.apiBase = "http://localhost:8080";
  }
})();
