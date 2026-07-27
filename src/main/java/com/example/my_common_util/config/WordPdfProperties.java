package com.example.my_common_util.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Word ↔ PDF 转换相关配置。
 * Word→PDF 依赖 LibreOffice；PDF→Word 优先 pdf2docx，可回退 LibreOffice。
 */
@Component
@ConfigurationProperties(prefix = "doc.convert")
public class WordPdfProperties {

    /** 单文件最大大小（字节），默认 20MB */
    private long maxFileSizeBytes = 20L * 1024 * 1024;

    /** 同一 IP 每分钟最多请求次数 */
    private int rateLimitPerMinute = 6;

    /** LibreOffice 可执行文件路径；为空则自动探测 */
    private String sofficePath = "";

    /** 单次转换超时（秒） */
    private int timeoutSeconds = 90;

    /** Python 可执行文件（PDF→Word / pdf2docx） */
    private String pythonBin = "python3";

    /** pdf2docx_convert.py 路径；为空则自动探测 */
    private String pdf2docxScript = "";

    /** 是否启用 pdf2docx（关闭则 PDF→Word 只用 LibreOffice） */
    private boolean pdf2docxEnabled = true;

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

    public String getSofficePath() {
        return sofficePath;
    }

    public void setSofficePath(String sofficePath) {
        this.sofficePath = sofficePath;
    }

    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }

    public String getPythonBin() {
        return pythonBin;
    }

    public void setPythonBin(String pythonBin) {
        this.pythonBin = pythonBin;
    }

    public String getPdf2docxScript() {
        return pdf2docxScript;
    }

    public void setPdf2docxScript(String pdf2docxScript) {
        this.pdf2docxScript = pdf2docxScript;
    }

    public boolean isPdf2docxEnabled() {
        return pdf2docxEnabled;
    }

    public void setPdf2docxEnabled(boolean pdf2docxEnabled) {
        this.pdf2docxEnabled = pdf2docxEnabled;
    }
}
