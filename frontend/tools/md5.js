(() => {
  const $ = (id) => document.getElementById(id);
  const input = $("input");
  const output = $("output");
  const statusEl = $("status");
  const caseMode = $("caseMode");
  const uploadZone = $("uploadZone");
  const fileInput = $("fileInput");
  const fileHint = $("fileHint");

  function setStatus(text, type = "") {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function applyCase(hex) {
    return caseMode.value === "upper" ? hex.toUpperCase() : hex.toLowerCase();
  }

  /**
   * 精简 MD5 实现（RFC 1321），支持字符串与 Uint8Array
   */
  function md5(data) {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;

    function cmn(q, a, b, x, s, t) {
      a = (a + q + x + t) | 0;
      return (((a << s) | (a >>> (32 - s))) + b) | 0;
    }
    function ff(a, b, c, d, x, s, t) {
      return cmn((b & c) | (~b & d), a, b, x, s, t);
    }
    function gg(a, b, c, d, x, s, t) {
      return cmn((b & d) | (c & ~d), a, b, x, s, t);
    }
    function hh(a, b, c, d, x, s, t) {
      return cmn(b ^ c ^ d, a, b, x, s, t);
    }
    function ii(a, b, c, d, x, s, t) {
      return cmn(c ^ (b | ~d), a, b, x, s, t);
    }

    const originalLen = bytes.length;
    const bitLenLo = (originalLen * 8) >>> 0;
    const bitLenHi = Math.floor(originalLen / 0x20000000);

    let withPadLen = (((originalLen + 8) >>> 6) + 1) << 6;
    const buffer = new Uint8Array(withPadLen);
    buffer.set(bytes);
    buffer[originalLen] = 0x80;
    const view = new DataView(buffer.buffer);
    view.setUint32(withPadLen - 8, bitLenLo, true);
    view.setUint32(withPadLen - 4, bitLenHi, true);

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;

    for (let i = 0; i < withPadLen; i += 64) {
      const x = new Array(16);
      for (let j = 0; j < 16; j++) {
        x[j] = view.getUint32(i + j * 4, true);
      }

      let a = a0;
      let b = b0;
      let c = c0;
      let d = d0;

      a = ff(a, b, c, d, x[0], 7, 0xd76aa478);
      d = ff(d, a, b, c, x[1], 12, 0xe8c7b756);
      c = ff(c, d, a, b, x[2], 17, 0x242070db);
      b = ff(b, c, d, a, x[3], 22, 0xc1bdceee);
      a = ff(a, b, c, d, x[4], 7, 0xf57c0faf);
      d = ff(d, a, b, c, x[5], 12, 0x4787c62a);
      c = ff(c, d, a, b, x[6], 17, 0xa8304613);
      b = ff(b, c, d, a, x[7], 22, 0xfd469501);
      a = ff(a, b, c, d, x[8], 7, 0x698098d8);
      d = ff(d, a, b, c, x[9], 12, 0x8b44f7af);
      c = ff(c, d, a, b, x[10], 17, 0xffff5bb1);
      b = ff(b, c, d, a, x[11], 22, 0x895cd7be);
      a = ff(a, b, c, d, x[12], 7, 0x6b901122);
      d = ff(d, a, b, c, x[13], 12, 0xfd987193);
      c = ff(c, d, a, b, x[14], 17, 0xa679438e);
      b = ff(b, c, d, a, x[15], 22, 0x49b40821);

      a = gg(a, b, c, d, x[1], 5, 0xf61e2562);
      d = gg(d, a, b, c, x[6], 9, 0xc040b340);
      c = gg(c, d, a, b, x[11], 14, 0x265e5a51);
      b = gg(b, c, d, a, x[0], 20, 0xe9b6c7aa);
      a = gg(a, b, c, d, x[5], 5, 0xd62f105d);
      d = gg(d, a, b, c, x[10], 9, 0x02441453);
      c = gg(c, d, a, b, x[15], 14, 0xd8a1e681);
      b = gg(b, c, d, a, x[4], 20, 0xe7d3fbc8);
      a = gg(a, b, c, d, x[9], 5, 0x21e1cde6);
      d = gg(d, a, b, c, x[14], 9, 0xc33707d6);
      c = gg(c, d, a, b, x[3], 14, 0xf4d50d87);
      b = gg(b, c, d, a, x[8], 20, 0x455a14ed);
      a = gg(a, b, c, d, x[13], 5, 0xa9e3e905);
      d = gg(d, a, b, c, x[2], 9, 0xfcefa3f8);
      c = gg(c, d, a, b, x[7], 14, 0x676f02d9);
      b = gg(b, c, d, a, x[12], 20, 0x8d2a4c8a);

      a = hh(a, b, c, d, x[5], 4, 0xfffa3942);
      d = hh(d, a, b, c, x[8], 11, 0x8771f681);
      c = hh(c, d, a, b, x[11], 16, 0x6d9d6122);
      b = hh(b, c, d, a, x[14], 23, 0xfde5380c);
      a = hh(a, b, c, d, x[1], 4, 0xa4beea44);
      d = hh(d, a, b, c, x[4], 11, 0x4bdecfa9);
      c = hh(c, d, a, b, x[7], 16, 0xf6bb4b60);
      b = hh(b, c, d, a, x[10], 23, 0xbebfbc70);
      a = hh(a, b, c, d, x[13], 4, 0x289b7ec6);
      d = hh(d, a, b, c, x[0], 11, 0xeaa127fa);
      c = hh(c, d, a, b, x[3], 16, 0xd4ef3085);
      b = hh(b, c, d, a, x[6], 23, 0x04881d05);
      a = hh(a, b, c, d, x[9], 4, 0xd9d4d039);
      d = hh(d, a, b, c, x[12], 11, 0xe6db99e5);
      c = hh(c, d, a, b, x[15], 16, 0x1fa27cf8);
      b = hh(b, c, d, a, x[2], 23, 0xc4ac5665);

      a = ii(a, b, c, d, x[0], 6, 0xf4292244);
      d = ii(d, a, b, c, x[7], 10, 0x432aff97);
      c = ii(c, d, a, b, x[14], 15, 0xab9423a7);
      b = ii(b, c, d, a, x[5], 21, 0xfc93a039);
      a = ii(a, b, c, d, x[12], 6, 0x655b59c3);
      d = ii(d, a, b, c, x[3], 10, 0x8f0ccc92);
      c = ii(c, d, a, b, x[10], 15, 0xffeff47d);
      b = ii(b, c, d, a, x[1], 21, 0x85845dd1);
      a = ii(a, b, c, d, x[8], 6, 0x6fa87e4f);
      d = ii(d, a, b, c, x[15], 10, 0xfe2ce6e0);
      c = ii(c, d, a, b, x[6], 15, 0xa3014314);
      b = ii(b, c, d, a, x[13], 21, 0x4e0811a1);
      a = ii(a, b, c, d, x[4], 6, 0xf7537e82);
      d = ii(d, a, b, c, x[11], 10, 0xbd3af235);
      c = ii(c, d, a, b, x[2], 15, 0x2ad7d2bb);
      b = ii(b, c, d, a, x[9], 21, 0xeb86d391);

      a0 = (a0 + a) | 0;
      b0 = (b0 + b) | 0;
      c0 = (c0 + c) | 0;
      d0 = (d0 + d) | 0;
    }

    function toHex(n) {
      const hex = ((n >>> 0).toString(16)).padStart(8, "0");
      return hex.match(/../g).reverse().join("");
    }

    return toHex(a0) + toHex(b0) + toHex(c0) + toHex(d0);
  }

  function showResult(hex) {
    output.value = applyCase(hex);
  }

  $("btnText").addEventListener("click", () => {
    showResult(md5(input.value));
    setStatus("文本 MD5 计算完成", "ok");
  });

  caseMode.addEventListener("change", () => {
    if (output.value) output.value = applyCase(output.value);
  });

  $("btnCopy").addEventListener("click", async () => {
    if (!output.value) return setStatus("没有可复制内容", "error");
    await navigator.clipboard.writeText(output.value);
    setStatus("已复制", "ok");
  });

  $("btnClear").addEventListener("click", () => {
    input.value = "";
    output.value = "";
    fileInput.value = "";
    fileHint.textContent = "适合校验下载文件是否完整";
    setStatus("已清空");
  });

  async function hashFile(file) {
    if (!file) return;
    setStatus(`正在计算：${file.name}（${formatSize(file.size)}）...`);
    fileHint.textContent = `${file.name}（${formatSize(file.size)}）`;
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      showResult(md5(buffer));
      setStatus("文件 MD5 计算完成", "ok");
    } catch (err) {
      setStatus(err.message || "文件读取失败", "error");
    }
  }

  uploadZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => hashFile(fileInput.files[0]));
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("dragover");
  });
  uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("dragover");
    hashFile(e.dataTransfer.files[0]);
  });
})();
