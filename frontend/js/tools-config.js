/**
 * 工具集配置：按分类展示
 * 新增工具：在对应 category.tools 里加一项，并在 tools/ 下补页面
 * seo 字段用于搜索引擎标题/描述/关键词（与各 HTML 页 meta 保持一致）
 */
window.TOOL_CATEGORIES = [
  {
    id: "file",
    name: "文件处理",
    desc: "PDF、Word、图片等常用文件处理",
    tools: [
      {
        id: "pdf-split",
        name: "PDF拆分",
        desc: "按页码范围拆分 PDF",
        href: "./tools/pdf-split.html",
        icon: "pdf-split",
        seo: {
          title: "在线PDF拆分 - 按页码免费拆分PDF文件 | ToolKit",
          description:
            "免费在线PDF拆分工具：上传PDF，按页码范围拆分并下载，适合截取合同、报告指定页。无需安装软件。",
          keywords: "PDF拆分,在线PDF拆分,PDF分割,按页拆分PDF,PDF截取页面",
        },
      },
      {
        id: "pdf-compress",
        name: "PDF压缩",
        desc: "三档质量缩小 PDF 体积",
        href: "./tools/pdf-compress.html",
        icon: "pdf-compress",
        seo: {
          title: "在线PDF压缩 - 缩小PDF体积保持清晰 | ToolKit",
          description:
            "免费在线PDF压缩工具：三档质量可选，在尽量保持图片字迹清晰的前提下缩小文件体积，适合传输受限场景。无需安装软件。",
          keywords: "PDF压缩,在线PDF压缩,缩小PDF,PDF减小体积,PDF压缩工具",
        },
      },
      {
        id: "word-pdf",
        name: "Word↔PDF",
        desc: "Word 与 PDF 互转（结果请核对）",
        href: "./tools/word-pdf.html",
        icon: "word-pdf",
        seo: {
          title: "Word转PDF / PDF转Word - 在线互转 | ToolKit",
          description:
            "免费在线 Word 与 PDF 互转：支持 doc/docx 转 PDF、PDF 转 Word。转换后请自行打开核对文字与版式，复杂排版可能需人工调整。",
          keywords: "Word转PDF,PDF转Word,docx转PDF,在线Word转PDF,PDF转docx",
        },
      },
      {
        id: "image",
        name: "图片处理",
        desc: "改尺寸、压大小",
        href: "./tools/image.html",
        icon: "image",
        seo: {
          title: "在线图片压缩改尺寸 - 免费图片处理 | ToolKit",
          description:
            "免费在线图片压缩与改尺寸工具，支持 JPG/PNG/WEBP，本地浏览器处理，图片不上传服务器。",
          keywords: "图片压缩,在线改尺寸,图片缩小,PNG压缩,JPG压缩,图片处理",
        },
      },
      {
        id: "image-scan",
        name: "图片扫描",
        desc: "照片转扫描件 PDF",
        href: "./tools/image-scan.html",
        icon: "image-scan",
        seo: {
          title: "照片转扫描件PDF - 在线图片扫描 | ToolKit",
          description:
            "把手机拍的文档照片转成接近扫描件效果的PDF，支持多页，方便归档打印，免费在线使用。",
          keywords: "照片转扫描件,图片转PDF,文档扫描,扫描件PDF,在线扫描",
        },
      },
      {
        id: "image-ocr",
        name: "图片文字提取",
        desc: "上传或粘贴截图，识别文字",
        href: "./tools/image-ocr.html",
        icon: "image-ocr",
        seo: {
          title: "图片文字识别OCR - 截图提取文字 | ToolKit",
          description:
            "免费在线OCR：上传图片或粘贴截图，识别中英文文字。本地识别，图片不上传，适合提取聊天记录、文档文字。",
          keywords: "OCR,图片转文字,文字识别,截图提取文字,在线OCR,图片文字提取",
        },
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
        seo: {
          title: "在线JSON格式化校验压缩 - 免费JSON工具 | ToolKit",
          description:
            "免费在线JSON格式化、压缩、校验、转义/去转义，全部在浏览器本地完成，适合接口联调与日志排查。",
          keywords: "JSON格式化,JSON校验,JSON压缩,JSON转义,在线JSON,JSON工具",
        },
      },
      {
        id: "timestamp",
        name: "时间戳转换",
        desc: "秒/毫秒与日期互转",
        href: "./tools/timestamp.html",
        icon: "timestamp",
        seo: {
          title: "时间戳转换 - 秒毫秒与日期互转 | ToolKit",
          description:
            "免费在线时间戳转换工具：秒级/毫秒级时间戳与日期时间互转，显示当前时间戳，开发调试常用。",
          keywords: "时间戳转换,Unix时间戳,毫秒时间戳,日期转时间戳,在线时间戳",
        },
      },
      {
        id: "base64",
        name: "Base64",
        desc: "编码 / 解码",
        href: "./tools/base64.html",
        icon: "base64",
        seo: {
          title: "Base64编码解码 - 在线Base64工具 | ToolKit",
          description:
            "免费在线Base64编码/解码工具，文本本地处理，适合调试接口、查看编码内容。",
          keywords: "Base64,Base64编码,Base64解码,在线Base64,Base64工具",
        },
      },
      {
        id: "url-codec",
        name: "URL编解码",
        desc: "encode / decode",
        href: "./tools/url-codec.html",
        icon: "url",
        seo: {
          title: "URL编码解码 - 在线encodeURIComponent | ToolKit",
          description:
            "免费在线URL编解码工具，支持 encodeURIComponent / decodeURIComponent，本地处理查询参数与特殊字符。",
          keywords: "URL编码,URL解码,encodeURIComponent,URL转义,在线URL编码",
        },
      },
      {
        id: "md5",
        name: "MD5摘要",
        desc: "文本 / 文件 MD5",
        href: "./tools/md5.html",
        icon: "md5",
        seo: {
          title: "MD5在线计算 - 文本文件MD5校验 | ToolKit",
          description:
            "免费在线计算文本或文件的MD5摘要，全部在本地浏览器完成，文件不上传，适合校验完整性。",
          keywords: "MD5,MD5在线计算,文件MD5,MD5校验,文本MD5",
        },
      },
      {
        id: "http-request",
        name: "HTTP请求模拟",
        desc: "模拟发送 HTTP 请求",
        href: "./tools/http-request.html",
        icon: "http-request",
        seo: {
          title: "HTTP请求模拟 - 在线接口调试 | ToolKit",
          description:
            "免费在线HTTP请求模拟工具：支持 GET/POST/PUT/PATCH/DELETE，自定义请求头与请求体，服务端代理发送，方便接口联调。",
          keywords: "HTTP请求,接口调试,API测试,Postman在线,HTTP模拟,在线发请求",
        },
      },
    ],
  },
  {
    id: "text",
    name: "文本相关",
    desc: "文本对比、生成与格式处理",
    tools: [
      {
        id: "uuid",
        name: "UUID生成",
        desc: "批量生成唯一 ID",
        href: "./tools/uuid.html",
        icon: "uuid",
        seo: {
          title: "UUID在线生成 - 批量生成UUID v4 | ToolKit",
          description:
            "免费在线批量生成 UUID v4，可选择是否带连字符，方便造测试数据与唯一ID。",
          keywords: "UUID生成,在线UUID,UUID v4,批量生成UUID,GUID生成",
        },
      },
      {
        id: "diff",
        name: "文本Diff",
        desc: "对比两段文本差异",
        href: "./tools/diff.html",
        icon: "diff",
        seo: {
          title: "文本对比Diff - 在线找差异 | ToolKit",
          description:
            "免费在线文本Diff对比工具，按行高亮两段文本差异，本地处理，适合对比配置、日志、代码片段。",
          keywords: "文本对比,Diff,在线Diff,文本差异对比,字符串对比",
        },
      },
      {
        id: "list-convert",
        name: "文本格式转换",
        desc: "换行/逗号互转、SQL IN、去重",
        href: "./tools/list-convert.html",
        icon: "list-convert",
        seo: {
          title: "列表格式转换 - 换行逗号SQL IN互转 | ToolKit",
          description:
            "免费在线列表格式转换：换行与逗号互转、生成SQL IN、去重、加引号，处理单号/ID/SKU列表，本地完成。",
          keywords: "换行转逗号,逗号转换行,SQL IN,列表去重,文本格式转换",
        },
      },
    ],
  },
];

/** 首页 SEO（与 index.html meta 保持一致） */
window.SITE_SEO = {
  title: "ToolKit 在线工具集 - 免费PDF拆分/压缩/Word互转/OCR/JSON等",
  description:
    "免费在线工具箱：PDF拆分、PDF压缩、Word与PDF互转、图片压缩、图片OCR文字识别、JSON格式化、HTTP请求模拟、时间戳转换、Base64、UUID、文本Diff等。开发联调与办公处理常用，多数工具本地处理、数据不上传。",
  keywords:
    "在线工具,工具集,PDF拆分,PDF压缩,Word转PDF,PDF转Word,图片OCR,JSON格式化,HTTP请求,时间戳转换,Base64,UUID生成,文本对比,ToolKit",
};

/** 扁平工具列表，便于 sitemap / 相关推荐 */
window.getAllTools = function getAllTools() {
  const list = [];
  (window.TOOL_CATEGORIES || []).forEach((cat) => {
    (cat.tools || []).forEach((tool) => list.push(tool));
  });
  return list;
};
