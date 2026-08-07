package com.example.my_common_util.service;

import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.example.my_common_util.config.HttpProxyProperties;
import com.example.my_common_util.web.dto.HttpProxyRequest;

@Service
public class HttpProxyService {

    private static final Set<String> ALLOWED_METHODS = Set.of(
            "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS");

    /** 禁止由客户端覆盖的请求头（hop-by-hop / 由客户端或网关控制） */
    private static final Set<String> BLOCKED_REQUEST_HEADERS = Set.of(
            "host",
            "content-length",
            "transfer-encoding",
            "connection",
            "keep-alive",
            "upgrade",
            "te",
            "trailer",
            "proxy-authorization",
            "proxy-connection",
            "expect");

    private final HttpProxyProperties properties;
    private final HttpClient httpClient;

    public HttpProxyService(HttpProxyProperties properties) {
        this.properties = properties;
        this.httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public Map<String, Object> execute(HttpProxyRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("请求不能为空");
        }

        String method = normalizeMethod(request.getMethod());
        URI uri = parseAndValidateUrl(request.getUrl());
        assertPublicTarget(uri);

        byte[] bodyBytes = encodeBody(request.getBody());
        if (bodyBytes.length > properties.getMaxRequestBodyBytes()) {
            throw new IllegalArgumentException(
                    "请求体过大，最大允许 " + properties.getMaxRequestBodyBytes() + " 字节");
        }

        int timeoutMs = resolveTimeout(request.getTimeoutMs());
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofMillis(timeoutMs))
                .method(method, bodyPublisher(method, bodyBytes));

        applyHeaders(builder, request.getHeaders());

        long started = System.nanoTime();
        HttpResponse<byte[]> response;
        try {
            response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
        } catch (IOException ex) {
            throw new IllegalArgumentException("请求失败：" + rootMessage(ex));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("请求被中断");
        }
        long elapsedMs = (System.nanoTime() - started) / 1_000_000L;

