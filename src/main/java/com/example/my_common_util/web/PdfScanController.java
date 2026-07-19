package com.example.my_common_util.web;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.my_common_util.service.ImageScanService;

@RestController
@RequestMapping("/api/pdf")
public class PdfScanController {

    private final ImageScanService imageScanService;

    public PdfScanController(ImageScanService imageScanService) {
        this.imageScanService = imageScanService;
    }

    /**
     * 上传照片并生成扫描件 PDF（类似全能扫描王）
     *
     * @param files 一张或多张图片
     * @param mode  color / gray / document（默认 document）
     */
    @PostMapping("/scan")
    public ResponseEntity<byte[]> scan(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam(value = "mode", defaultValue = "document") String mode) throws Exception {

        byte[] pdfBytes = imageScanService.scanToPdf(files, mode);
        String downloadName = imageScanService.buildDownloadFileName();
        String encoded = URLEncoder.encode(downloadName, StandardCharsets.UTF_8).replace("+", "%20");

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(pdfBytes.length)
                .body(pdfBytes);
    }
}
