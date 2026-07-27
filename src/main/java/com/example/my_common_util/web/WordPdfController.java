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

import com.example.my_common_util.service.WordPdfService;
import com.example.my_common_util.service.WordPdfService.ConvertResult;

@RestController
@RequestMapping("/api/doc")
public class WordPdfController {

    private final WordPdfService wordPdfService;

    public WordPdfController(WordPdfService wordPdfService) {
        this.wordPdfService = wordPdfService;
    }

    /**
     * Word ↔ PDF 互转。
     * direction: word-to-pdf | pdf-to-word
     */
    @PostMapping("/convert")
    public ResponseEntity<byte[]> convert(
            @RequestParam("file") MultipartFile file,
            @RequestParam("direction") String direction) throws Exception {

        ConvertResult result = wordPdfService.convert(file, direction);
        String encoded = URLEncoder.encode(result.fileName(), StandardCharsets.UTF_8).replace("+", "%20");

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .contentType(MediaType.parseMediaType(result.contentType()))
                .contentLength(result.bytes().length)
                .body(result.bytes());
    }
}
