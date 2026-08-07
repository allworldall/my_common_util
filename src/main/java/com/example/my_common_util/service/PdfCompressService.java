package com.example.my_common_util.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Stream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import com.example.my_common_util.config.PdfCompressProperties;

@Service
public class PdfCompressService {

    private static final Logger log = LoggerFactory.getLogger(PdfCompressService.class);

    public static final String QUALITY_HIGH = "high";
    public static final String QUALITY_BALANCED = "balanced";
    public static final String QUALITY_SMALL = "small";

    private static final String[] CANDIDATE_GS = {
            "gs",
            "ghostscript",
            "/usr/bin/gs",
            "/usr/local/bin/gs",
            "/opt/homebrew/bin/gs",
            "/usr/bin/ghostscript",
    };

    /** Ghostscript 内存占用较高，串行化执行 */
    private final ReentrantLock compressLock = new ReentrantLock();

    private final PdfCompressProperties properties;
    private volatile String resolvedGs;

    public PdfCompressService(PdfCompressProperties properties) {
        this.properties = properties;
    }

    public CompressResult compress(MultipartFile file, String quality) throws Exception {
        String q = normalizeQuality(quality);
        validateFile(file);

        long originalSize = file.getSize();
        String downloadName = buildDownloadFileName(file, q);

        compressLock.lock();
        try {
            Path workDir = Files.createTempDirectory("pdf-compress-");
            try {
                Path input = workDir.resolve(safeOriginalName(file));
                file.transferTo(input);
                Path output = workDir.resolve("output.pdf");

                runGhostscript(input, output, q);

                if (!Files.isRegularFile(output) || Files.size(output) == 0) {
                    throw new IllegalStateException("压缩结果为空，请检查文件内容后重试");
                }

                byte[] bytes = Files.readAllBytes(output);
                boolean skipped = false;
                // 个别 PDF 再压反而变大：直接返回原文件
                if (bytes.length >= originalSize) {
                    log.info("压缩未减小体积，返回原文件 original={} compressed={}", originalSize, bytes.length);
                    bytes = Files.readAllBytes(input);
                    skipped = true;
                    downloadName = buildDownloadFileName(file, null);
                }
                return new CompressResult(bytes, downloadName, originalSize, bytes.length, skipped, q);
            } finally {
                deleteRecursively(workDir);
            }
        } finally {
            compressLock.unlock();
        }
    }

    private void runGhostscript(Path input, Path output, String quality) throws Exception {
        String gs = resolveGs();
        QualityProfile profile = QualityProfile.of(quality);

        List<String> cmd = new ArrayList<>();
        cmd.add(gs);
        cmd.add("-sDEVICE=pdfwrite");
        cmd.add("-dCompatibilityLevel=1.4");
        cmd.add("-dNOPAUSE");
        cmd.add("-dBATCH");
        cmd.add("-dSAFER");
        cmd.add("-dQUIET");
        cmd.add("-dDetectDuplicateImages=true");
        cmd.add("-dCompressFonts=true");
        cmd.add("-dSubsetFonts=true");
        cmd.add("-dDownsampleColorImages=true");
        cmd.add("-dDownsampleGrayImages=true");
        cmd.add("-dDownsampleMonoImages=true");
        cmd.add("-dColorImageDownsampleType=/Bicubic");
        cmd.add("-dGrayImageDownsampleType=/Bicubic");
        cmd.add("-dMonoImageDownsampleType=/Bicubic");
        cmd.add("-dColorImageResolution=" + profile.imageDpi);
        cmd.add("-dGrayImageResolution=" + profile.imageDpi);
        cmd.add("-dMonoImageResolution=" + profile.monoDpi);
        cmd.add("-dAutoFilterColorImages=false");
        cmd.add("-dAutoFilterGrayImages=false");
        cmd.add("-dColorImageFilter=/DCTEncode");
        cmd.add("-dGrayImageFilter=/DCTEncode");
        cmd.add("-dJPEGQ=" + profile.jpegQ);
        cmd.add("-sOutputFile=" + output.toAbsolutePath());
        cmd.add(input.toAbsolutePath().toString());

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(true);
        Process process = pb.start();
        String outputText;
        try (InputStream in = process.getInputStream()) {
            outputText = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }

        boolean finished = process.waitFor(properties.getTimeoutSeconds(), TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new IllegalStateException("压缩超时，请缩小文件或改用更低质量档位后重试");
        }
        if (process.exitValue() != 0) {
            log.warn("Ghostscript 失败 exit={} output={}", process.exitValue(), truncate(outputText));
            throw new IllegalStateException("压缩失败，请确认 PDF 未损坏后重试");
        }
        log.debug("Ghostscript 输出: {}", truncate(outputText));
    }

