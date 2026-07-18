(() => {
  const $ = (id) => document.getElementById(id);
  const leftEl = $("left");
  const rightEl = $("right");
  const resultEl = $("diffResult");
  const statusEl = $("status");

  function setStatus(text, type = "") {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  function splitLines(text) {
    return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  }

  /** 基于 LCS 的按行 diff */
  function diffLines(aLines, bLines) {
    const n = aLines.length;
    const m = bLines.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (aLines[i] === bLines[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    const ops = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (aLines[i] === bLines[j]) {
        ops.push({ type: "same", text: aLines[i] });
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        ops.push({ type: "del", text: aLines[i] });
        i++;
      } else {
        ops.push({ type: "add", text: bLines[j] });
        j++;
      }
    }
    while (i < n) {
      ops.push({ type: "del", text: aLines[i++] });
    }
    while (j < m) {
      ops.push({ type: "add", text: bLines[j++] });
    }
    return ops;
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render(ops) {
    if (!ops.length) {
      resultEl.innerHTML = `<div class="diff-line same">（两端都为空）</div>`;
      return;
    }

    let add = 0;
    let del = 0;
    resultEl.innerHTML = ops
      .map((op) => {
        if (op.type === "add") add++;
        if (op.type === "del") del++;
        const mark = op.type === "add" ? "+" : op.type === "del" ? "-" : " ";
        const cls = op.type === "add" ? "add" : op.type === "del" ? "del" : "same";
        const content = op.text === "" ? " " : escapeHtml(op.text);
        return `<div class="diff-line ${cls}"><span class="diff-mark">${mark}</span><span class="diff-text">${content}</span></div>`;
      })
      .join("");

    setStatus(`对比完成：新增 ${add} 行，删除 ${del} 行`, "ok");
  }

  $("btnDiff").addEventListener("click", () => {
    const left = splitLines(leftEl.value);
    const right = splitLines(rightEl.value);
    // 两端都只有一个空字符串时，按空处理
    const a = leftEl.value === "" ? [] : left;
    const b = rightEl.value === "" ? [] : right;
    render(diffLines(a, b));
  });

  $("btnSwap").addEventListener("click", () => {
    const tmp = leftEl.value;
    leftEl.value = rightEl.value;
    rightEl.value = tmp;
    setStatus("已互换左右文本");
  });

  $("btnClear").addEventListener("click", () => {
    leftEl.value = "";
    rightEl.value = "";
    resultEl.innerHTML = "";
    setStatus("已清空");
  });
})();
