(() => {
  const $ = (id) => document.getElementById(id);
  const config = window.APP_CONFIG || {};
  const maxBytes = Number(config.pdfMaxFileSizeBytes) || 50 * 1024 * 1024;
  const maxMb = Math.round(maxBytes / (1024 * 1024));

  const mergeBtn = $("mergeBtn");
  const swapBtn = $("swapBtn");
  const statusEl = $("status");
  const modal = $("modal");
  const modalDesc = $("modalDesc");
  const modalStatus = $("modalStatus");
  const saveAsBtn = $("saveAsBtn");
  const downloadBtn = $("downloadBtn");
  const cancelBtn = $("cancelBtn");

  const slots = [
    { file: null, name: "", pages: 0, size: 0 },
    { file: null, name: "", pages: 0, size: 0 },
  ];

  let pendingBlob = null;
  let pendingFileName = "merged.pdf";

  function canUseSavePicker() {
    return typeof window.showSaveFilePicker === "function" && window.isSecureContext;
  }

  function setStatus(text, type = "") {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  function setModalStatus(text, type = "") {
    if (!text) {
      modalStatus.hidden = true;
      modalStatus.textContent = "";
      modalStatus.className = "status";
      return;
    }
    modalStatus.hidden = false;
    modalStatus.textContent = text;
    modalStatus.className = "status" + (type ? ` ${type}` : "");
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function apiUrl(path) {
    const base = (config.apiBase || "").replace(/\/+$/, "");
    return `${base}${path}`;
  }

  function authHeaders() {
    const token = (config.apiToken || "").trim();
    return token ? { "X-Api-Token": token } : {};
  }

  async function parseError(response) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return data.message || `请求失败(${response.status})`;
    }
    return `请求失败(${response.status})`;
  }

  function bothReady() {
    return Boolean(slots[0].file && slots[1].file);
  }

  function updateActions() {
    mergeBtn.disabled = !bothReady();
    swapBtn.disabled = !slots[0].file && !slots[1].file;
  }

  function clearSlot(index) {
    slots[index] = { file: null, name: "", pages: 0, size: 0 };
    const input = $(`fileInput${index}`);
    if (input) input.value = "";
    renderSlot(index);
    updateActions();
  }

  function renderSlot(index) {
    const slot = slots[index];
    const hint = $(`hint${index}`);
    const meta = $(`meta${index}`);
    if (!slot.file) {
      hint.textContent = `支持最大 ${maxMb}M`;
      meta.hidden = true;
      return;
    }
    hint.textContent = slot.name;
    $(`metaName${index}`).textContent = slot.name;
    $(`metaPages${index}`).textContent = `总页数：${slot.pages}`;
    $(`metaSize${index}`).textContent = `大小：${formatSize(slot.size)}`;
    meta.hidden = false;
  }

  async function loadFile(index, file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setStatus("请选择 PDF 文件", "error");
      return;
    }
    if (file.size > maxBytes) {
      clearSlot(index);
      setStatus(`文件大小不能超过${maxMb}M`, "error");
      return;
    }

    mergeBtn.disabled = true;
    setStatus("正在读取文件信息...");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(apiUrl("/api/pdf/info"), {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      if (!res.ok) {
        throw new Error(await parseError(res));
      }
      const data = await res.json();
      slots[index] = {
        file,
        name: data.fileName || file.name,
        pages: data.pageCount,
        size: data.fileSize || file.size,
      };
      renderSlot(index);
      updateActions();
      setStatus(
        bothReady() ? "两个文件已就绪，可合并或交换顺序" : "已选 1 个，请再选另一个 PDF",
        "ok"
      );
    } catch (err) {
      clearSlot(index);
      setStatus(err.message || "读取失败", "error");
    }
  }

  function bindZone(index) {
    const zone = $(`zone${index}`);
    const input = $(`fileInput${index}`);

    zone.addEventListener("click", () => input.click());
    input.addEventListener("change", () => loadFile(index, input.files[0]));

    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");
      loadFile(index, e.dataTransfer.files[0]);
    });
  }

  function openModal(blob, fileName) {
    pendingBlob = blob;
    pendingFileName = fileName;
    modalDesc.textContent = `已生成 ${fileName}（${formatSize(blob.size)}），请选择保存方式。`;
    setModalStatus("");
    if (canUseSavePicker()) {
      saveAsBtn.hidden = false;
      saveAsBtn.className = "primary";
      downloadBtn.className = "secondary";
    } else {
      saveAsBtn.hidden = true;
      downloadBtn.className = "primary";
    }
    modal.hidden = false;
  }

  function closeModal() {
    modal.hidden = true;
    setModalStatus("");
  }

  function triggerBrowserDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function saveWithPicker(blob, fileName) {
    if (!canUseSavePicker()) {
      throw new Error("当前环境不支持选择保存位置，请使用「浏览器下载」");
    }
    const handle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: "PDF 文件",
          accept: { "application/pdf": [".pdf"] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  bindZone(0);
  bindZone(1);
  renderSlot(0);
  renderSlot(1);
  updateActions();

  swapBtn.addEventListener("click", () => {
    const first = slots[0];
    slots[0] = slots[1];
    slots[1] = first;
    renderSlot(0);
    renderSlot(1);
    updateActions();
    setStatus("已交换顺序，合并时上面的文件在前", "ok");
  });

  mergeBtn.addEventListener("click", async () => {
    if (!bothReady()) return;

    mergeBtn.disabled = true;
    swapBtn.disabled = true;
    setStatus("正在合并，请稍候...");

    const form = new FormData();
    form.append("file1", slots[0].file);
    form.append("file2", slots[1].file);

    try {
      const res = await fetch(apiUrl("/api/pdf/merge"), {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      if (!res.ok) {
        throw new Error(await parseError(res));
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      let fileName = "merged.pdf";
      const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (match) {
        fileName = decodeURIComponent(match[1]);
      }
      openModal(blob, fileName);
      setStatus("合并成功，请在弹窗中选择保存方式", "ok");
    } catch (err) {
      setStatus(err.message || "合并失败", "error");
    } finally {
      updateActions();
    }
  });

  saveAsBtn.addEventListener("click", async () => {
    try {
      setModalStatus("");
      await saveWithPicker(pendingBlob, pendingFileName);
      closeModal();
      setStatus("已保存到指定位置", "ok");
    } catch (err) {
      if (err && err.name === "AbortError") return;
      setModalStatus(err.message || "保存失败", "error");
    }
  });

  downloadBtn.addEventListener("click", () => {
    triggerBrowserDownload(pendingBlob, pendingFileName);
    closeModal();
    setStatus("已触发浏览器下载", "ok");
  });

  cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
})();
