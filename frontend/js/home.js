(() => {
  // 防止浏览器刷新时恢复滚动位置
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);

  const root = document.getElementById("categoryList");
  const categories = window.TOOL_CATEGORIES || [];

  const ICONS = {
    "pdf-split": `
      <svg viewBox="0 0 64 64" width="36" height="36"><rect x="12" y="8" width="28" height="38" rx="3" fill="#fff" stroke="currentColor" stroke-width="2.2"/><path d="M40 16h10v32a3 3 0 0 1-3 3H28" fill="#e8f1ff" stroke="currentColor" stroke-width="2.2"/><path d="M19 22h12M19 29h12M19 36h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M34 46l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    image: `
      <svg viewBox="0 0 64 64" width="36" height="36"><rect x="10" y="14" width="44" height="36" rx="6" fill="#e8f1ff" stroke="currentColor" stroke-width="2.2"/><circle cx="24" cy="28" r="5" fill="#fff" stroke="currentColor" stroke-width="2"/><path d="M12 42l12-10 8 7 8-12 12 15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    "image-scan": `
      <svg viewBox="0 0 64 64" width="36" height="36"><rect x="14" y="10" width="36" height="44" rx="4" fill="#fff" stroke="currentColor" stroke-width="2.2"/><path d="M20 20h24M20 28h18M20 36h20M20 44h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10 22v-6a4 4 0 0 1 4-4h6M54 22v-6a4 4 0 0 0-4-4h-6M10 42v6a4 4 0 0 0 4 4h6M54 42v6a4 4 0 0 1-4 4h-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    "image-ocr": `
      <svg viewBox="0 0 64 64" width="36" height="36"><rect x="10" y="14" width="44" height="36" rx="6" fill="#e8f1ff" stroke="currentColor" stroke-width="2.2"/><path d="M18 24h12M18 32h18M18 40h10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="44" cy="38" r="9" fill="#fff" stroke="currentColor" stroke-width="2.2"/><path d="M41 38h6M44 35v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    json: `
      <svg viewBox="0 0 64 64" width="36" height="36"><path d="M22 14c-6 0-8 4-8 8v6c0 3-2 4-4 4 2 0 4 1 4 4v6c0 4 2 8 8 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M42 14c6 0 8 4 8 8v6c0 3 2 4 4 4-2 0-4 1-4 4v6c0 4-2 8-8 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="32" cy="32" r="3.2" fill="currentColor"/></svg>`,
    timestamp: `
      <svg viewBox="0 0 64 64" width="36" height="36"><circle cx="32" cy="34" r="18" fill="#e8f1ff" stroke="currentColor" stroke-width="2.2"/><path d="M32 24v11l7 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 12h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    base64: `
      <svg viewBox="0 0 64 64" width="36" height="36"><rect x="10" y="16" width="44" height="32" rx="8" fill="#e8f1ff" stroke="currentColor" stroke-width="2.2"/><text x="32" y="38" text-anchor="middle" font-size="14" font-family="ui-monospace,monospace" font-weight="700" fill="currentColor">64</text></svg>`,
    url: `
      <svg viewBox="0 0 64 64" width="36" height="36"><path d="M26 38a12 12 0 0 1 0-17l5-5a12 12 0 1 1 17 17l-3 3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M38 26a12 12 0 0 1 0 17l-5 5a12 12 0 1 1-17-17l3-3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    md5: `
      <svg viewBox="0 0 64 64" width="36" height="36"><rect x="10" y="16" width="44" height="32" rx="8" fill="#e8f1ff" stroke="currentColor" stroke-width="2.2"/><text x="32" y="38" text-anchor="middle" font-size="13" font-family="ui-monospace,monospace" font-weight="700" fill="currentColor">MD5</text></svg>`,
    uuid: `
      <svg viewBox="0 0 64 64" width="36" height="36"><rect x="12" y="18" width="40" height="28" rx="8" fill="#e8f1ff" stroke="currentColor" stroke-width="2.2"/><path d="M20 32h24M28 26v12M36 26v12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    diff: `
      <svg viewBox="0 0 64 64" width="36" height="36"><rect x="10" y="14" width="20" height="36" rx="4" fill="#e8f1ff" stroke="currentColor" stroke-width="2"/><rect x="34" y="14" width="20" height="36" rx="4" fill="#fff" stroke="currentColor" stroke-width="2"/><path d="M16 26h8M16 34h8M40 26h8M40 34h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    "list-convert": `
      <svg viewBox="0 0 64 64" width="36" height="36"><rect x="12" y="14" width="40" height="36" rx="8" fill="#e8f1ff" stroke="currentColor" stroke-width="2.2"/><path d="M22 26h8M22 32h14M22 38h10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M40 28l6 4-6 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };

  function fallbackIcon() {
    return `<svg viewBox="0 0 64 64" width="36" height="36"><rect x="14" y="14" width="36" height="36" rx="10" fill="#e8f1ff" stroke="currentColor" stroke-width="2"/><path d="M26 32h12M32 26v12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  }

  if (!categories.length) {
    root.innerHTML = `<p class="tool-empty">暂无可用工具</p>`;
    return;
  }

  root.innerHTML = categories
    .map((category) => {
      const toolsHtml = (category.tools || [])
        .map((tool) => {
          const icon = ICONS[tool.icon] || fallbackIcon();
          return `
            <a class="tool-item" href="${tool.href}" title="${tool.desc || tool.name}">
              <span class="tool-icon">${icon}</span>
              <span class="tool-name">${tool.name}</span>
            </a>
          `;
        })
        .join("");

      return `
        <section class="category-row" id="${category.id}">
          <h2 class="category-label">${category.name}</h2>
          <div class="tool-row">${toolsHtml}</div>
        </section>
      `;
    })
    .join("");
})();
