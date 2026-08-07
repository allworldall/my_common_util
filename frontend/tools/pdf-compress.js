(() => {
  const $ = (id) => document.getElementById(id);
  const config = window.APP_CONFIG || {};

  const fileInput = $("fileInput");
  const uploadZone = $("uploadZone");
  const fileHint = $("fileHint");
  const fileMeta = $("fileMeta");
  const metaName = $("metaName");
  const metaSize = $("metaSize");
  const qualityEl = $("quality");
  const compressBtn = $("compressBtn");
  const statusEl = $("status");
  const modal = $("modal");
  const modalDesc = $("modalDesc");
  const modalTip = $("modalTip");
  const modalStatus = $("modalStatus");
  const saveAsBtn = $("saveAsBtn");
  const downloadBtn = $("downloadBtn");
  const cancelBtn = $("cancelBtn");

  let selectedFile = null;
  let pendingBlob = null;
  let pendingFileName = "compressed.pdf";

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
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function apiUrl(path) {
    const base = (config.apiBase || "").replace(/\/+$/, "");
    return `${base}${path}`;
  }

  function authHeaders() {
    const token = (config.apiToken || "").trim();
    return token ? { "X-Api-Token": token } : {};
  }

  function maxBytes() {
    return Number(config.pdfCompressMaxFileSizeBytes) || 100 * 1024 * 1024;
  }

  function syncHint() {
    const maxMb = Math.round(maxBytes() / (1024 * 1024));
    if (!selectedFile) {
      fileHint.textContent = `支持最大 ${maxMb}M`;
    }
  }

  async function parseError(response) {
    if (response.status === 501) {
      return "请求打到了前端静态服务而不是后端。请确认后端已在 8080 启动，并强制刷新页面后重试";
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return data.message || `请求失败(${response.status})`;
    }
    return `请求失败(${response.status})`;
  }

  function loadFile(file) {
    if (!file) return;
    const name = (file.name || "").toLowerCase();
    if (!name.endsWith(".pdf") && file.type !== "application/pdf") {
      setStatus("请选择 PDF 文件", "error");
      return;
    }

    const limit = maxBytes();
    const maxMb = Math.round(limit / (1024 * 1024));
    if (file.size > limit) {
      selectedFile = null;
      fileMeta.hidden = true;
      compressBtn.disabled = true;
      fileInput.value = "";
      setStatus(`文件大小不能超过${maxMb}M`, "error");
      return;
    }

    selectedFile = file;
    metaName.textContent = file.name;
    metaSize.textContent = `大小：${formatSize(file.size)}`;
    fileMeta.hidden = false;
    fileHint.textContent = file.name;
    compressBtn.disabled = false;
    setStatus("文件已就绪，可开始压缩", "ok");
  }

  function openModal(blob, fileName, summary) {
    pendingBlob = blob;
    pendingFileName = fileName;
    modalDesc.textContent = `已生成 ${fileName}（${formatSize(blob.size)}），请选择保存方式。`;
    modalTip.textContent = summary || "保存后请打开 PDF，确认字迹与图片是否清晰可用。";
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
      types: [{ description: "PDF 文件", accept: { "application/pdf": [".pdf"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  function ratioText(original, output) {
    if (!original || original <= 0) return "";
    const saved = Math.max(0, original - output);
    const pct = Math.round((saved / original) * 100);
    return `原 ${formatSize(original)} → ${formatSize(output)}（减小 ${pct}%）`;
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

  compressBtn.addEventListener("click", async () => {
    if (!selectedFile) return;

    compressBtn.disabled = true;
    setStatus("正在压缩，大文件可能需要数十秒，请稍候...", "");

    const form = new FormData();
    form.append("file", selectedFile);
    form.append("quality", qualityEl.value);

    try {
      const res = await fetch(apiUrl("/api/pdf/compress"), {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      if (!res.ok) {
        throw new Error(await parseError(res));
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      let fileName = "compressed.pdf";
      const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (match) {
        fileName = decodeURIComponent(match[1]);
      }

      const originalSize = Number(res.headers.get("X-Original-Size")) || selectedFile.size;
      const outputSize = Number(res.headers.get("X-Output-Size")) || blob.size;
      const skipped = res.headers.get("X-Compress-Skipped") === "1";
      const summary = skipped
        ? "压缩后体积未减小，已返回原文件。可尝试更低质量档位，或该 PDF 本身已较紧凑。"
        : `${ratioText(originalSize, outputSize)}。请打开核对字迹是否清晰。`;

      openModal(blob, fileName, summary);
      setStatus(skipped ? "体积未减小，已返回原文件" : `压缩成功。${ratioText(originalSize, outputSize)}`, "ok");
    } catch (err) {
      setStatus(err.message || "压缩失败", "error");
    } finally {
      compressBtn.disabled = !selectedFile;
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

  syncHint();
})();
