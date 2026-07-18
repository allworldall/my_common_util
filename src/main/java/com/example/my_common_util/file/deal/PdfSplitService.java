package com.example.my_common_util.file.deal;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import com.example.my_common_util.config.PdfSplitProperties;

@Service
public class PdfSplitService {

    private final PdfSplitProperties properties;

    public PdfSplitService(PdfSplitProperties properties) {
        this.properties = properties;
    }

    public byte[] split(MultipartFile file, int startPage, int endPage) throws Exception {
        validateFile(file);
        validatePageSpan(startPage, endPage);

        try (InputStream inputStream = file.getInputStream()) {
            return PdfStreamSplitter.splitByPageToBytes(inputStream, startPage, endPage);
        }
    }

    public int getPageCount(MultipartFile file) throws IOException {
        validateFile(file);
        try (InputStream inputStream = file.getInputStream()) {
            return PdfStreamSplitter.getPageCount(inputStream);
        }
    }

    public String buildDownloadFileName(MultipartFile file, int startPage, int endPage) {
        String original = file.getOriginalFilename();
        String base = "document";
        if (StringUtils.hasText(original)) {
            int dot = original.lastIndexOf('.');
            base = (dot > 0 ? original.substring(0, dot) : original)
                    .replaceAll("[\\\\/:*?\"<>|]", "_");
        }
        return base + "-p" + startPage + "-" + endPage + ".pdf";
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("请上传 PDF 文件");
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

        // 魔数校验，防止伪装扩展名
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

    private void validatePageSpan(int startPage, int endPage) {
        if (startPage < 1) {
            throw new IllegalArgumentException("起始页码必须大于等于1");
        }
        if (endPage < startPage) {
            throw new IllegalArgumentException("结束页码不能小于起始页码");
        }
        int span = endPage - startPage + 1;
        if (span > properties.getMaxPageSpan()) {
            throw new IllegalArgumentException("单次拆分最多 "
                    + properties.getMaxPageSpan() + " 页");
        }
    }
}
