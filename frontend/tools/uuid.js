(() => {
  const $ = (id) => document.getElementById(id);
  const output = $("output");
  const statusEl = $("status");

  function setStatus(text, type = "") {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  function uuidv4() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  $("btnGen").addEventListener("click", () => {
    const count = Number($("count").value);
    if (!Number.isInteger(count) || count < 1 || count > 200) {
      setStatus("数量请设置在 1 ~ 200", "error");
      return;
    }
    const upper = $("upper").value === "1";
    const list = Array.from({ length: count }, () => {
      const id = uuidv4();
      return upper ? id.toUpperCase() : id;
    });
    output.value = list.join("\n");
    setStatus(`已生成 ${count} 个`, "ok");
  });

  $("btnCopy").addEventListener("click", async () => {
    if (!output.value) return setStatus("没有可复制内容", "error");
    await navigator.clipboard.writeText(output.value);
    setStatus("已复制", "ok");
  });

  $("btnClear").addEventListener("click", () => {
    output.value = "";
    setStatus("已清空");
  });
})();
