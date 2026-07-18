(() => {
  const $ = (id) => document.getElementById(id);
  const config = window.APP_CONFIG || {};

  const fileInput = $("fileInput");
  const uploadZone = $("uploadZone");
  const fileHint = $("fileHint");
  const fileMeta = $("fileMeta");
  const metaName = $("metaName");
  const metaPages = $("metaPages");
  const metaSize = $("metaSize");
  const startPageInput = $("startPage");
  const endPageInput = $("endPage");
  const splitBtn = $("splitBtn");
  const statusEl = $("status");
  const modal = $("modal");
  const modalDesc = $("modalDesc");
  const saveAsBtn = $("saveAsBtn");
  const downloadBtn = $("downloadBtn");
  const cancelBtn = $("cancelBtn");

  let selectedFile = null;
  let pageCount = 0;
  let pendingBlob = null;
  let pendingFileName = "split.pdf";

  function setStatus(text, type = "") {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (type ? ` ${type}` : "");
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

  async function loadFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setStatus("请选择 PDF 文件", "error");
      return;
    }

    const maxBytes = Number(config.pdfMaxFileSizeBytes) || 50 * 1024 * 1024;
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    if (file.size > maxBytes) {
      selectedFile = null;
      fileMeta.hidden = true;
      splitBtn.disabled = true;
      fileInput.value = "";
      setStatus(`文件大小不能超过${maxMb}M`, "error");
      return;
    }

    selectedFile = file;
    splitBtn.disabled = true;
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
      pageCount = data.pageCount;
      metaName.textContent = data.fileName || file.name;
      metaPages.textContent = `总页数：${pageCount}`;
      metaSize.textContent = `大小：${formatSize(data.fileSize || file.size)}`;
      fileMeta.hidden = false;
      fileHint.textContent = file.name;
      startPageInput.value = "1";
      endPageInput.value = String(pageCount);
      startPageInput.max = pageCount;
      endPageInput.max = pageCount;
      splitBtn.disabled = false;
      setStatus("文件已就绪，可设置页码后拆分", "ok");
    } catch (err) {
      selectedFile = null;
      fileMeta.hidden = true;
      splitBtn.disabled = true;
      setStatus(err.message || "读取失败", "error");
    }
  }

  function openModal(blob, fileName) {
    pendingBlob = blob;
    pendingFileName = fileName;
    modalDesc.textContent = `已生成 ${fileName}（${formatSize(blob.size)}），请选择保存方式。`;
    modal.hidden = false;
  }

  function closeModal() {
    modal.hidden = true;
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
    if (!window.showSaveFilePicker) {
      throw new Error("当前浏览器不支持选择保存位置，请使用「浏览器下载」");
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

  uploadZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));

  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("dragover");
  });
  uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("dragover");
    loadFile(e.dataTransfer.files[0]);
  });

  splitBtn.addEventListener("click", async () => {
    if (!selectedFile) return;

    const startPage = Number(startPageInput.value);
    const endPage = Number(endPageInput.value);
    if (!Number.isInteger(startPage) || !Number.isInteger(endPage)) {
      setStatus("页码必须是整数", "error");
      return;
    }
    if (startPage < 1 || endPage < startPage || endPage > pageCount) {
      setStatus(`页码范围无效，请在 1 ~ ${pageCount} 之间`, "error");
      return;
    }

    splitBtn.disabled = true;
    setStatus("正在拆分，请稍候...");

    const form = new FormData();
    form.append("file", selectedFile);
    form.append("startPage", String(startPage));
    form.append("endPage", String(endPage));

    try {
      const res = await fetch(apiUrl("/api/pdf/split"), {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      if (!res.ok) {
        throw new Error(await parseError(res));
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      let fileName = `split-p${startPage}-${endPage}.pdf`;
      const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (match) {
        fileName = decodeURIComponent(match[1]);
      }
      openModal(blob, fileName);
      setStatus("拆分成功，请在弹窗中选择保存方式", "ok");
    } catch (err) {
      setStatus(err.message || "拆分失败", "error");
    } finally {
      splitBtn.disabled = false;
    }
  });

  saveAsBtn.addEventListener("click", async () => {
    try {
      await saveWithPicker(pendingBlob, pendingFileName);
      closeModal();
      setStatus("已保存到指定位置", "ok");
    } catch (err) {
      if (err && err.name === "AbortError") return;
      setStatus(err.message || "保存失败", "error");
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
