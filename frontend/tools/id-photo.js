(() => {
  const $ = (id) => document.getElementById(id);

  const SPECS = {
    one: { key: "one", label: "1寸", wMm: 25, hMm: 35, wPx: 295, hPx: 413 },
    two: { key: "two", label: "2寸", wMm: 35, hMm: 49, wPx: 413, hPx: 579 },
  };

  const BG_COLORS = {
    white: { r: 255, g: 255, b: 255, hex: "#ffffff" },
    blue: { r: 67, g: 142, b: 219, hex: "#438edb" },
    red: { r: 217, g: 43, b: 43, hex: "#d92b2b" },
  };

  const uploadZone = $("uploadZone");
  const fileInput = $("fileInput");
  const fileHint = $("fileHint");
  const fileMeta = $("fileMeta");
  const metaName = $("metaName");
  const metaOrigin = $("metaOrigin");
  const editorPanel = $("editorPanel");
  const editorCanvas = $("editorCanvas");
  const zoomInput = $("zoom");
  const toleranceInput = $("tolerance");
  const maxKbInput = $("maxKb");
  const pixelInfo = $("pixelInfo");
  const autoFaceBtn = $("autoFaceBtn");
  const processBtn = $("processBtn");
  const downloadBtn = $("downloadBtn");
  const clearBtn = $("clearBtn");
  const resultPanes = $("resultPanes");
  const resultPreview = $("resultPreview");
  const resultInfo = $("resultInfo");
  const statusEl = $("status");
  const specRow = $("specRow");
  const bgRow = $("bgRow");

  const ctx = editorCanvas.getContext("2d");

  /** @type {HTMLImageElement | null} */
  let sourceImage = null;
  /** @type {File | null} */
  let sourceFile = null;
  /** @type {string | null} */
  let sourceUrl = null;
  /** @type {Blob | null} */
  let resultBlob = null;
  /** @type {string | null} */
  let resultUrl = null;

  let specKey = "one";
  let bgKey = "white";
  /** image display scale on canvas (css px per source px) */
  let scale = 1;
  /** top-left of image on canvas */
  let offsetX = 0;
  let offsetY = 0;
  let baseScale = 1;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOriginX = 0;
  let dragOriginY = 0;

  function setStatus(text, type = "") {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function currentSpec() {
    return SPECS[specKey];
  }

  function cropFrame() {
    const pad = 18;
    const maxW = editorCanvas.width - pad * 2;
    const maxH = editorCanvas.height - pad * 2;
    const spec = currentSpec();
    const aspect = spec.wPx / spec.hPx;
    let cw = maxW;
    let ch = cw / aspect;
    if (ch > maxH) {
      ch = maxH;
      cw = ch * aspect;
    }
    return {
      x: (editorCanvas.width - cw) / 2,
      y: (editorCanvas.height - ch) / 2,
      w: cw,
      h: ch,
    };
  }

  function syncPixelInfo() {
    const s = currentSpec();
    pixelInfo.value = `${s.wPx} × ${s.hPx}`;
  }

  function fitImageToCrop(zoomPercent = 100) {
    if (!sourceImage) return;
    const frame = cropFrame();
    const cover = Math.max(frame.w / sourceImage.naturalWidth, frame.h / sourceImage.naturalHeight);
    baseScale = cover;
    scale = cover * (zoomPercent / 100);
    offsetX = frame.x + (frame.w - sourceImage.naturalWidth * scale) / 2;
    offsetY = frame.y + (frame.h - sourceImage.naturalHeight * scale) / 2;
  }

  function clampOffsets() {
    if (!sourceImage) return;
    const frame = cropFrame();
    const iw = sourceImage.naturalWidth * scale;
    const ih = sourceImage.naturalHeight * scale;
    // image must cover crop frame
    if (iw >= frame.w) {
      offsetX = Math.min(frame.x, offsetX);
      offsetX = Math.max(frame.x + frame.w - iw, offsetX);
    } else {
      offsetX = frame.x + (frame.w - iw) / 2;
    }
    if (ih >= frame.h) {
      offsetY = Math.min(frame.y, offsetY);
      offsetY = Math.max(frame.y + frame.h - ih, offsetY);
    } else {
      offsetY = frame.y + (frame.h - ih) / 2;
    }
  }

  function drawEditor() {
    if (!sourceImage) return;
    const w = editorCanvas.width;
    const h = editorCanvas.height;
    const frame = cropFrame();
    const bg = BG_COLORS[bgKey];

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#eef2f7";
    ctx.fillRect(0, 0, w, h);

    // preview target bg inside crop
    if (bg) {
      ctx.fillStyle = bg.hex;
      ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(frame.x, frame.y, frame.w, frame.h);
    ctx.clip();
    ctx.drawImage(
      sourceImage,
      offsetX,
      offsetY,
      sourceImage.naturalWidth * scale,
      sourceImage.naturalHeight * scale
    );
    ctx.restore();

    // dim outside crop
    ctx.fillStyle = "rgba(21, 32, 51, 0.45)";
    ctx.fillRect(0, 0, w, frame.y);
    ctx.fillRect(0, frame.y + frame.h, w, h - frame.y - frame.h);
    ctx.fillRect(0, frame.y, frame.x, frame.h);
    ctx.fillRect(frame.x + frame.w, frame.y, w - frame.x - frame.w, frame.h);

    // crop border
    ctx.strokeStyle = "#2f6fed";
    ctx.lineWidth = 2;
    ctx.strokeRect(frame.x + 1, frame.y + 1, frame.w - 2, frame.h - 2);

    // guide lines (eyes / head roughly)
    ctx.strokeStyle = "rgba(47, 111, 237, 0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const eyeY = frame.y + frame.h * 0.42;
    ctx.beginPath();
    ctx.moveTo(frame.x, eyeY);
    ctx.lineTo(frame.x + frame.w, eyeY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  async function compressToTarget(canvas, maxBytes) {
    let low = 0.4;
    let high = 0.92;
    let best = await canvasToBlob(canvas, "image/jpeg", 0.85);
    for (let i = 0; i < 8; i++) {
      const q = (low + high) / 2;
      const blob = await canvasToBlob(canvas, "image/jpeg", q);
      if (!blob) break;
      best = blob;
      if (blob.size > maxBytes) high = q;
      else low = q;
    }
    let q = low;
    while (best && best.size > maxBytes && q > 0.3) {
      q -= 0.05;
      const blob = await canvasToBlob(canvas, "image/jpeg", q);
      if (blob) best = blob;
    }
    return best;
  }

  function sampleBackgroundColor(data, width, height) {
    const pts = [
      [2, 2],
      [width - 3, 2],
      [2, height - 3],
      [width - 3, height - 3],
      [Math.floor(width * 0.15), 2],
      [Math.floor(width * 0.85), 2],
      [2, Math.floor(height * 0.2)],
      [width - 3, Math.floor(height * 0.2)],
    ];
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (const [x, y] of pts) {
      const i = (y * width + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
    return { r: r / n, g: g / n, b: b / n };
  }

  function colorDist(a, b) {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function replaceBackground(imageData, target, tolerance) {
    const { data, width, height } = imageData;
    const bg = sampleBackgroundColor(data, width, height);
    const cx = width / 2;
    const cy = height * 0.42;
    const rx = width * 0.38;
    const ry = height * 0.42;
    const soft = Math.max(8, tolerance * 0.55);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const pixel = { r: data[i], g: data[i + 1], b: data[i + 2] };
        const dist = colorDist(pixel, bg);

        // protect likely face/body ellipse
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const inSubject = nx * nx + ny * ny;
        let localTol = tolerance;
        if (inSubject < 1) localTol *= 0.45;
        else if (inSubject < 1.35) localTol *= 0.7;

        if (dist >= localTol + soft) continue;

        let alpha = 1;
        if (dist > localTol) {
          alpha = 1 - (dist - localTol) / soft;
        }
        // near subject core, reduce replacement
        if (inSubject < 0.85) alpha *= 0.15;
        else if (inSubject < 1.1) alpha *= 0.45;

        data[i] = Math.round(pixel.r * (1 - alpha) + target.r * alpha);
        data[i + 1] = Math.round(pixel.g * (1 - alpha) + target.g * alpha);
        data[i + 2] = Math.round(pixel.b * (1 - alpha) + target.b * alpha);
      }
    }
    return imageData;
  }

  function getSourceCropRect() {
    const frame = cropFrame();
    return {
      sx: (frame.x - offsetX) / scale,
      sy: (frame.y - offsetY) / scale,
      sw: frame.w / scale,
      sh: frame.h / scale,
    };
  }

  async function detectFaceBox() {
    if (!sourceImage) return null;
    if (typeof FaceDetector === "undefined") {
      return null;
    }
    try {
      const detector = new FaceDetector({ fastMode: false, maxDetectedFaces: 1 });
      const faces = await detector.detect(sourceImage);
      if (!faces || !faces.length) return null;
      const box = faces[0].boundingBox;
      return {
        x: box.x,
        y: box.y,
        w: box.width,
        h: box.height,
      };
    } catch {
      return null;
    }
  }

  function frameAroundFace(face) {
    if (!sourceImage) return;
    const frame = cropFrame();
    // Desired: face height ~52% of crop, face top ~14% from crop top
    const desiredFaceH = frame.h * 0.52;
    baseScale = Math.max(frame.w / sourceImage.naturalWidth, frame.h / sourceImage.naturalHeight);
    scale = Math.max(baseScale, desiredFaceH / Math.max(face.h, 1));
    const zoomPercent = Math.min(300, Math.max(100, Math.round((scale / baseScale) * 100)));
    scale = baseScale * (zoomPercent / 100);
    zoomInput.value = String(zoomPercent);

    const faceCenterX = face.x + face.w / 2;
    const faceTop = face.y;
    offsetX = frame.x + frame.w / 2 - faceCenterX * scale;
    offsetY = frame.y + frame.h * 0.14 - faceTop * scale;
    clampOffsets();
  }

  function clearResult() {
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      resultUrl = null;
    }
    resultBlob = null;
    resultPreview.hidden = true;
    resultPreview.removeAttribute("src");
    resultPanes.hidden = true;
    resultInfo.textContent = "生成后显示尺寸与文件大小";
    downloadBtn.disabled = true;
  }

  function resetAll() {
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
      sourceUrl = null;
    }
    sourceImage = null;
    sourceFile = null;
    fileInput.value = "";
    fileMeta.hidden = true;
    editorPanel.hidden = true;
    fileHint.textContent = "支持 JPG / PNG / WEBP，手机可直接拍照上传";
    clearResult();
    setStatus("");
  }

  function loadFile(file) {
    if (!file) return;
    const okType =
      (file.type && file.type.startsWith("image/")) ||
      /\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name || "");
    if (!okType) {
      setStatus("请选择图片文件", "error");
      return;
    }
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    clearResult();
    sourceFile = file;
    const url = URL.createObjectURL(file);
    sourceUrl = url;
    const img = new Image();
    img.onload = () => {
      sourceImage = img;
      zoomInput.value = "100";
      fitImageToCrop(100);
      clampOffsets();
      drawEditor();
      editorPanel.hidden = false;
      fileMeta.hidden = false;
      metaName.textContent = file.name || "photo";
      metaOrigin.textContent = `原图：${img.naturalWidth}×${img.naturalHeight}，${formatSize(file.size)}`;
      fileHint.textContent = file.name || "已选择图片";
      setStatus("已加载，可拖动/缩放调整构图后生成", "ok");
      // best-effort auto face
      autoFrame(true);
    };
    img.onerror = () => setStatus("图片读取失败", "error");
    img.src = url;
  }

  async function autoFrame(silent = false) {
    if (!sourceImage) return;
    setStatus(silent ? "正在尝试识别人脸…" : "正在定位人脸…");
    const face = await detectFaceBox();
    if (!face) {
      if (!silent) {
        setStatus("未识别到人脸，请手动拖动调整（部分浏览器不支持自动识脸）", "error");
      } else {
        setStatus("已加载，可拖动/缩放调整构图后生成", "ok");
      }
      drawEditor();
      return;
    }
    frameAroundFace(face);
    drawEditor();
    setStatus("已按人脸自动构图，可再微调", "ok");
  }

  async function processPhoto() {
    if (!sourceImage) return;
    const spec = currentSpec();
    const maxKb = Number(maxKbInput.value);
    if (!Number.isFinite(maxKb) || maxKb < 20 || maxKb > 1024) {
      setStatus("目标大小请设置在 20KB ~ 1024KB", "error");
      return;
    }

    processBtn.disabled = true;
    autoFaceBtn.disabled = true;
    setStatus("生成中…");

    try {
      const { sx, sy, sw, sh } = getSourceCropRect();
      const out = document.createElement("canvas");
      out.width = spec.wPx;
      out.height = spec.hPx;
      const octx = out.getContext("2d");
      octx.fillStyle = BG_COLORS[bgKey]?.hex || "#ffffff";
      octx.fillRect(0, 0, out.width, out.height);
      octx.drawImage(sourceImage, sx, sy, sw, sh, 0, 0, out.width, out.height);

      if (bgKey !== "keep") {
        const imgData = octx.getImageData(0, 0, out.width, out.height);
        const tol = Number(toleranceInput.value) || 38;
        // map slider 10-90 to color distance ~25-140
        const distTol = 20 + tol * 1.35;
        replaceBackground(imgData, BG_COLORS[bgKey], distTol);
        octx.putImageData(imgData, 0, 0);
      }

      const blob = await compressToTarget(out, Math.round(maxKb * 1024));
      if (!blob) throw new Error("导出失败");

      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultBlob = blob;
      resultUrl = URL.createObjectURL(blob);
      resultPreview.src = resultUrl;
      resultPreview.hidden = false;
      resultPanes.hidden = false;
      downloadBtn.disabled = false;
      resultInfo.textContent = [
        `规格：${spec.label}（${spec.wMm}×${spec.hMm}mm）`,
        `像素：${spec.wPx}×${spec.hPx} @ 300DPI`,
        `背景：${bgKey === "keep" ? "原背景" : bgKey === "white" ? "白底" : bgKey === "blue" ? "蓝底" : "红底"}`,
        `大小：${formatSize(blob.size)}`,
      ].join("\n");
      setStatus(`生成完成：${spec.wPx}×${spec.hPx}，${formatSize(blob.size)}`, "ok");
    } catch (err) {
      setStatus(err.message || "生成失败", "error");
    } finally {
      processBtn.disabled = false;
      autoFaceBtn.disabled = false;
    }
  }

  // events
  specRow.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-spec]");
    if (!btn) return;
    specKey = btn.getAttribute("data-spec");
    specRow.querySelectorAll(".preset").forEach((el) => {
      el.classList.toggle("is-active", el === btn);
    });
    syncPixelInfo();
    const zoomPercent = Number(zoomInput.value) || 100;
    if (sourceImage) {
      fitImageToCrop(zoomPercent);
      clampOffsets();
      drawEditor();
    }
  });

  bgRow.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-bg]");
    if (!btn) return;
    bgKey = btn.getAttribute("data-bg");
    bgRow.querySelectorAll(".preset").forEach((el) => {
      el.classList.toggle("is-active", el === btn);
    });
    drawEditor();
  });

  zoomInput.addEventListener("input", () => {
    if (!sourceImage) return;
    const frame = cropFrame();
    const centerX = frame.x + frame.w / 2;
    const centerY = frame.y + frame.h / 2;
    const srcCX = (centerX - offsetX) / scale;
    const srcCY = (centerY - offsetY) / scale;
    const zoomPercent = Number(zoomInput.value) || 100;
    scale = baseScale * (zoomPercent / 100);
    offsetX = centerX - srcCX * scale;
    offsetY = centerY - srcCY * scale;
    clampOffsets();
    drawEditor();
  });

  editorCanvas.addEventListener("pointerdown", (e) => {
    if (!sourceImage) return;
    dragging = true;
    editorCanvas.setPointerCapture(e.pointerId);
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragOriginX = offsetX;
    dragOriginY = offsetY;
  });
  editorCanvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const rect = editorCanvas.getBoundingClientRect();
    const scaleX = editorCanvas.width / rect.width;
    const scaleY = editorCanvas.height / rect.height;
    offsetX = dragOriginX + (e.clientX - dragStartX) * scaleX;
    offsetY = dragOriginY + (e.clientY - dragStartY) * scaleY;
    clampOffsets();
    drawEditor();
  });
  editorCanvas.addEventListener("pointerup", () => {
    dragging = false;
  });
  editorCanvas.addEventListener("pointercancel", () => {
    dragging = false;
  });
  editorCanvas.addEventListener(
    "wheel",
    (e) => {
      if (!sourceImage) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -8 : 8;
      const next = Math.min(300, Math.max(100, Number(zoomInput.value) + delta));
      zoomInput.value = String(next);
      zoomInput.dispatchEvent(new Event("input"));
    },
    { passive: false }
  );

  autoFaceBtn.addEventListener("click", () => autoFrame(false));
  processBtn.addEventListener("click", () => processPhoto());
  downloadBtn.addEventListener("click", () => {
    if (!resultBlob) return;
    const spec = currentSpec();
    const base = (sourceFile?.name || "id-photo").replace(/\.[^.]+$/, "");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(resultBlob);
    a.download = `${base}-${spec.label}-${spec.wPx}x${spec.hPx}.jpg`;
    a.click();
  });
  clearBtn.addEventListener("click", resetAll);

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

  syncPixelInfo();
})();
