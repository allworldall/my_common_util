(() => {
  const $ = (id) => document.getElementById(id);
  const config = window.APP_CONFIG || {};

  const directionEl = $("direction");
  const fileInput = $("fileInput");
  const uploadZone = $("uploadZone");
  const uploadTitle = $("uploadTitle");
  const fileHint = $("fileHint");
  const fileMeta = $("fileMeta");
  const metaName = $("metaName");
  const metaSize = $("metaSize");
  const convertBtn = $("convertBtn");
  const convertTip = $("convertTip");
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
  let pendingFileName = "converted.bin";

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

  function maxBytes() {
    return Number(config.wordPdfMaxFileSizeBytes) || 20 * 1024 * 1024;
  }

  function isWordToPdf() {
    return directionEl.value === "word-to-pdf";
  }

  function acceptForDirection() {
    if (isWordToPdf()) {
      return ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    return "application/pdf,.pdf";
  }

  function tipForDirection() {
    if (isWordToPdf()) {
      return "转换后页数、间距可能与本机 Word 略有差异。下载后请打开核对文字与版式，确认可用再正式使用。";
    }
    return "PDF → Word 属于近似转换：复杂排版可能出现重影、缺字或版式错乱。下载后请务必打开检查，重要内容建议人工校对后再使用。";
  }

  function modalTipForDirection() {
    if (isWordToPdf()) {
      return "保存后请打开 PDF，快速核对文字与分页是否符合预期。";
    }
    return "保存后请打开 Word，重点检查重影、缺字和版式，确认无误再使用。";
  }

  function syncDirectionUi(clearFile = true) {
    fileInput.accept = acceptForDirection();
    const maxMb = Math.round(maxBytes() / (1024 * 1024));
    if (isWordToPdf()) {
      uploadTitle.textContent = "点击或拖拽 Word 到此处";
      fileHint.textContent = `支持 .doc / .docx，最大 ${maxMb}M`;
    } else {
      uploadTitle.textContent = "点击或拖拽 PDF 到此处";
      fileHint.textContent = `支持 .pdf，最大 ${maxMb}M`;
    }
    convertTip.textContent = tipForDirection();
    if (clearFile) {
      selectedFile = null;
      fileInput.value = "";
      fileMeta.hidden = true;
      convertBtn.disabled = true;
      setStatus("");
    }
  }

  function isAcceptedFile(file) {
    const name = (file.name || "").toLowerCase();
    if (isWordToPdf()) {
      return name.endsWith(".doc") || name.endsWith(".docx");
    }
    return name.endsWith(".pdf") || file.type === "application/pdf";
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
    if (!isAcceptedFile(file)) {
      setStatus(isWordToPdf() ? "请选择 Word 文件（.doc / .docx）" : "请选择 PDF 文件", "error");
      return;
    }

    const limit = maxBytes();
    const maxMb = Math.round(limit / (1024 * 1024));
    if (file.size > limit) {
      selectedFile = null;
      fileMeta.hidden = true;
      convertBtn.disabled = true;
      fileInput.value = "";
      setStatus(`文件大小不能超过${maxMb}M`, "error");
      return;
    }

    selectedFile = file;
    metaName.textContent = file.name;
    metaSize.textContent = `大小：${formatSize(file.size)}`;
    fileMeta.hidden = false;
    fileHint.textContent = file.name;
    convertBtn.disabled = false;
    setStatus("文件已就绪，可开始转换", "ok");
  }

  function openModal(blob, fileName) {
    pendingBlob = blob;
    pendingFileName = fileName;
    modalDesc.textContent = `已生成 ${fileName}（${formatSize(blob.size)}），请选择保存方式。`;
    modalTip.textContent = modalTipForDirection();
    setModalStatus("");
    if (canUseSavePicker()) {
      saveAsBtn.hidden = false;
      saveAsBtn.className = "primary";
      downloadBtn.className = "secondary";
    } else {
      // HTTP / 非 Chromium：无 File System Access API，不展示该按钮
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

  function pickerTypes(fileName) {
    if (fileName.toLowerCase().endsWith(".pdf")) {
      return [{ description: "PDF 文件", accept: { "application/pdf": [".pdf"] } }];
    }
    return [
      {
        description: "Word 文件",
        accept: {
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
        },
      },
    ];
  }

  async function saveWithPicker(blob, fileName) {
    if (!canUseSavePicker()) {
      throw new Error("当前环境不支持选择保存位置，请使用「浏览器下载」");
    }
    const handle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: pickerTypes(fileName),
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  directionEl.addEventListener("change", () => syncDirectionUi(true));

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

  convertBtn.addEventListener("click", async () => {
    if (!selectedFile) return;

    convertBtn.disabled = true;
    setStatus("正在转换，请稍候...", "");

    const form = new FormData();
    form.append("file", selectedFile);
    form.append("direction", directionEl.value);

    try {
      const res = await fetch(apiUrl("/api/doc/convert"), {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      if (!res.ok) {
        throw new Error(await parseError(res));
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      let fileName = isWordToPdf() ? "converted.pdf" : "converted.docx";
      const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (match) {
        fileName = decodeURIComponent(match[1]);
      }
      openModal(blob, fileName);
      setStatus("转换成功。保存后请打开文件核对内容与格式", "ok");
    } catch (err) {
      setStatus(err.message || "转换失败", "error");
    } finally {
      convertBtn.disabled = !selectedFile;
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

  syncDirectionUi(false);
})();