    private String resolveGs() {
        String cached = resolvedGs;
        if (cached != null) {
            return cached;
        }

        if (StringUtils.hasText(properties.getGsPath())) {
            Path configured = Path.of(properties.getGsPath().trim());
            if (Files.isExecutable(configured)) {
                resolvedGs = configured.toAbsolutePath().toString();
                return resolvedGs;
            }
            log.warn("配置的 gs-path 不可用: {}，尝试自动探测", properties.getGsPath());
        }

        for (String candidate : CANDIDATE_GS) {
            Path path = Path.of(candidate);
            if (path.isAbsolute()) {
                if (Files.isExecutable(path)) {
                    resolvedGs = path.toString();
                    return resolvedGs;
                }
            } else if (isOnPath(candidate)) {
                resolvedGs = candidate;
                return resolvedGs;
            }
        }
        throw new IllegalStateException(
                "未找到 Ghostscript。请安装后配置 pdf.compress.gs-path（本机可用 brew install ghostscript）");
    }

    private boolean isOnPath(String command) {
        try {
            Process process = new ProcessBuilder("which", command).redirectErrorStream(true).start();
            boolean finished = process.waitFor(3, TimeUnit.SECONDS);
            return finished && process.exitValue() == 0;
        } catch (Exception e) {
            return false;
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("请上传 PDF 文件");
        }
        if (file.getSize() > properties.getMaxFileSizeBytes()) {
            long maxMb = properties.getMaxFileSizeBytes() / (1024 * 1024);
            throw new IllegalArgumentException("文件大小不能超过" + maxMb + "M");
        }

        String filename = file.getOriginalFilename();
        String lower = filename == null ? "" : filename.toLowerCase(Locale.ROOT);
        String contentType = file.getContentType();
        boolean byName = lower.endsWith(".pdf");
        boolean byType = contentType != null && contentType.toLowerCase(Locale.ROOT).contains("pdf");
        if (!byName && !byType) {
            throw new IllegalArgumentException("仅支持 PDF 文件");
        }
        validatePdfMagic(file);
    }

    private void validatePdfMagic(MultipartFile file) {
        try (InputStream in = file.getInputStream()) {
            byte[] header = in.readNBytes(5);
            String magic = new String(header, StandardCharsets.US_ASCII);
            if (!magic.startsWith("%PDF-")) {
                throw new IllegalArgumentException("文件内容不是有效的 PDF");
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (IOException e) {
            throw new IllegalArgumentException("无法读取上传文件");
        }
    }

    private String normalizeQuality(String quality) {
        if (!StringUtils.hasText(quality)) {
            return QUALITY_BALANCED;
        }
        String q = quality.trim().toLowerCase(Locale.ROOT);
        if (QUALITY_HIGH.equals(q) || QUALITY_BALANCED.equals(q) || QUALITY_SMALL.equals(q)) {
            return q;
        }
        throw new IllegalArgumentException("不支持的质量档位，请选择 high / balanced / small");
    }

    private String safeOriginalName(MultipartFile file) {
        String original = file.getOriginalFilename();
        if (!StringUtils.hasText(original)) {
            return "input.pdf";
        }
        String name = Path.of(original).getFileName().toString()
                .replaceAll("[\\\\/:*?\"<>|]", "_");
        if (!name.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            name = name + ".pdf";
        }
        return name;
    }

    public String buildDownloadFileName(MultipartFile file, String quality) {
        String original = file.getOriginalFilename();
        String base = "document";
        if (StringUtils.hasText(original)) {
            String name = Path.of(original).getFileName().toString();
            int dot = name.lastIndexOf('.');
            base = (dot > 0 ? name.substring(0, dot) : name)
                    .replaceAll("[\\\\/:*?\"<>|]", "_");
        }
        if (quality == null) {
            return base + ".pdf";
        }
        return base + "_compressed_" + quality + ".pdf";
    }

    private void deleteRecursively(Path root) {
        if (root == null || !Files.exists(root)) {
            return;
        }
        try (Stream<Path> walk = Files.walk(root)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException e) {
                    log.debug("清理临时文件失败: {}", p);
                }
            });
        } catch (IOException e) {
            log.debug("清理临时目录失败: {}", root);
        }
    }

    private String truncate(String text) {
        if (text == null) {
            return "";
        }
        String t = text.trim();
        return t.length() <= 500 ? t : t.substring(0, 500) + "...";
    }

    private record QualityProfile(int imageDpi, int monoDpi, int jpegQ) {
        static QualityProfile of(String quality) {
            return switch (quality) {
                case QUALITY_HIGH -> new QualityProfile(200, 300, 85);
                case QUALITY_SMALL -> new QualityProfile(96, 150, 55);
                default -> new QualityProfile(144, 200, 72);
            };
        }
    }

    public record CompressResult(
            byte[] bytes,
            String fileName,
            long originalSize,
            long outputSize,
            boolean skipped,
            String quality) {
    }
}
