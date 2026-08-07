(() => {
  const $ = (id) => document.getElementById(id);
  const config = window.APP_CONFIG || {};

  const methodEl = $("method");
  const urlEl = $("url");
  const modeEl = $("mode");
  const timeoutEl = $("timeoutMs");
  const headersEl = $("headers");
  const bodyEl = $("body");
  const statusEl = $("status");
  const responseMeta = $("responseMeta");
  const respStatus = $("respStatus");
  const respTime = $("respTime");
  const respSize = $("respSize");
  const respHeaders = $("respHeaders");
  const respBody = $("respBody");
  const btnSend = $("btnSend");

  let sending = false;

  function setStatus(text, type = "") {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  function apiUrl(path) {
    const base = (config.apiBase || "").replace(/\/+$/, "");
    return `${base}${path}`;
  }

  function authHeaders() {
    const token = (config.apiToken || "").trim();
    return token ? { "X-Api-Token": token } : {};
  }

  function parseHeaders(text) {
    const headers = {};
    const lines = String(text || "").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf(":");
      if (idx <= 0) {
        throw new Error(`请求头格式不正确：${trimmed}`);
      }
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (!key) {
        throw new Error(`请求头格式不正确：${trimmed}`);
      }
      headers[key] = value;
    }
    return headers;
  }

  function formatHeaders(headers) {
    if (!headers) return "";
    if (Array.isArray(headers)) {
      return headers
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
    }
    const lines = [];
    Object.keys(headers).forEach((key) => {
      const value = headers[key];
      if (Array.isArray(value)) {
        value.forEach((v) => lines.push(`${key}: ${v}`));
      } else {
        lines.push(`${key}: ${value}`);
      }
    });
    return lines.join("\n");
  }

  function formatSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function tryPrettyJson(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) {
      return text;
    }
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return text;
    }
  }

  function showResponse({ status, timeMs, sizeBytes, headersText, bodyText, truncated }) {
    responseMeta.hidden = false;
    respStatus.textContent = status == null ? "-" : String(status);
    respTime.textContent = timeMs == null ? "-" : `${timeMs} ms`;
    respSize.textContent = sizeBytes == null ? "-" : formatSize(sizeBytes);
    respHeaders.value = headersText || "";
    respBody.value = bodyText || "";
    if (truncated) {
      setStatus(`请求成功（响应体已截断显示）`, "ok");
    }
  }

  function clearResponse() {
    responseMeta.hidden = true;
    respStatus.textContent = "-";
    respTime.textContent = "-";
    respSize.textContent = "-";
    respHeaders.value = "";
    respBody.value = "";
  }

  async function parseError(response) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        const data = await response.json();
        return data.message || `请求失败(${response.status})`;
      } catch {
        return `请求失败(${response.status})`;
      }
    }
    return `请求失败(${response.status})`;
  }

  async function sendViaProxy(payload) {
    const res = await fetch(apiUrl("/api/http/proxy"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await parseError(res));
    }
    const data = await res.json();
    if (!data || data.success === false) {
      throw new Error((data && data.message) || "代理请求失败");
    }
    showResponse({
      status: data.status,
      timeMs: data.timeMs,
      sizeBytes: data.bodyBytes,
      headersText: formatHeaders(data.headers),
      bodyText: tryPrettyJson(data.body || ""),
      truncated: !!data.bodyTruncated,
    });
    if (!data.bodyTruncated) {
      setStatus("请求成功", "ok");
    }
  }

  async function sendViaBrowser(payload) {
    const controller = new AbortController();
    const timeout = Math.max(1000, Number(payload.timeoutMs) || 15000);
    const timer = setTimeout(() => controller.abort(), timeout);
    const started = performance.now();
    try {
      const init = {
        method: payload.method,
        headers: payload.headers,
        signal: controller.signal,
      };
      if (payload.body && !["GET", "HEAD"].includes(payload.method)) {
        init.body = payload.body;
      }
      const res = await fetch(payload.url, init);
      const elapsed = Math.round(performance.now() - started);
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const decoder = new TextDecoder("utf-8");
      const text = decoder.decode(bytes);
      const headerLines = [];
      res.headers.forEach((value, key) => {
        headerLines.push(`${key}: ${value}`);
      });
      showResponse({
        status: res.status,
        timeMs: elapsed,
        sizeBytes: bytes.length,
        headersText: headerLines.join("\n"),
        bodyText: tryPrettyJson(text),
        truncated: false,
      });
      setStatus("请求成功（浏览器直连）", "ok");
    } catch (err) {
      if (err && err.name === "AbortError") {
        throw new Error("请求超时");
      }
      const msg = (err && err.message) || "浏览器直连失败";
      if (/Failed to fetch|NetworkError|CORS/i.test(msg)) {
        throw new Error("浏览器直连失败（多半是 CORS 限制），请改用「服务端代理」");
      }
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      clearTimeout(timer);
    }
  }

  async function onSend() {
    if (sending) return;
    const url = urlEl.value.trim();
    if (!url) {
      setStatus("请填写请求 URL", "error");
      return;
    }

    let headers;
    try {
      headers = parseHeaders(headersEl.value);
    } catch (err) {
      setStatus(err.message || "请求头解析失败", "error");
      return;
    }

    const payload = {
      method: methodEl.value,
      url,
      headers,
      body: bodyEl.value,
      timeoutMs: Number(timeoutEl.value) || 15000,
    };

    sending = true;
    btnSend.disabled = true;
    clearResponse();
    setStatus("发送中...");

    try {
      if (modeEl.value === "browser") {
        await sendViaBrowser(payload);
      } else {
        await sendViaProxy(payload);
      }
    } catch (err) {
      setStatus((err && err.message) || "请求失败", "error");
    } finally {
      sending = false;
      btnSend.disabled = false;
    }
  }

  $("btnSend").addEventListener("click", onSend);

  urlEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSend();
    }
  });

  $("btnCopyBody").addEventListener("click", async () => {
    if (!respBody.value) return setStatus("没有可复制内容", "error");
    try {
      await navigator.clipboard.writeText(respBody.value);
      setStatus("已复制响应体", "ok");
    } catch {
      setStatus("复制失败", "error");
    }
  });

  $("btnClear").addEventListener("click", () => {
    urlEl.value = "";
    headersEl.value = "";
    bodyEl.value = "";
    timeoutEl.value = "15000";
    methodEl.value = "GET";
    modeEl.value = "proxy";
    clearResponse();
    setStatus("已清空");
  });
})();
