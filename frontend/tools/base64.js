(() => {
  const $ = (id) => document.getElementById(id);
  const input = $("input");
  const output = $("output");
  const statusEl = $("status");

  function setStatus(text, type = "") {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  function toBase64(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  function fromBase64(text) {
    return decodeURIComponent(escape(atob(text.trim())));
  }

  $("btnEncode").addEventListener("click", () => {
    try {
      output.value = toBase64(input.value);
      setStatus("编码成功", "ok");
    } catch (err) {
      setStatus(`编码失败：${err.message}`, "error");
    }
  });

  $("btnDecode").addEventListener("click", () => {
    try {
      output.value = fromBase64(input.value);
      setStatus("解码成功", "ok");
    } catch (err) {
      setStatus("解码失败，请确认是合法 Base64", "error");
    }
  });

  $("btnCopy").addEventListener("click", async () => {
    if (!output.value) return setStatus("没有可复制内容", "error");
    await navigator.clipboard.writeText(output.value);
    setStatus("已复制", "ok");
  });

  $("btnClear").addEventListener("click", () => {
    input.value = "";
    output.value = "";
    setStatus("已清空");
  });
})();
