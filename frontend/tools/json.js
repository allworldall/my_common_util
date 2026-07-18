(() => {
  const $ = (id) => document.getElementById(id);
  const input = $("input");
  const output = $("output");
  const statusEl = $("status");

  function setStatus(text, type = "") {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  function parseJson(text) {
    return JSON.parse(text);
  }

  function format() {
    try {
      const obj = parseJson(input.value);
      output.value = JSON.stringify(obj, null, 2);
      setStatus("格式化成功", "ok");
    } catch (err) {
      setStatus(`校验失败：${err.message}`, "error");
    }
  }

  function compress() {
    try {
      const obj = parseJson(input.value);
      output.value = JSON.stringify(obj);
      setStatus("压缩成功", "ok");
    } catch (err) {
      setStatus(`压缩失败：${err.message}`, "error");
    }
  }

  function validate() {
    try {
      parseJson(input.value);
      setStatus("JSON 合法", "ok");
      output.value = "✓ 校验通过";
    } catch (err) {
      setStatus(`JSON 不合法：${err.message}`, "error");
      output.value = `✗ ${err.message}`;
    }
  }

  function escapeJson() {
    try {
      // 先尽量解析成对象再 stringify，保证是合法 JSON 字符串；失败则对原文转义
      let text = input.value;
      try {
        text = JSON.stringify(parseJson(input.value));
      } catch (_) {
        // keep raw
      }
      output.value = JSON.stringify(text);
      setStatus("转义成功", "ok");
    } catch (err) {
      setStatus(`转义失败：${err.message}`, "error");
    }
  }

  function unescapeJson() {
    try {
      let text = input.value.trim();
      // 支持带引号的转义串，或多次转义
      let current = text;
      for (let i = 0; i < 3; i++) {
        const parsed = JSON.parse(current);
        if (typeof parsed === "string") {
          current = parsed;
        } else {
          output.value = JSON.stringify(parsed, null, 2);
          setStatus("去转义成功（得到对象）", "ok");
          return;
        }
      }
      output.value = current;
      setStatus("去转义成功", "ok");
    } catch (err) {
      setStatus(`去转义失败：${err.message}`, "error");
    }
  }

  async function copyOut() {
    const text = output.value || input.value;
    if (!text) {
      setStatus("没有可复制内容", "error");
      return;
    }
    await navigator.clipboard.writeText(text);
    setStatus("已复制", "ok");
  }

  function clearAll() {
    input.value = "";
    output.value = "";
    setStatus("已清空");
  }

  $("btnFormat").addEventListener("click", format);
  $("btnCompress").addEventListener("click", compress);
  $("btnValidate").addEventListener("click", validate);
  $("btnEscape").addEventListener("click", escapeJson);
  $("btnUnescape").addEventListener("click", unescapeJson);
  $("btnCopy").addEventListener("click", copyOut);
  $("btnClear").addEventListener("click", clearAll);
})();
