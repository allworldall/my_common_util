package com.example.my_common_util.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * PDF 合并相关配置
 */
@Component
@ConfigurationProperties(prefix = "pdf.merge")
public class PdfMergeProperties {

    /** 单文件最大大小（字节），默认 50MB */
    private long maxFileSizeBytes = 50L * 1024 * 1024;

    /** 两文件合计最多页数 */
    private int maxTotalPages = 200;

    public long getMaxFileSizeBytes() {
        return maxFileSizeBytes;
    }

    public void setMaxFileSizeBytes(long maxFileSizeBytes) {
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    public int getMaxTotalPages() {
        return maxTotalPages;
    }

    public void setMaxTotalPages(int maxTotalPages) {
        this.maxTotalPages = maxTotalPages;
    }
}
