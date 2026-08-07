package com.example.my_common_util.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * HTTP 请求模拟（服务端代理）防护配置
 */
@Component
@ConfigurationProperties(prefix = "http.proxy")
public class HttpProxyProperties {

    /** 同 IP 每分钟请求上限 */
    private int rateLimitPerMinute = 20;

    /** 默认超时（毫秒） */
    private int defaultTimeoutMs = 15_000;

    /** 允许的最大超时（毫秒） */
    private int maxTimeoutMs = 60_000;

    /** 请求体最大字节数 */
    private int maxRequestBodyBytes = 256 * 1024;

    /** 响应体最大字节数（超出则截断） */
    private int maxResponseBodyBytes = 512 * 1024;

    public int getRateLimitPerMinute() {
        return rateLimitPerMinute;
    }

    public void setRateLimitPerMinute(int rateLimitPerMinute) {
        this.rateLimitPerMinute = rateLimitPerMinute;
    }

    public int getDefaultTimeoutMs() {
        return defaultTimeoutMs;
    }

    public void setDefaultTimeoutMs(int defaultTimeoutMs) {
        this.defaultTimeoutMs = defaultTimeoutMs;
    }

    public int getMaxTimeoutMs() {
        return maxTimeoutMs;
    }

    public void setMaxTimeoutMs(int maxTimeoutMs) {
        this.maxTimeoutMs = maxTimeoutMs;
    }

    public int getMaxRequestBodyBytes() {
        return maxRequestBodyBytes;
    }

    public void setMaxRequestBodyBytes(int maxRequestBodyBytes) {
        this.maxRequestBodyBytes = maxRequestBodyBytes;
    }

    public int getMaxResponseBodyBytes() {
        return maxResponseBodyBytes;
    }

    public void setMaxResponseBodyBytes(int maxResponseBodyBytes) {
        this.maxResponseBodyBytes = maxResponseBodyBytes;
    }
}
