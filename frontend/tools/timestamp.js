(() => {
  const $ = (id) => document.getElementById(id);
  const statusEl = $("status");
  const nowTsEl = $("nowTs");
  const toggleBtn = $("toggleNow");

  let ticking = true;
  let timer = null;

  function setStatus(text, type = "") {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  /** 按北京时间格式化 */
  function formatBeijing(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const get = (type) => parts.find((p) => p.type === type)?.value || "00";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
  }

  /** 把北京时间字符串解析成 Date */
  function parseBeijing(text) {
    const m = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return null;
    const [, y, mo, d, h, mi, s = "00"] = m;
    // 用 Asia/Shanghai 偏移近似：先按本地构造再校正较复杂，这里用固定 +08:00
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+08:00`);
  }

  function refreshNow() {
    nowTsEl.textContent = String(Math.floor(Date.now() / 1000));
  }

  function startTick() {
    stopTick();
    ticking = true;
    toggleBtn.textContent = "控制：停止";
    toggleBtn.classList.add("is-stop");
    refreshNow();
    timer = setInterval(refreshNow, 1000);
  }

  function stopTick() {
    ticking = false;
    toggleBtn.textContent = "控制：开始";
    toggleBtn.classList.remove("is-stop");
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  toggleBtn.addEventListener("click", () => {
    if (ticking) stopTick();
    else startTick();
  });

  $("tsToDate").addEventListener("click", () => {
    const raw = $("tsInput").value.trim();
    if (!/^\d+$/.test(raw)) {
      setStatus("请输入纯数字时间戳", "error");
      return;
    }
    const unit = $("tsUnit").value;
    let ms = Number(raw);
    if (unit === "s") ms *= 1000;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) {
      setStatus("时间戳无效", "error");
      return;
    }
    $("dateResult").value = formatBeijing(date);
    setStatus("");
  });

  $("dateToTs").addEventListener("click", () => {
    const date = parseBeijing($("dateInput").value);
    if (!date || Number.isNaN(date.getTime())) {
      setStatus("请输入格式：yyyy-MM-dd HH:mm:ss", "error");
      return;
    }
    const ms = date.getTime();
    const unit = $("dateUnit").value;
    $("tsResult").value = unit === "ms" ? String(ms) : String(Math.floor(ms / 1000));
    setStatus("");
  });

  // 切换结果单位时，若已有时间则按新单位重算
  $("dateUnit").addEventListener("change", () => {
    const dateText = $("dateInput").value.trim();
    if (dateText) $("dateToTs").click();
  });

  // 初始填入当前北京时间
  $("dateInput").value = formatBeijing(new Date());
  $("tsInput").value = String(Math.floor(Date.now() / 1000));
  startTick();
})();
