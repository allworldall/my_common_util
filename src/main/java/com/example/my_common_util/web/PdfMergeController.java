package com.example.my_common_util.web;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.my_common_util.file.deal.PdfMergeService;

@RestController
@RequestMapping("/api/pdf")
public class PdfMergeController {

    private final PdfMergeService pdfMergeService;

    public PdfMergeController(PdfMergeService pdfMergeService) {
        this.pdfMergeService = pdfMergeService;
    }

    /**
     * 按展示顺序合并两个 PDF，直接返回文件流供下载。
     */
    @PostMapping("/merge")
    public ResponseEntity<byte[]> merge(
            @RequestParam(value = "file1", required = false) MultipartFile file1,
            @RequestParam(value = "file2", required = false) MultipartFile file2) throws Exception {

        byte[] pdfBytes = pdfMergeService.merge(file1, file2);
        String downloadName = pdfMergeService.buildDownloadFileName(file1, file2);
        String encoded = URLEncoder.encode(downloadName, StandardCharsets.UTF_8).replace("+", "%20");

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(pdfBytes.length)
                .body(pdfBytes);
    }
}
