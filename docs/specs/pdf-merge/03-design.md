# Design：PDF 合并

对照 spec：`02-spec.md`

## 方案概述

沿用现有 PDF 拆分的路径：前端独立工具页上传，服务端用已在用的 iText `PdfCopy` 按页复制，立即把新文件流回去，不落长期存储。两个文件槽只展示元数据（文件名 / 页数 / 大小），页数复用已有 `POST /api/pdf/info`。合并走新接口 `POST /api/pdf/merge`，入参按页面展示顺序叫 `file1`、`file2`。

这样选是因为：拆分已经证明这套校验、限流、保存弹窗和 nginx 分层可行；合并比压缩轻（只复印页面，不调 Ghostscript），不必上新依赖。

## 方案对比（如有分叉）

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| A. 独立工具页 + 服务端 `PdfCopy` | 与拆分一致；实现短；大文件不占浏览器渲染 | 文件会上传 | **采用** |
| B. 塞进拆分页 | 少一个入口 | 拆/合职责混在一起，页码区和双文件槽互相干扰 | 不采用：和「两个页面展示先后顺序」不符 |
| C. 浏览器本地用 pdf-lib 合并 | 不上传 | 和拆分/压缩不一致；大文件占内存；加密/坏文件错误难统一 | 不采用：规格已定为服务端 |

## 模块与时序

- 模块：
  - 前端：`frontend/tools/pdf-merge.html` + `pdf-merge.js`；首页入口写在 `tools-config.js`（拆分与压缩之间）；图标补进 `home.js`
  - 接口：`PdfMergeController`，`POST /api/pdf/merge`
  - 业务：`PdfMergeService`（校验两个文件、合计页数、组下载名、调用合并）
  - 页面复制：`PdfStreamMerger`（两个 `PdfReader` → 一个 `PdfCopy`，按页 `addPage`）
  - 配置：`PdfMergeProperties`（`pdf.merge.*`：单文件 50MB、合计 200 页）
  - 限流 / Token：现有拦截器已覆盖 `/api/pdf/**`；merge 与拆分共用默认 `pdf` 桶（每分钟 10 次），不必单独分支
  - 部署：`nginx.conf.example` 增加 `/api/pdf/merge`（110m）；`SOP.md` 写清线上怎么加这段、为何要加、以及 `nginx -t && reload`（`release.sh` 不会改 nginx）
- 关键时序：
  1. 用户往槽 1 / 槽 2 各选一个 PDF → 前端校验类型与 50MB → 各调一次 `/api/pdf/info` 展示页数
  2. 「交换顺序」只交换前端两个槽的 `File` 与元数据，不重新上传
  3. 两点齐了才能点「合并并下载」→ `FormData` 按当前顺序 append `file1`、`file2` → `POST /api/pdf/merge`
  4. 服务端：魔数 / 大小 / 类型 → 打开两个 Reader → 加密或损坏则拒绝 → 页数相加 > 200 则拒绝 → 按序复印全部页 → `Content-Disposition` 返回 PDF
  5. 前端用与拆分相同的保存弹窗；处理在内存/请求生命周期内完成，无业务落盘

## 接口

| 接口 | 入参 | 出参 | 错误 |
|---|---|---|---|
| `POST /api/pdf/info`（已有） | `file`：单个 PDF | `{ success, pageCount, fileName, fileSize }` | 非 PDF / 超 50MB / 加密或损坏：400 + `message` |
| `POST /api/pdf/merge`（新增） | `file1`、`file2`：multipart，顺序=展示先后 | `200` + `application/pdf` 字节流；`Content-Disposition: attachment; filename*=UTF-8''...` | 缺文件 / 非 PDF / 单文件超 50MB / 合计页数超 200 / 加密：「不支持加密的 PDF」/ 损坏：400；过频：429「请求过于频繁，请稍后再试」；网关体积超限：413 |

下载名规则：`{名1}+{名2}.pdf`，去掉路径与 `\/:*?"<>|`，整名（含 `.pdf`）最长 180 字符；超长则两个主名各分一半额度再截断（各最多 87 字符，中间 `+`，末尾 `.pdf`）。

加密识别：iText `PdfReader` 打不开或 `isEncrypted()` 为真时，统一映射为「不支持加密的 PDF」。`/info` 与 `/merge` 同一套说法。

## 数据变更

- 表 / 字段 / 兼容：无数据库。配置新增：

```yaml
pdf:
  merge:
    max-file-size-bytes: 52428800   # 50MB，单文件
    max-total-pages: 200            # 两文件合计
```

- Spring `multipart.max-request-size` 已是 110MB，可覆盖两个 50MB。前端单文件上限复用已有 `pdfMaxFileSizeBytes`（50MB）。
- 已有拆分 / 压缩 / 扫描接口行为不变。

## 影响面与风险

- 影响面：首页工具列表、SEO（新页 title/description）、nginx 需单独 location；Java 配置与限流桶
- 风险与对策：
  - 线上旧 nginx 未同步 → 两个较大文件会在网关 413。对策：示例配置 + SOP 写明发版后 `nginx -t && reload`
  - 两个大 PDF 同时进内存（上传缓冲 + `PdfCopy` 输出）。对策：单文件 50MB、合计 200 页封顶；合并不做重渲染
  - `/info` 两次 + `/merge` 一次都算进同一限流桶。对策：每分钟 10 次足够普通使用；不把 info 剔出（拆分已是这样）
  - 表单/目录/电子章丢失被当成 bug。对策：FAQ 用白话写「只保证页面内容按顺序拼在一起」

## 不采用的做法

- 一次选多个文件或拖页排序：规格只要求两个槽
- 前端出缩略图（pdf.js 渲染）：大文件解码占内存，规格已排除
- 合并书签树 / 保留数字签名 / 填表字段：`PdfCopy` 只复印页面，规格明确不保证
- 为 merge 再开一套限流数字：与拆分同量级即可
- 抽公共校验类作为本阶段必做：可以在实现时从拆分抄一份校验，避免顺手大重构；若三处规则开始分叉再抽
