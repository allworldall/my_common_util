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

import com.example.my_common_util.service.PdfCompressService;
import com.example.my_common_util.service.PdfCompressService.CompressResult;

@RestController
@RequestMapping("/api/pdf")
public class PdfCompressController {

    private final PdfCompressService pdfCompressService;

    public PdfCompressController(PdfCompressService pdfCompressService) {
        this.pdfCompressService = pdfCompressService;
    }

    /**
     * 压缩 PDF。
     * quality: high | balanced | small（默认 balanced）
     */
    @PostMapping("/compress")
    public ResponseEntity<byte[]> compress(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "quality", defaultValue = "balanced") String quality) throws Exception {

        CompressResult result = pdfCompressService.compress(file, quality);
        String encoded = URLEncoder.encode(result.fileName(), StandardCharsets.UTF_8).replace("+", "%20");

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .header("X-Original-Size", String.valueOf(result.originalSize()))
                .header("X-Output-Size", String.valueOf(result.outputSize()))
                .header("X-Compress-Skipped", result.skipped() ? "1" : "0")
                .header("X-Compress-Quality", result.quality())
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(result.bytes().length)
                .body(result.bytes());
    }
}
