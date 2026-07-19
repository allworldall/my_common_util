(() => {
  const $ = (id) => document.getElementById(id);
  const config = window.APP_CONFIG || {};
  const modal = $("feedbackModal");
  const formView = $("feedbackFormView");
  const successView = $("feedbackSuccessView");
  const contentEditor = $("feedbackContent");
  const contactInput = $("feedbackContact");
  const statusEl = $("feedbackStatus");
  const submitBtn = $("feedbackSubmit");

  const MAX_IMAGES = 3;
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

  /** @type {Map<string, { file: File, url: string, dataBase64: string, contentType: string }>} */
  const imageStore = new Map();
  let imageSeq = 0;

  function setStatus(text, type = "") {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  function apiUrl(path) {
    const base = (config.apiBase || "").replace(/\/+$/, "");
    return `${base}${path}`;
  }

  function showForm() {
    formView.hidden = false;
    successView.hidden = true;
    setStatus("");
  }

  function showSuccess() {
    formView.hidden = true;
    successView.hidden = false;
  }

  function syncPlaceholder() {
    const empty = !contentEditor.textContent.trim() && !contentEditor.querySelector("img");
    contentEditor.classList.toggle("is-empty", empty);
  }

  function clearEditor() {
    imageStore.forEach((item) => URL.revokeObjectURL(item.url));
    imageStore.clear();
    contentEditor.innerHTML = "";
    syncPlaceholder();
  }

  function countImages() {
    return contentEditor.querySelectorAll("img[data-image-id]").length;
  }

  function insertNodeAtCursor(node) {
    contentEditor.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !contentEditor.contains(selection.anchorNode)) {
      contentEditor.appendChild(node);
      placeCaretAfter(node);
      return;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);
    placeCaretAfter(node);
  }

  function placeCaretAfter(node) {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.readAsDataURL(file);
    });
  }

  async function persistClipboardFile(file) {
    // 剪贴板 File 可能在粘贴结束后失效，立刻拷贝字节并转成稳定 File
    const buffer = await file.arrayBuffer();
    const type = ALLOWED_TYPES.has(file.type) ? file.type : "image/png";
    const stable = new File([buffer], file.name || `paste-${Date.now()}.png`, { type });
    const dataBase64 = await readFileAsBase64(stable);
    return { file: stable, dataBase64, contentType: type };
  }

  function createInlineImage(persisted) {
    const id = `img-${++imageSeq}`;
    const url = URL.createObjectURL(persisted.file);
    imageStore.set(id, {
      file: persisted.file,
      url,
      dataBase64: persisted.dataBase64,
      contentType: persisted.contentType,
    });

    const img = document.createElement("img");
    img.src = url;
    img.alt = "粘贴的图片";
    img.dataset.imageId = id;
    img.className = "feedback-inline-image";
    img.contentEditable = "false";
    return img;
  }

  async function insertImageFiles(files) {
    const list = Array.from(files || []);
    let inserted = 0;

    for (const file of list) {
      if (countImages() >= MAX_IMAGES) {
        setStatus(`正文里最多粘贴 ${MAX_IMAGES} 张图片`, "error");
        break;
      }

      const type = file.type || "image/png";
      if (!ALLOWED_TYPES.has(type)) {
        setStatus("仅支持 JPG / PNG / GIF / WEBP 图片", "error");
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setStatus("单张图片不能超过 5MB", "error");
        continue;
      }

      try {
        const persisted = await persistClipboardFile(file);
        if (persisted.file.size > MAX_IMAGE_BYTES) {
          setStatus("单张图片不能超过 5MB", "error");
          continue;
        }
        const img = createInlineImage(persisted);
        insertNodeAtCursor(img);
        insertNodeAtCursor(document.createTextNode("\u200b"));
        inserted += 1;
        setStatus("");
      } catch (err) {
        setStatus(err.message || "图片粘贴失败", "error");
      }
    }

    if (inserted) syncPlaceholder();
    return inserted > 0;
  }

  function serializeContent() {
    let text = "";
    const images = [];

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent.replace(/\u200b/g, "");
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      if (node.tagName === "IMG" && node.dataset.imageId) {
        const stored = imageStore.get(node.dataset.imageId);
        if (stored && stored.dataBase64) {
          images.push({
            name: stored.file.name || `screenshot-${images.length + 1}.png`,
            contentType: stored.contentType || stored.file.type || "image/png",
            dataBase64: stored.dataBase64,
          });
          text += `\n[图片${images.length}]\n`;
        }
        return;
      }
      if (node.tagName === "BR") {
        text += "\n";
        return;
      }
      if (node.tagName === "DIV" || node.tagName === "P") {
        if (text && !text.endsWith("\n")) text += "\n";
        Array.from(node.childNodes).forEach(walk);
        if (!text.endsWith("\n")) text += "\n";
        return;
      }
      Array.from(node.childNodes).forEach(walk);
    };

    Array.from(contentEditor.childNodes).forEach(walk);
    return {
      content: text.replace(/\n{3,}/g, "\n\n").trim(),
      images,
    };
  }

  function openModal() {
    showForm();
    modal.hidden = false;
    syncPlaceholder();
  }

  function closeModal() {
    modal.hidden = true;
    contactInput.value = "";
    clearEditor();
    submitBtn.disabled = false;
    showForm();
  }

  async function parseError(response) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return data.message || `提交失败(${response.status})`;
    }
    return `提交失败(${response.status})`;
  }

  // —— 工具需求弹窗 ——
  const toolModal = $("toolRequestModal");
  const toolFormView = $("toolRequestFormView");
  const toolSuccessView = $("toolRequestSuccessView");
  const toolScenario = $("toolRequestScenario");
  const toolUsage = $("toolRequestUsage");
  const toolContact = $("toolRequestContact");
  const toolStatus = $("toolRequestStatus");
  const toolSubmitBtn = $("toolRequestSubmit");

  function setToolStatus(text, type = "") {
    toolStatus.textContent = text || "";
    toolStatus.className = "status" + (type ? ` ${type}` : "");
  }

  function showToolForm() {
    toolFormView.hidden = false;
    toolSuccessView.hidden = true;
    setToolStatus("");
  }

  function showToolSuccess() {
    toolFormView.hidden = true;
    toolSuccessView.hidden = false;
  }

  function openToolModal() {
    showToolForm();
    toolModal.hidden = false;
  }

  function closeToolModal() {
    toolModal.hidden = true;
    toolScenario.value = "";
    toolUsage.value = "";
    toolContact.value = "";
    toolSubmitBtn.disabled = false;
    showToolForm();
  }

  $("feedbackOpen").addEventListener("click", openModal);
  $("feedbackCancel").addEventListener("click", closeModal);
  $("feedbackDone").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  $("toolRequestOpen").addEventListener("click", openToolModal);
  $("toolRequestCancel").addEventListener("click", closeToolModal);
  $("toolRequestDone").addEventListener("click", closeToolModal);
  toolModal.addEventListener("click", (e) => {
    if (e.target === toolModal) closeToolModal();
  });

  toolSubmitBtn.addEventListener("click", async () => {
    const scenario = toolScenario.value.trim();
    const usage = toolUsage.value.trim();
    const contact = toolContact.value.trim();

    if (!scenario) {
      setToolStatus("请描述工具的使用场景", "error");
      return;
    }
    if (!usage) {
      setToolStatus("请描述大概的使用方式", "error");
      return;
    }
    if (!contact) {
      setToolStatus("请留下联系方式，方便我们进一步沟通", "error");
      return;
    }

    toolSubmitBtn.disabled = true;
    setToolStatus("正在提交，请稍候…");

    try {
      const res = await fetch(apiUrl("/api/feedback/tool-request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, usage, contact }),
      });
      if (!res.ok) {
        throw new Error(await parseError(res));
      }
      const data = await res.json();
      if (data && data.success === false) {
        throw new Error(data.message || "提交失败");
      }
      showToolSuccess();
    } catch (err) {
      setToolStatus(err.message || "提交失败，请稍后重试", "error");
      toolSubmitBtn.disabled = false;
    }
  });

  contentEditor.addEventListener("input", syncPlaceholder);

  contentEditor.addEventListener("paste", (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageFiles = items
      .filter((item) => item.type && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean);

    if (!imageFiles.length) return;

    e.preventDefault();
    insertImageFiles(imageFiles);
  });

  contentEditor.addEventListener("input", () => {
    const alive = new Set(
      Array.from(contentEditor.querySelectorAll("img[data-image-id]")).map((img) => img.dataset.imageId)
    );
    imageStore.forEach((item, id) => {
      if (!alive.has(id)) {
        URL.revokeObjectURL(item.url);
        imageStore.delete(id);
      }
    });
  });

  submitBtn.addEventListener("click", async () => {
    const { content, images } = serializeContent();
    const contact = contactInput.value.trim();

    if (!content && images.length === 0) {
      setStatus("请先填写问题描述", "error");
      return;
    }
    if (!content) {
      setStatus("请至少写一点文字说明，方便我们理解截图含义", "error");
      return;
    }
    if (!contact) {
      setStatus("请留下联系方式，方便我们优化后通知您", "error");
      return;
    }
    if (/\[图片\d+\]/.test(content) && images.length === 0) {
      setStatus("图片数据丢失，请重新粘贴后再提交", "error");
      return;
    }

    submitBtn.disabled = true;
    setStatus("正在提交，请稍候…");

    try {
      const res = await fetch(apiUrl("/api/feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          contact,
          images,
        }),
      });
      if (!res.ok) {
        throw new Error(await parseError(res));
      }
      const data = await res.json();
      if (data && data.success === false) {
        throw new Error(data.message || "提交失败");
      }
      showSuccess();
    } catch (err) {
      setStatus(err.message || "提交失败，请稍后重试", "error");
      submitBtn.disabled = false;
    }
  });

  syncPlaceholder();
})();
