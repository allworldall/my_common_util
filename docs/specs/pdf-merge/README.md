# PDF 合并

- slug：`pdf-merge`
- 当前阶段：`implement`
- spec：已确认
- design：已确认
- tasks：已确认（T1～T5、I1 已完成；I2 发版时做）

## 决策摘要

- 只合正好两个 PDF；整本合，不选页；提供交换顺序
- 不渲染缩略图（大文件会占浏览器内存）
- 每个 50MB，合计最多 200 页；服务端用 iText `PdfCopy` 复印页面
- 下载名 `{名1}+{名2}.pdf`，整名最长 180 字符，超长截主名
- 加密 PDF 拒绝；看起来还是那些页，但可填写表格 / 左侧目录 / 电子章可能没了
- nginx：`/api/pdf/merge` 单独 110MB

## 文件

- [01-prd.md](01-prd.md)
- [02-spec.md](02-spec.md)
- [03-design.md](03-design.md)
- [04-tasks.md](04-tasks.md)
- [05-test.md](05-test.md)
