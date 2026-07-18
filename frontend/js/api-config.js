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
};

(function resolveApiBase() {
  if (window.APP_CONFIG.apiBase) {
    return;
  }
  // 本地用 python3 -m http.server 5500 调试时，自动指向本机后端
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    if (location.port && location.port !== "8080") {
      window.APP_CONFIG.apiBase = "http://localhost:8080";
    }
  }
})();
