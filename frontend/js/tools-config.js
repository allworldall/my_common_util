/**
 * 工具集配置：按分类展示
 * 新增工具：在对应 category.tools 里加一项，并在 tools/ 下补页面
 */
window.TOOL_CATEGORIES = [
  {
    id: "file",
    name: "文件处理",
    desc: "PDF、图片等常用文件处理",
    tools: [
      {
        id: "pdf-split",
        name: "PDF拆分",
        desc: "按页码范围拆分 PDF",
        href: "./tools/pdf-split.html",
        icon: "pdf-split",
      },
      {
        id: "image",
        name: "图片处理",
        desc: "改尺寸、压大小",
        href: "./tools/image.html",
        icon: "image",
      },
    ],
  },
  {
    id: "dev",
    name: "开发调试",
    desc: "接口联调、日志排查常用",
    tools: [
      {
        id: "json",
        name: "JSON工具",
        desc: "校验、格式化、压缩、转义",
        href: "./tools/json.html",
        icon: "json",
      },
      {
        id: "timestamp",
        name: "时间戳转换",
        desc: "秒/毫秒与日期互转",
        href: "./tools/timestamp.html",
        icon: "timestamp",
      },
      {
        id: "base64",
        name: "Base64",
        desc: "编码 / 解码",
        href: "./tools/base64.html",
        icon: "base64",
      },
      {
        id: "url-codec",
        name: "URL编解码",
        desc: "encode / decode",
        href: "./tools/url-codec.html",
        icon: "url",
      },
      {
        id: "md5",
        name: "MD5摘要",
        desc: "文本 / 文件 MD5",
        href: "./tools/md5.html",
        icon: "md5",
      },
    ],
  },
  {
    id: "text",
    name: "文本相关",
    desc: "文本对比与生成",
    tools: [
      {
        id: "uuid",
        name: "UUID生成",
        desc: "批量生成唯一 ID",
        href: "./tools/uuid.html",
        icon: "uuid",
      },
      {
        id: "diff",
        name: "文本Diff",
        desc: "对比两段文本差异",
        href: "./tools/diff.html",
        icon: "diff",
      },
    ],
  },
];
