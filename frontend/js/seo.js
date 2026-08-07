/**
 * 页面 SEO 增强：canonical / og / JSON-LD / 相关工具内链 / ICP 页脚
 * 标题与 description、静态 canonical 已写在各 HTML 中；此处补全并在本地开发时修正占位符。
 */
(() => {
  const cfg = window.SITE_CONFIG || {};
  let origin = (cfg.origin || "").trim();
  if (!origin || origin.includes("__SITE_ORIGIN__")) {
    origin = location.origin;
  }
  origin = origin.replace(/\/$/, "");

  function upsertLink(rel, href) {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
  }

  function upsertMeta(attr, key, content) {
    if (!content) return;
    let el = document.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  const pathname = location.pathname;
  const canonicalPath = pathname.endsWith("/index.html")
    ? pathname.slice(0, -10) || "/"
    : pathname;
  const canonicalUrl = origin + canonicalPath;
  const ogImage = origin + (cfg.ogImage || "/assets/og-share.jpg");

  upsertLink("canonical", canonicalUrl);
  upsertMeta("property", "og:url", canonicalUrl);
  upsertMeta("property", "og:image", ogImage);
  upsertMeta("property", "og:site_name", cfg.siteNameFull || cfg.siteName || "ToolKit");
  upsertMeta("property", "og:locale", "zh_CN");
  upsertMeta("property", "og:type", "website");
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:image", ogImage);

  const title = document.title || "";
  const descEl = document.querySelector('meta[name="description"]');
  const description = descEl ? descEl.getAttribute("content") || "" : "";
  if (title) {
    upsertMeta("property", "og:title", title);
    upsertMeta("name", "twitter:title", title);
  }
  if (description) {
    upsertMeta("property", "og:description", description);
    upsertMeta("name", "twitter:description", description);
  }

  const fileName = pathname.split("/").pop() || "";
  const isHome = !fileName || fileName === "index.html";

  const tools = typeof window.getAllTools === "function" ? window.getAllTools() : [];

  function toolAbsUrl(tool) {
    const rel = (tool.href || "").replace(/^\.\//, "");
    return `${origin}/${rel}`;
  }

  const jsonLd = isHome
    ? {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: cfg.siteNameFull || "ToolKit 在线工具集",
        url: `${origin}/`,
        description,
        inLanguage: "zh-CN",
        hasPart: tools.map((t) => ({
          "@type": "WebApplication",
          name: t.name,
          url: toolAbsUrl(t),
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Any",
        })),
      }
    : {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: title.split(" - ")[0] || title,
        url: canonicalUrl,
        description,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        inLanguage: "zh-CN",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "CNY",
        },
        isPartOf: {
          "@type": "WebSite",
          name: cfg.siteNameFull || "ToolKit 在线工具集",
          url: `${origin}/`,
        },
      };

  if (!document.querySelector('script[type="application/ld+json"]')) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }

  const icp = (cfg.icp || "").trim();
  if (icp) {
    const host = isHome
      ? document.querySelector(".home-footer")
      : document.querySelector("main.page");
    if (host && !document.querySelector(".site-icp")) {
      const p = document.createElement("p");
      p.className = "site-icp";
      const a = document.createElement("a");
      a.href = cfg.icpUrl || "https://beian.miit.gov.cn/";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = icp;
      p.appendChild(a);
      host.appendChild(p);
    }
  }

  if (!isHome && tools.length) {
    const others = tools.filter((t) => !(t.href || "").endsWith(fileName));
    if (!others.length) return;

    const nav = document.createElement("nav");
    nav.className = "related-tools";
    nav.setAttribute("aria-label", "更多工具");
    nav.innerHTML =
      `<p class="related-tools-title">更多工具</p>` +
      `<div class="related-tools-list">` +
      others
        .map((t) => {
          const href = "./" + (t.href || "").split("/").pop();
          return `<a href="${href}">${t.name}</a>`;
        })
        .join("") +
      `</div>`;

    const main = document.querySelector("main.page");
    if (main) main.appendChild(nav);
  }
})();
