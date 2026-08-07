/**
 * 站点配置（SEO / sitemap 用）
 *
 * 上线请在 deploy.env 里设置 SITE_ORIGIN（如 https://mytool.xin），
 * 发布脚本会把下面的占位符替换成真实域名。
 * 未替换时，页面脚本会回退到当前浏览器地址。
 *
 * icp：备案号文案，有则显示页脚链接，例如 "浙ICP备xxxxxxxx号"；未备案前保持空字符串。
 */
window.SITE_CONFIG = {
  origin: "__SITE_ORIGIN__",
  siteName: "ToolKit",
  siteNameFull: "ToolKit 在线工具集",
  ogImage: "/assets/og-share.jpg",
  icp: "",
  icpUrl: "https://beian.miit.gov.cn/",
};
