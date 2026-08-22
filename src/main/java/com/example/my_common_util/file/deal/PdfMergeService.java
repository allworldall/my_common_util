package com.example.my_common_util.file.deal;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import com.example.my_common_util.config.PdfMergeProperties;

@Service
public class PdfMergeService {

    static final int MAX_DOWNLOAD_NAME_LENGTH = 180;
    static final int MAX_EACH_BASE_LENGTH = 87;

    private final PdfMergeProperties properties;

    public PdfMergeService(PdfMergeProperties properties) {
        this.properties = properties;
    }

    public byte[] merge(MultipartFile file1, MultipartFile file2) throws Exception {
        validateFile(file1);
        validateFile(file2);

        int pages1 = pageCount(file1);
        int pages2 = pageCount(file2);
        int total = pages1 + pages2;
        if (total > properties.getMaxTotalPages()) {
            throw new IllegalArgumentException("两文件合计最多 " + properties.getMaxTotalPages() + " 页");
        }

        try (InputStream in1 = file1.getInputStream(); InputStream in2 = file2.getInputStream()) {
            return PdfStreamMerger.mergeToBytes(in1, in2);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("文件内容不是有效的 PDF");
        }
    }

    public String buildDownloadFileName(MultipartFile file1, MultipartFile file2) {
        return buildDownloadFileName(
                file1 != null ? file1.getOriginalFilename() : null,
                file2 != null ? file2.getOriginalFilename() : null);
    }

    static String buildDownloadFileName(String original1, String original2) {
        String n1 = truncate(sanitizeBase(original1), MAX_EACH_BASE_LENGTH);
        String n2 = truncate(sanitizeBase(original2), MAX_EACH_BASE_LENGTH);
        return n1 + "+" + n2 + ".pdf";
    }

    private int pageCount(MultipartFile file) throws IOException {
        try (InputStream inputStream = file.getInputStream()) {
            return PdfStreamSplitter.getPageCount(inputStream);
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("请先选择两个 PDF");
        }
        if (file.getSize() > properties.getMaxFileSizeBytes()) {
            long maxMb = properties.getMaxFileSizeBytes() / (1024 * 1024);
            throw new IllegalArgumentException("文件大小不能超过" + maxMb + "M");
        }

        String contentType = file.getContentType();
        String filename = file.getOriginalFilename();
        boolean pdfByType = contentType != null
                && contentType.toLowerCase(Locale.ROOT).contains("pdf");
        boolean pdfByName = filename != null
                && filename.toLowerCase(Locale.ROOT).endsWith(".pdf");

        if (!pdfByType && !pdfByName) {
            throw new IllegalArgumentException("仅支持 PDF 文件");
        }

        try (InputStream in = file.getInputStream()) {
            byte[] header = in.readNBytes(5);
            String magic = new String(header);
            if (!magic.startsWith("%PDF-")) {
                throw new IllegalArgumentException("文件内容不是有效的 PDF");
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (IOException e) {
            throw new IllegalArgumentException("无法读取上传文件");
        }
    }

    private static String sanitizeBase(String original) {
        if (!StringUtils.hasText(original)) {
            return "document";
        }
        String name = original;
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        int dot = name.lastIndexOf('.');
        String base = dot > 0 ? name.substring(0, dot) : name;
        base = base.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (!StringUtils.hasText(base)) {
            return "document";
        }
        return base;
    }

    private static String truncate(String value, int maxChars) {
        if (value.length() <= maxChars) {
            return value;
        }
        return value.substring(0, maxChars);
    }
}
