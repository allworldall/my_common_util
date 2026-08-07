package com.example.my_common_util.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * PDF 压缩相关配置（依赖 Ghostscript）。
 */
@Component
@ConfigurationProperties(prefix = "pdf.compress")
public class PdfCompressProperties {

    /** 单文件最大大小（字节），默认 100MB */
    private long maxFileSizeBytes = 100L * 1024 * 1024;

    /** 同一 IP 每分钟最多请求次数 */
    private int rateLimitPerMinute = 4;

    /** Ghostscript 可执行文件路径；为空则自动探测 */
    private String gsPath = "";

    /** 单次压缩超时（秒） */
    private int timeoutSeconds = 180;

    public long getMaxFileSizeBytes() {
        return maxFileSizeBytes;
    }

    public void setMaxFileSizeBytes(long maxFileSizeBytes) {
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    public int getRateLimitPerMinute() {
        return rateLimitPerMinute;
    }

    public void setRateLimitPerMinute(int rateLimitPerMinute) {
        this.rateLimitPerMinute = rateLimitPerMinute;
    }

    public String getGsPath() {
        return gsPath;
    }

    public void setGsPath(String gsPath) {
        this.gsPath = gsPath;
    }

    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }
}
