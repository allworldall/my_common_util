package com.example.my_common_util.web;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.my_common_util.file.deal.PdfSplitService;

@RestController
@RequestMapping("/api/pdf")
public class PdfSplitController {

    private final PdfSplitService pdfSplitService;

    public PdfSplitController(PdfSplitService pdfSplitService) {
        this.pdfSplitService = pdfSplitService;
    }

    /**
     * 查询上传 PDF 的总页数
     */
    @PostMapping("/info")
    public Map<String, Object> info(@RequestParam("file") MultipartFile file) throws Exception {
        int pageCount = pdfSplitService.getPageCount(file);
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("pageCount", pageCount);
        result.put("fileName", file.getOriginalFilename());
        result.put("fileSize", file.getSize());
        return result;
    }

    /**
     * 按页码范围拆分 PDF，直接返回文件流供下载
     */
    @PostMapping("/split")
    public ResponseEntity<byte[]> split(
            @RequestParam("file") MultipartFile file,
            @RequestParam("startPage") int startPage,
            @RequestParam("endPage") int endPage) throws Exception {

        byte[] pdfBytes = pdfSplitService.split(file, startPage, endPage);
        String downloadName = pdfSplitService.buildDownloadFileName(file, startPage, endPage);
        String encoded = URLEncoder.encode(downloadName, StandardCharsets.UTF_8).replace("+", "%20");

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(pdfBytes.length)
                .body(pdfBytes);
    }
}
