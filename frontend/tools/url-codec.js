(() => {
  const $ = (id) => document.getElementById(id);
  const input = $("input");
  const output = $("output");
  const statusEl = $("status");

  function setStatus(text, type = "") {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  $("btnEncode").addEventListener("click", () => {
    output.value = encodeURIComponent(input.value);
    setStatus("编码成功", "ok");
  });

  $("btnDecode").addEventListener("click", () => {
    try {
      output.value = decodeURIComponent(input.value.trim());
      setStatus("解码成功", "ok");
    } catch (err) {
      setStatus("解码失败，内容可能不是合法 URL 编码", "error");
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
