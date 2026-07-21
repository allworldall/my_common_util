(() => {
  const $ = (id) => document.getElementById(id);

  const fileInput = $("fileInput");
  const previewBox = $("previewBox");
  const placeholder = $("placeholder");
  const uploadBtn = $("uploadBtn");
  const lang = $("lang");
  const ocrBtn = $("ocrBtn");
  const copyBtn = $("copyBtn");
  const clearBtn = $("clearBtn");
  const preview = $("preview");
  const output = $("output");
  const statusEl = $("status");

  const MAX_BYTES = 12 * 1024 * 1024;
  const ALLOWED = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/bmp",
    "image/gif",
  ]);

  /** @type {File | null} */
  let currentFile = null;
  /** @type {string | null} */
  let previewUrl = null;
  let busy = false;
  /** @type {Promise<any> | null} */
  let workerReady = null;
  let workerLang = "";

  function setStatus(text, type = "") {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  function syncActions() {
    const has = !!currentFile;
    ocrBtn.disabled = !has || busy;
    uploadBtn.disabled = busy;
    clearBtn.disabled = (!has && !output.value) || busy;
    copyBtn.disabled = !output.value.trim() || busy;
    previewBox.classList.toggle("has-image", has);
    placeholder.hidden = has;
  }

  function clearPreviewUrl() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
  }

  function resetAll() {
    if (busy) return;
    clearPreviewUrl();
    currentFile = null;
    fileInput.value = "";
    preview.hidden = true;
    preview.removeAttribute("src");
    output.value = "";
    setStatus("");
    syncActions();
  }

  function openFilePicker() {
    if (!busy) fileInput.click();
  }

  function isAllowedImage(file) {
    if (!file) return false;
    if (ALLOWED.has(file.type)) return true;
    const name = (file.name || "").toLowerCase();
    return /\.(jpe?g|png|webp|bmp|gif)$/.test(name) || !file.type;
  }

  async function setFile(file, sourceLabel) {
    if (!file || busy) return;

    if (!isAllowedImage(file)) {
      setStatus("仅支持 JPG / PNG / WEBP / BMP / GIF 图片", "error");
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus(`图片过大，请控制在 ${Math.round(MAX_BYTES / (1024 * 1024))}MB 以内`, "error");
      return;
    }

    const buffer = await file.arrayBuffer();
    const type = ALLOWED.has(file.type) ? file.type : "image/png";
    const stable = new File(
      [buffer],
      file.name || `paste-${Date.now()}.png`,
      { type }
    );

    clearPreviewUrl();
    currentFile = stable;
    previewUrl = URL.createObjectURL(stable);
    preview.src = previewUrl;
    preview.hidden = false;
    output.value = "";
    setStatus(sourceLabel || "已选择图片，点击「开始识别」");
    syncActions();
  }

  async function getWorker(selectedLang) {
    if (typeof Tesseract === "undefined") {
      throw new Error("识别引擎加载失败，请检查网络后刷新页面");
    }
    if (!workerReady || workerLang !== selectedLang) {
      if (workerReady) {
        try {
          const old = await workerReady;
          await old.terminate();
        } catch (_) {
          /* ignore */
        }
      }
      workerLang = selectedLang;
      workerReady = Tesseract.createWorker(selectedLang, 1, {
        logger: (m) => {
          if (!busy) return;
          if (m.status === "loading tesseract core") {
            setStatus("正在加载识别引擎…");
          } else if (m.status === "loading language traineddata") {
            setStatus("正在下载语言包（首次较慢）…");
          } else if (m.status === "initializing api" || m.status === "initialized api") {
            setStatus("正在初始化…");
          } else if (m.status === "recognizing text" && typeof m.progress === "number") {
            setStatus(`正在识别… ${Math.round(m.progress * 100)}%`);
          }
        },
      });
    }
    return workerReady;
  }

  async function runOcr() {
    if (!currentFile || busy) return;
    if (typeof Tesseract === "undefined") {
      setStatus("识别引擎加载失败，请检查网络后刷新页面", "error");
      return;
    }

    busy = true;
    syncActions();
    ocrBtn.textContent = "识别中…";
    setStatus("准备识别…");

    try {
      const worker = await getWorker(lang.value);
      const result = await worker.recognize(currentFile);
      const text = (result?.data?.text || "").replace(/\r\n/g, "\n").trim();
      output.value = text;
      if (text) {
        setStatus(`识别完成，共 ${text.length} 个字符`, "ok");
      } else {
        setStatus("未识别到文字，可换更清晰的图片再试", "error");
      }
    } catch (err) {
      console.error(err);
      workerReady = null;
      workerLang = "";
      setStatus(err?.message || "识别失败，请稍后重试", "error");
    } finally {
      busy = false;
      ocrBtn.textContent = "开始识别";
      syncActions();
    }
  }

  uploadBtn.addEventListener("click", openFilePicker);

  previewBox.addEventListener("click", () => {
    if (!currentFile) openFilePicker();
  });

  previewBox.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFilePicker();
    }
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) setFile(file, "已选择图片，点击「开始识别」");
  });

  ["dragenter", "dragover"].forEach((type) => {
    previewBox.addEventListener(type, (e) => {
      e.preventDefault();
      previewBox.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((type) => {
    previewBox.addEventListener(type, (e) => {
      e.preventDefault();
      previewBox.classList.remove("dragover");
    });
  });

  previewBox.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) setFile(file, "已拖入图片，点击「开始识别」");
  });

  document.addEventListener("paste", (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type && item.type.startsWith("image/"));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    e.preventDefault();
    setFile(file, "已粘贴截图，点击「开始识别」");
  });

  ocrBtn.addEventListener("click", runOcr);
  clearBtn.addEventListener("click", resetAll);

  copyBtn.addEventListener("click", async () => {
    const text = output.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("已复制到剪贴板", "ok");
    } catch (_) {
      output.focus();
      output.select();
      setStatus("复制失败，请手动全选复制", "error");
    }
  });

  syncActions();
})();
