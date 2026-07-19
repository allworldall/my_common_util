(() => {
  const $ = (id) => document.getElementById(id);
  const config = window.APP_CONFIG || {};

  const fileInput = $("fileInput");
  const uploadZone = $("uploadZone");
  const fileHint = $("fileHint");
  const previewList = $("previewList");
  const scanMode = $("scanMode");
  const scanBtn = $("scanBtn");
  const clearBtn = $("clearBtn");
  const statusEl = $("status");
  const modal = $("modal");
  const modalDesc = $("modalDesc");
  const saveAsBtn = $("saveAsBtn");
  const downloadBtn = $("downloadBtn");
  const cancelBtn = $("cancelBtn");

  const MAX_BYTES = Number(config.scanMaxFileSizeBytes) || 8 * 1024 * 1024;
  const MAX_IMAGES = Number(config.scanMaxImages) || 10;
  const ALLOWED = new Set(["image/jpeg", "image/png", "image/bmp", "image/gif"]);

  /** @type {{ file: File, url: string }[]} */
  let items = [];
  let pendingBlob = null;
  let pendingFileName = "scan.pdf";

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

  function syncActions() {
    const has = items.length > 0;
    scanBtn.disabled = !has;
    clearBtn.disabled = !has;
    previewList.hidden = !has;
    fileHint.textContent = has
      ? `已选 ${items.length} 张（最多 ${MAX_IMAGES} 张）`
      : `支持 JPG / PNG / BMP / GIF，最多 ${MAX_IMAGES} 张，单张 ${Math.round(MAX_BYTES / (1024 * 1024))}MB`;
  }

  function renderPreview() {
    previewList.innerHTML = items
      .map(
        (item, index) => `
      <div class="scan-thumb">
        <img src="${item.url}" alt="预览 ${index + 1}" />
        <div class="scan-thumb-meta">
          <span>${index + 1}. ${item.file.name}</span>
          <button type="button" class="scan-thumb-remove" data-index="${index}" aria-label="移除">×</button>
        </div>
      </div>`
      )
      .join("");
    syncActions();
  }

  function clearItems() {
    items.forEach((item) => URL.revokeObjectURL(item.url));
    items = [];
    fileInput.value = "";
    renderPreview();
    setStatus("");
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;

    for (const file of incoming) {
      if (items.length >= MAX_IMAGES) {
        setStatus(`最多上传 ${MAX_IMAGES} 张图片`, "error");
        break;
      }

      const type = file.type || "";
      const name = (file.name || "").toLowerCase();
      const okType = ALLOWED.has(type)
        || name.endsWith(".jpg")
        || name.endsWith(".jpeg")
        || name.endsWith(".png")
        || name.endsWith(".bmp")
        || name.endsWith(".gif");
      if (!okType) {
        setStatus(`已跳过不支持的文件：${file.name}`, "error");
        continue;
      }
      if (file.size > MAX_BYTES) {
        setStatus(`${file.name} 超过 ${Math.round(MAX_BYTES / (1024 * 1024))}MB`, "error");
        continue;
      }

      items.push({
        file,
        url: URL.createObjectURL(file),
      });
    }

    renderPreview();
    if (items.length) {
      setStatus(`已添加图片，当前共 ${items.length} 张`, "ok");
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
  fileInput.addEventListener("change", () => {
    addFiles(fileInput.files);
    fileInput.value = "";
  });

  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("dragover");
  });
  uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("dragover");
    addFiles(e.dataTransfer.files);
  });

  previewList.addEventListener("click", (e) => {
    const btn = e.target.closest(".scan-thumb-remove");
    if (!btn) return;
    const index = Number(btn.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= items.length) return;
    URL.revokeObjectURL(items[index].url);
    items.splice(index, 1);
    renderPreview();
    setStatus(items.length ? `已移除，当前共 ${items.length} 张` : "");
  });

  clearBtn.addEventListener("click", clearItems);

  scanBtn.addEventListener("click", async () => {
    if (!items.length) return;

    scanBtn.disabled = true;
    setStatus("正在扫描生成 PDF，请稍候…");

    const form = new FormData();
    items.forEach((item) => form.append("files", item.file, item.file.name));
    form.append("mode", scanMode.value || "document");

    try {
      const res = await fetch(apiUrl("/api/pdf/scan"), {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      if (!res.ok) {
        throw new Error(await parseError(res));
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      let fileName = "scan.pdf";
      const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (match) {
        fileName = decodeURIComponent(match[1]);
      }
      openModal(blob, fileName);
      setStatus("扫描成功，请在弹窗中选择保存方式", "ok");
    } catch (err) {
      setStatus(err.message || "扫描失败", "error");
    } finally {
      scanBtn.disabled = items.length === 0;
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

  syncActions();
})();
