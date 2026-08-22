# Tasks：PDF 合并

对照 spec：`02-spec.md`；对照 design：`03-design.md`

## 实现任务

### T1：配置 + 按页合并内核

- 状态：已完成
- 实际改动：新增 `PdfMergeProperties` / `PdfStreamMerger`，yaml 增加 `pdf.merge`；打开加密文件时（含缺少 BouncyCastle）统一抛「不支持加密的 PDF」。自测：A4+A5 合并为 2 页且尺寸保留；加密文件被拒绝。
- 改动范围：
  - `src/main/java/com/example/my_common_util/config/PdfMergeProperties.java`（新建）
  - `src/main/resources/application.yaml`（`pdf.merge.max-file-size-bytes` / `max-total-pages`）
  - `src/main/java/com/example/my_common_util/file/deal/PdfStreamMerger.java`（新建：两 Reader → PdfCopy 按序复印全部页；加密/`isEncrypted` 抛「不支持加密的 PDF」）
- 对应验收：两文件按序拼页；不同纸张尺寸保持原尺寸；加密拒绝
- 自测：本地用两个小 PDF 调 `mergeToBytes`，打开结果看页序和页尺寸；加密文件应抛约定文案

### T2：合并接口与校验 / 下载名

- 状态：已完成
- 实际改动：新增 `PdfMergeService` / `PdfMergeController`（`POST /api/pdf/merge`）；`/api/pdf/info` 读加密文件也返回「不支持加密的 PDF」。本地 curl：两文件 200 且 2 页、缺文件/假 PDF/超页数/加密均为 400，下载名 `{名1}+{名2}.pdf` 最长 179。
- 改动范围：
  - `PdfMergeService`（新建：两文件魔数/类型/50MB、合计页数 ≤200、下载名 `{名1}+{名2}.pdf` 最长 180、非法字符替换）
  - `PdfMergeController`（新建：`POST /api/pdf/merge`，`file1`/`file2`，返回 PDF 流）
  - `PdfStreamSplitter#getPageCount` 或拆分读取路径：加密同样映射为「不支持加密的 PDF」，让已有 `/api/pdf/info` 说法与合并一致
- 对应验收：非 PDF / 超大小 / 超页数 / 加密；处理完无长期落盘
- 自测：curl 两文件应 200 且 `Content-Disposition` 文件名正确；缺文件、假 PDF、超页数 400；加密 400 且文案对；超长文件名被截到 180

### T3：合并工具页（双槽、交换、保存）

- 状态：已完成
- 实际改动：新增 `pdf-merge.html` / `pdf-merge.js`，双槽 + 交换 + 保存弹窗 + FAQ；`common.css` 只加了双槽间距。合并按钮默认禁用；交换只对调本地文件与元数据。
- 改动范围：
  - `frontend/tools/pdf-merge.html`（新建：两槽「第 1 个（在前）」「第 2 个（在后）」、交换、合并按钮、保存弹窗、FAQ）
  - `frontend/tools/pdf-merge.js`（新建：每槽校验后调 `/api/pdf/info`；未齐禁用合并；交换只换本地 File；按当前顺序 POST `file1`/`file2`；保存弹窗对齐拆分）
  - `frontend/css/common.css`（仅当双槽布局现有 class 不够时加少量样式）
  - 单文件上限复用 `APP_CONFIG.pdfMaxFileSizeBytes`
- 对应验收：未齐不可点；交换后顺序反转；保存弹窗两种方式；FAQ 白话说明加密/表格/目录/电子章
- 自测：只选一个时按钮灰；两槽选完可点；交换后元数据对调且不必重新读 info；合并后弹窗能下载

### T4：首页入口与 SEO

- 状态：已完成
- 实际改动：文件处理栏顺序为拆分 → 合并 → 压缩 → Word↔PDF，四个 PDF 相关入口挨在一起；补了图标、首页 SEO、底部列表和 sitemap。
- 改动范围：
  - `frontend/js/tools-config.js`（文件处理里插在拆分与压缩之间；补 seo）
  - `frontend/js/home.js`（`pdf-merge` 图标）
  - `frontend/js/tools-config.js` 的 `SITE_SEO` 文案带上 PDF合并
  - `frontend/index.html` 底部工具列表加链接
  - `frontend/sitemap.xml` 加 `pdf-merge.html`
- 对应验收：首页能看到「PDF合并」入口
- 自测：打开首页，入口在拆分和压缩之间，点进去是合并页

### T5：nginx 与 SOP 改法

- 状态：已完成
- 实际改动：`nginx.conf.example` 在 compress 后、通用 `/api/` 前增加 `/api/pdf/merge`（110m / 120s / `api_heavy`）。SOP 5.1 写清为什么、贴哪一段、`nginx -t && reload`，以及 `release.sh` 不会改 Nginx。
- 改动范围：
  - `deploy/nginx.conf.example`：在 compress 附近增加更具体的 `location ^~ /api/pdf/merge`（须写在通用 `location /api/` 之前），`client_max_body_size 110m`，`proxy_read_timeout 120s`，限流与 compress/scan 同级（`api_heavy`）
  - `deploy/SOP.md`：不能只写「记得 reload」。要写清**怎么改线上 nginx**：
    1. 为什么：通用 `/api/` 是 52m，两个 PDF 合计容易超，合并必须单独 110m
    2. 往现有 `/etc/nginx/conf.d/my_common_util.conf` 里加哪一段（可直接贴 example 里的 merge location）
    3. 加完后的命令：`sudo nginx -t && sudo systemctl reload nginx`
    4. 提醒：`release.sh` 不会改 Nginx，日常发版只更 jar/前端；这次功能上线必须人肉改 nginx，否则大文件会 413
- 对应验收：两个较大文件不会被默认 52MB 网关挡掉（配置侧）
- 自测：对照 compress 那段 location，确认 merge 路径更具体、不会落到通用 `/api/`；SOP 按步骤能独立做完，不用再翻代码猜

## 联调任务

### I1：本地整页走通

- 状态：已完成
- 实际：本机 JDK21 + `start.sh`（local）+ 前端 8765。A(A4 两页)+B(A5 三页) 合并为 5 页且尺寸保留；对调后 B 在前；加密/假文件/超页/超大均 400；拆分回归通过。线上 nginx 413 留给 I2。
- 上下游 / 环境 / 数据：本机后端 8080 + 前端静态页；准备 A（2 页）B（3 页）、不同纸张尺寸各一份、一个加密 PDF、一个改后缀的假 PDF
- 验证：见 `05-test.md` 自测与回归；结果文件用阅读器看页序和尺寸；确认工作目录无残留临时文件

### I2：线上 nginx（发版时）

- 状态：待做
- 上下游 / 环境 / 数据：生产 nginx 同步 example 后 reload；两个合计超过 52MB、各自不超过 50MB 的 PDF
- 验证：合并成功而非 413；旧拆分/压缩仍可用
