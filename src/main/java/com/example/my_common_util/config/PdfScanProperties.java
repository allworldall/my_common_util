package com.example.my_common_util.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 图片扫描成 PDF 相关配置
 */
@Component
@ConfigurationProperties(prefix = "pdf.scan")
public class PdfScanProperties {

    /** 单张图片最大大小（字节），默认 8MB */
    private long maxFileSizeBytes = 8L * 1024 * 1024;

    /** 单次最多上传图片数 */
    private int maxImages = 10;

    public long getMaxFileSizeBytes() {
        return maxFileSizeBytes;
    }

    public void setMaxFileSizeBytes(long maxFileSizeBytes) {
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    public int getMaxImages() {
        return maxImages;
    }

    public void setMaxImages(int maxImages) {
        this.maxImages = maxImages;
    }
}
