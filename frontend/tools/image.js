(() => {
  const $ = (id) => document.getElementById(id);

  const uploadZone = $("uploadZone");
  const fileInput = $("fileInput");
  const fileHint = $("fileHint");
  const fileMeta = $("fileMeta");
  const metaName = $("metaName");
  const metaOrigin = $("metaOrigin");
  const widthInput = $("width");
  const heightInput = $("height");
  const keepRatio = $("keepRatio");
  const maxKbInput = $("maxKb");
  const formatSelect = $("format");
  const processBtn = $("processBtn");
  const downloadBtn = $("downloadBtn");
  const originPreview = $("originPreview");
  const resultPreview = $("resultPreview");
  const statusEl = $("status");

  let sourceImage = null;
  let sourceFile = null;
  let resultBlob = null;
  let ratio = 1;

  function setStatus(text, type = "") {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      setStatus("请选择图片文件", "error");
      return;
    }
    sourceFile = file;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      sourceImage = img;
      ratio = img.width / img.height;
      widthInput.value = String(img.width);
      heightInput.value = String(img.height);
      originPreview.src = url;
      originPreview.hidden = false;
      resultPreview.hidden = true;
      resultBlob = null;
      downloadBtn.disabled = true;
      processBtn.disabled = false;
      fileMeta.hidden = false;
      metaName.textContent = file.name;
      metaOrigin.textContent = `原图：${img.width}×${img.height}，${formatSize(file.size)}`;
      fileHint.textContent = file.name;
      setStatus("图片已加载，可调整参数后处理", "ok");
    };
    img.onerror = () => setStatus("图片读取失败", "error");
    img.src = url;
  }

  widthInput.addEventListener("input", () => {
    if (keepRatio.value !== "1" || !sourceImage) return;
    const w = Number(widthInput.value);
    if (w > 0) heightInput.value = String(Math.max(1, Math.round(w / ratio)));
  });

  heightInput.addEventListener("input", () => {
    if (keepRatio.value !== "1" || !sourceImage) return;
    const h = Number(heightInput.value);
    if (h > 0) widthInput.value = String(Math.max(1, Math.round(h * ratio)));
  });

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  async function compressToTarget(canvas, type, maxBytes) {
    if (type === "image/png") {
      const blob = await canvasToBlob(canvas, type);
      return blob;
    }
    let low = 0.4;
    let high = 0.92;
    let best = await canvasToBlob(canvas, type, 0.85);
    for (let i = 0; i < 8; i++) {
      const q = (low + high) / 2;
      const blob = await canvasToBlob(canvas, type, q);
      if (!blob) break;
      best = blob;
      if (blob.size > maxBytes) high = q;
      else low = q;
    }
    // 若仍偏大，逐步降低质量
    let q = low;
    while (best && best.size > maxBytes && q > 0.35) {
      q -= 0.05;
      const blob = await canvasToBlob(canvas, type, q);
      if (blob) best = blob;
    }
    return best;
  }

  processBtn.addEventListener("click", async () => {
    if (!sourceImage) return;
    const w = Number(widthInput.value);
    const h = Number(heightInput.value);
    const maxKb = Number(maxKbInput.value);
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) {
      setStatus("宽高必须是正整数", "error");
      return;
    }
    if (!Number.isFinite(maxKb) || maxKb < 10 || maxKb > 1024) {
      setStatus("目标大小请设置在 10KB ~ 1024KB", "error");
      return;
    }

    setStatus("处理中...");
    processBtn.disabled = true;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(sourceImage, 0, 0, w, h);

      const type = formatSelect.value;
      const blob = await compressToTarget(canvas, type, Math.round(maxKb * 1024));
      if (!blob) throw new Error("导出失败");

      resultBlob = blob;
      const url = URL.createObjectURL(blob);
      resultPreview.src = url;
      resultPreview.hidden = false;
      downloadBtn.disabled = false;
      setStatus(`处理完成：${w}×${h}，${formatSize(blob.size)}`, "ok");
    } catch (err) {
      setStatus(err.message || "处理失败", "error");
    } finally {
      processBtn.disabled = false;
    }
  });

  downloadBtn.addEventListener("click", () => {
    if (!resultBlob) return;
    const ext = formatSelect.value.split("/")[1] || "jpg";
    const base = (sourceFile?.name || "image").replace(/\.[^.]+$/, "");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(resultBlob);
    a.download = `${base}-${widthInput.value}x${heightInput.value}.${ext}`;
    a.click();
  });

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
})();
