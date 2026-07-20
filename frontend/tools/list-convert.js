(() => {
  const $ = (id) => document.getElementById(id);
  const input = $("input");
  const output = $("output");
  const statusEl = $("status");
  const inSep = $("inSep");
  const outSep = $("outSep");
  const quote = $("quote");
  const inCustom = $("inCustom");
  const outCustom = $("outCustom");
  const customSepRow = $("customSepRow");

  const PRESETS = {
    "lines-to-comma": { inSep: "newline", outSep: "comma", quote: "none" },
    "comma-to-lines": { inSep: "comma", outSep: "newline", quote: "none" },
    "lines-to-sql": { inSep: "newline", outSep: "sql-in", quote: "single" },
    "lines-to-json": { inSep: "newline", outSep: "json", quote: "none" },
    "space-to-lines": { inSep: "space", outSep: "newline", quote: "none" },
    "dunhao-to-lines": { inSep: "dunhao", outSep: "newline", quote: "none" },
    "tab-to-lines": { inSep: "tab", outSep: "newline", quote: "none" },
    "lines-to-comma-space": { inSep: "newline", outSep: "comma-space", quote: "none" },
  };

  const SEP_LABEL = {
    newline: "换行",
    comma: "逗号",
    "comma-space": "逗号空格",
    semicolon: "分号",
    space: "空格",
    tab: "Tab",
    pipe: "竖线",
    dunhao: "顿号",
    custom: "自定义",
    json: "JSON",
    "sql-in": "SQL IN",
  };

  function setStatus(text, type = "") {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  function syncCustomRow() {
    const show = inSep.value === "custom" || outSep.value === "custom";
    customSepRow.hidden = !show;
  }

  function detectSeparator(text) {
    if (!text.trim()) return "newline";
    const newlineCount = (text.match(/\r?\n/g) || []).length;
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (newlineCount >= 1 && lines.length > 1) return "newline";

    const scores = [
      ["comma", (text.match(/,/g) || []).length],
      ["semicolon", (text.match(/;/g) || []).length],
      ["dunhao", (text.match(/、/g) || []).length],
      ["pipe", (text.match(/\|/g) || []).length],
      ["tab", (text.match(/\t/g) || []).length],
    ].sort((a, b) => b[1] - a[1]);

    if (scores[0][1] > 0) return scores[0][0];
    if (/\s/.test(text.trim()) && text.trim().split(/\s+/).length > 1) {
      return "space";
    }
    return "newline";
  }

  function splitBy(text, sepKey) {
    const key = sepKey === "auto" ? detectSeparator(text) : sepKey;
    switch (key) {
      case "newline":
        return text.split(/\r?\n/);
      case "comma":
      case "comma-space":
        return text.split(",");
      case "semicolon":
        return text.split(";");
      case "space":
        return text.trim() ? text.trim().split(/\s+/) : [];
      case "tab":
        return text.split("\t");
      case "pipe":
        return text.split("|");
      case "dunhao":
        return text.split("、");
      case "custom": {
        const raw = inCustom.value;
        if (!raw) return [text];
        return text.split(raw);
      }
      default:
        return text.split(/\r?\n/);
    }
  }

  function joinBy(items, sepKey) {
    switch (sepKey) {
      case "newline":
        return items.join("\n");
      case "comma":
        return items.join(",");
      case "comma-space":
        return items.join(", ");
      case "semicolon":
        return items.join(";");
      case "space":
        return items.join(" ");
      case "tab":
        return items.join("\t");
      case "pipe":
        return items.join("|");
      case "dunhao":
        return items.join("、");
      case "json":
        return JSON.stringify(items);
      case "sql-in":
        return "IN (" + items.join(", ") + ")";
      case "custom":
        return items.join(outCustom.value);
      default:
        return items.join(",");
    }
  }

  function stripSurroundingQuotes(item) {
    const s = item.trim();
    if (s.length >= 2) {
      const a = s[0];
      const b = s[s.length - 1];
      if ((a === "'" && b === "'") || (a === '"' && b === '"') || (a === "`" && b === "`")) {
        return s.slice(1, -1);
      }
    }
    return item;
  }

  function wrapItem(item, mode) {
    if (mode === "single") {
      return "'" + item.replace(/'/g, "''") + "'";
    }
    if (mode === "double") {
      return '"' + item.replace(/"/g, '\\"') + '"';
    }
    if (mode === "backtick") {
      return "`" + item.replace(/`/g, "``") + "`";
    }
    return item;
  }

  function convert() {
    const raw = input.value;
    if (!raw.trim()) {
      output.value = "";
      setStatus("请先粘贴要转换的列表", "error");
      return;
    }

    if (inSep.value === "custom" && !inCustom.value) {
      setStatus("请填写自定义输入分隔符", "error");
      return;
    }

    let items = splitBy(raw, inSep.value);

    if ($("optTrim").checked) {
      items = items.map((s) => s.trim());
    }
    if ($("optStripQuote").checked) {
      items = items.map(stripSurroundingQuotes);
      if ($("optTrim").checked) {
        items = items.map((s) => s.trim());
      }
    }
    if ($("optEmpty").checked) {
      items = items.filter((s) => s.length > 0);
    }
    if ($("optDedupe").checked) {
      const seen = new Set();
      items = items.filter((s) => {
        if (seen.has(s)) return false;
        seen.add(s);
        return true;
      });
    }
    if ($("optSort").checked) {
      items = items.slice().sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
    }
    if ($("optReverse").checked) {
      items = items.slice().reverse();
    }

    // SQL IN / JSON: auto-apply sensible quoting when user left "none"
    let quoteMode = quote.value;
    if (outSep.value === "sql-in" && quoteMode === "none") {
      quoteMode = "single";
    }

    const wrapped =
      outSep.value === "json"
        ? items // joinBy(json) stringifies raw items
        : items.map((s) => wrapItem(s, quoteMode));

    output.value = joinBy(wrapped, outSep.value);

    const detected =
      inSep.value === "auto" ? `（识别为${SEP_LABEL[detectSeparator(raw)] || "换行"}）` : "";
    setStatus(`完成：共 ${items.length} 项${detected}`, "ok");
  }

  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    inSep.value = p.inSep;
    outSep.value = p.outSep;
    quote.value = p.quote;
    // SQL IN 场景默认去掉原有引号，避免 ''a''
    if (name === "lines-to-sql") {
      $("optStripQuote").checked = true;
    }
    syncCustomRow();
    highlightPreset(name);
    convert();
  }

  function highlightPreset(name) {
    $("presets").querySelectorAll(".preset").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.preset === name);
    });
  }

  function swapIO() {
    const a = input.value;
    input.value = output.value;
    output.value = a;
    // swap separator direction when possible
    const mapBack = {
      comma: "comma",
      "comma-space": "comma",
      "sql-in": "comma",
      json: "newline",
      newline: "newline",
      space: "space",
      tab: "tab",
      pipe: "pipe",
      dunhao: "dunhao",
      semicolon: "semicolon",
    };
    const prevOut = outSep.value;
    const prevIn = inSep.value === "auto" ? detectSeparator(a) : inSep.value;
    if (mapBack[prevOut] && prevIn !== "custom") {
      inSep.value = mapBack[prevOut] === "sql-in" ? "comma" : mapBack[prevOut];
      outSep.value = prevIn === "auto" ? "newline" : prevIn;
    }
    syncCustomRow();
    setStatus("已交换输入与输出");
  }

  async function copyOut() {
    const text = output.value;
    if (!text) {
      setStatus("没有可复制内容", "error");
      return;
    }
    await navigator.clipboard.writeText(text);
    setStatus("已复制", "ok");
  }

  function clearAll() {
    input.value = "";
    output.value = "";
    $("presets").querySelectorAll(".preset").forEach((btn) => btn.classList.remove("is-active"));
    setStatus("已清空");
  }

  inSep.addEventListener("change", syncCustomRow);
  outSep.addEventListener("change", () => {
    syncCustomRow();
    if (outSep.value === "sql-in" && quote.value === "none") {
      quote.value = "single";
    }
  });
  $("btnConvert").addEventListener("click", convert);
  $("btnSwap").addEventListener("click", swapIO);
  $("btnCopy").addEventListener("click", copyOut);
  $("btnClear").addEventListener("click", clearAll);

  $("presets").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-preset]");
    if (!btn) return;
    applyPreset(btn.dataset.preset);
  });

  input.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      convert();
    }
  });

  syncCustomRow();
})();
