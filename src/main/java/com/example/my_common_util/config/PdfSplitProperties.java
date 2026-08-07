package com.example.my_common_util.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * PDF 拆分接口防护相关配置
 */
@Component
@ConfigurationProperties(prefix = "pdf.split")
public class PdfSplitProperties {

    /** 单文件最大大小（字节），默认 50MB */
    private long maxFileSizeBytes = 50L * 1024 * 1024;

    /** 单次拆分最多页数 */
    private int maxPageSpan = 100;

    /** 同一 IP 每分钟最多请求次数 */
    private int rateLimitPerMinute = 10;

    /** 简易访问令牌，为空则不校验；请求头 X-Api-Token 需匹配（/api/pdf/**、/api/doc/**、/api/http/**） */
    private String apiToken = "";

    public long getMaxFileSizeBytes() {
        return maxFileSizeBytes;
    }

    public void setMaxFileSizeBytes(long maxFileSizeBytes) {
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    public int getMaxPageSpan() {
        return maxPageSpan;
    }

    public void setMaxPageSpan(int maxPageSpan) {
        this.maxPageSpan = maxPageSpan;
    }

    public int getRateLimitPerMinute() {
        return rateLimitPerMinute;
    }

    public void setRateLimitPerMinute(int rateLimitPerMinute) {
        this.rateLimitPerMinute = rateLimitPerMinute;
    }

    public String getApiToken() {
        return apiToken;
    }

    public void setApiToken(String apiToken) {
        this.apiToken = apiToken;
    }
}