        return toResult(uri, response, elapsedMs);
    }

    private String normalizeMethod(String raw) {
        String method = StringUtils.hasText(raw) ? raw.trim().toUpperCase(Locale.ROOT) : "GET";
        if (!ALLOWED_METHODS.contains(method)) {
            throw new IllegalArgumentException("不支持的 HTTP 方法：" + method);
        }
        return method;
    }

    private URI parseAndValidateUrl(String rawUrl) {
        if (!StringUtils.hasText(rawUrl)) {
            throw new IllegalArgumentException("请填写请求 URL");
        }
        String trimmed = rawUrl.trim();
        URI uri;
        try {
            uri = URI.create(trimmed);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("URL 格式不正确");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            throw new IllegalArgumentException("仅支持 http / https 协议");
        }
        if (!StringUtils.hasText(uri.getHost())) {
            throw new IllegalArgumentException("URL 缺少主机名");
        }
        if (uri.getUserInfo() != null) {
            throw new IllegalArgumentException("不允许在 URL 中携带用户名密码");
        }
        return uri;
    }

    private void assertPublicTarget(URI uri) {
        String host = uri.getHost();
        String lower = host.toLowerCase(Locale.ROOT);
        if ("localhost".equals(lower)
                || lower.endsWith(".localhost")
                || lower.endsWith(".local")
                || lower.endsWith(".internal")
                || "0.0.0.0".equals(lower)
                || "metadata.google.internal".equals(lower)) {
            throw new IllegalArgumentException("不允许访问内网或本机地址");
        }

        InetAddress[] addresses;
        try {
            addresses = InetAddress.getAllByName(host);
        } catch (Exception ex) {
            throw new IllegalArgumentException("无法解析主机名：" + host);
        }
        if (addresses.length == 0) {
            throw new IllegalArgumentException("无法解析主机名：" + host);
        }
        for (InetAddress address : addresses) {
            if (isBlockedAddress(address)) {
                throw new IllegalArgumentException("不允许访问内网或本机地址");
            }
        }
    }

    private boolean isBlockedAddress(InetAddress address) {
        return address.isAnyLocalAddress()
                || address.isLoopbackAddress()
                || address.isLinkLocalAddress()
                || address.isSiteLocalAddress()
                || address.isMulticastAddress()
                || isCarrierGradeNat(address)
                || isUniqueLocalIpv6(address);
    }

    /** 100.64.0.0/10（CGNAT） */
    private boolean isCarrierGradeNat(InetAddress address) {
        byte[] bytes = address.getAddress();
        if (bytes.length != 4) {
            return false;
        }
        int first = bytes[0] & 0xff;
        int second = bytes[1] & 0xff;
        return first == 100 && second >= 64 && second <= 127;
    }

    /** fc00::/7 */
    private boolean isUniqueLocalIpv6(InetAddress address) {
        byte[] bytes = address.getAddress();
        if (bytes.length != 16) {
            return false;
        }
        return (bytes[0] & 0xfe) == 0xfc;
    }

    private int resolveTimeout(Integer requested) {
        int timeout = requested == null || requested <= 0
                ? properties.getDefaultTimeoutMs()
                : requested;
        return Math.min(timeout, properties.getMaxTimeoutMs());
    }

    private byte[] encodeBody(String body) {
        if (body == null || body.isEmpty()) {
            return new byte[0];
        }
        return body.getBytes(StandardCharsets.UTF_8);
    }

    private HttpRequest.BodyPublisher bodyPublisher(String method, byte[] bodyBytes) {
        if ("GET".equals(method) || "HEAD".equals(method)) {
            return HttpRequest.BodyPublishers.noBody();
        }
        if (bodyBytes.length == 0) {
            return HttpRequest.BodyPublishers.noBody();
        }
        return HttpRequest.BodyPublishers.ofByteArray(bodyBytes);
    }

    private void applyHeaders(HttpRequest.Builder builder, Map<String, String> headers) {
        if (headers == null || headers.isEmpty()) {
            return;
        }
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            String name = entry.getKey();
            String value = entry.getValue();
            if (!StringUtils.hasText(name) || value == null) {
                continue;
            }
            String trimmedName = name.trim();
            if (BLOCKED_REQUEST_HEADERS.contains(trimmedName.toLowerCase(Locale.ROOT))) {
                continue;
            }
            try {
                builder.header(trimmedName, value);
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException("非法请求头：" + trimmedName);
            }
        }
    }

    private Map<String, Object> toResult(URI requestUri, HttpResponse<byte[]> response, long elapsedMs) {
        byte[] raw = response.body() == null ? new byte[0] : response.body();
        int maxBytes = properties.getMaxResponseBodyBytes();
        boolean truncated = raw.length > maxBytes;
        byte[] limited = truncated ? slice(raw, maxBytes) : raw;

        Charset charset = charsetFromContentType(
                response.headers().firstValue("Content-Type").orElse(""));
        String bodyText = new String(limited, charset);

        Map<String, List<String>> headers = new LinkedHashMap<>();
        response.headers().map().forEach((key, values) -> {
            if (key == null) {
                return;
            }
            headers.put(key, new ArrayList<>(values));
        });

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("url", requestUri.toString());
        result.put("status", response.statusCode());
        result.put("timeMs", elapsedMs);
        result.put("headers", headers);
        result.put("body", bodyText);
        result.put("bodyBytes", raw.length);
        result.put("bodyTruncated", truncated);
        return result;
    }

    private byte[] slice(byte[] source, int max) {
        byte[] out = new byte[max];
        System.arraycopy(source, 0, out, 0, max);
        return out;
    }

    private Charset charsetFromContentType(String contentType) {
        if (!StringUtils.hasText(contentType)) {
            return StandardCharsets.UTF_8;
        }
        String lower = contentType.toLowerCase(Locale.ROOT);
        int idx = lower.indexOf("charset=");
        if (idx < 0) {
            return StandardCharsets.UTF_8;
        }
        String charsetName = contentType.substring(idx + 8).trim();
        int semi = charsetName.indexOf(';');
        if (semi >= 0) {
            charsetName = charsetName.substring(0, semi).trim();
        }
        charsetName = charsetName.replace("\"", "");
        try {
            return Charset.forName(charsetName);
        } catch (Exception ex) {
            return StandardCharsets.UTF_8;
        }
    }

    private String rootMessage(Throwable ex) {
        Throwable cur = ex;
        while (cur.getCause() != null && cur.getCause() != cur) {
            cur = cur.getCause();
        }
        String message = cur.getMessage();
        return StringUtils.hasText(message) ? message : cur.getClass().getSimpleName();
    }
}
