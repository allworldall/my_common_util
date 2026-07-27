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

import com.example.my_common_util.config.WordPdfProperties;

@Service
public class WordPdfService {

    private static final Logger log = LoggerFactory.getLogger(WordPdfService.class);

    public static final String DIRECTION_WORD_TO_PDF = "word-to-pdf";
    public static final String DIRECTION_PDF_TO_WORD = "pdf-to-word";

    private static final String[] CANDIDATE_SOFFICE = {
            "soffice",
            "libreoffice",
            "/usr/bin/soffice",
            "/usr/bin/libreoffice",
            "/usr/lib/libreoffice/program/soffice",
            "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    };

    private static final String[] CANDIDATE_PYTHON = {
            "python3.8",
            "python3",
            "python",
            "/usr/bin/python3.8",
            "/usr/bin/python3",
            "/usr/local/bin/python3",
    };

    /** LibreOffice / pdf2docx 并发转换不稳定，串行化执行 */
    private final ReentrantLock convertLock = new ReentrantLock();

    private final WordPdfProperties properties;
    private volatile String resolvedSoffice;
    private volatile String resolvedPython;
    private volatile String resolvedPdf2docxScript;

    public WordPdfService(WordPdfProperties properties) {
        this.properties = properties;
    }

    public ConvertResult convert(MultipartFile file, String direction) throws Exception {
        String dir = normalizeDirection(direction);
        validateFile(file, dir);

        String targetExt = DIRECTION_WORD_TO_PDF.equals(dir) ? "pdf" : "docx";
        String downloadName = buildDownloadFileName(file, targetExt);
        String contentType = DIRECTION_WORD_TO_PDF.equals(dir)
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

        convertLock.lock();
        try {
            Path workDir = Files.createTempDirectory("word-pdf-");
            try {
                String originalName = safeOriginalName(file, dir);
                Path input = workDir.resolve(originalName);
                file.transferTo(input);

                Path output;
                if (DIRECTION_PDF_TO_WORD.equals(dir)) {
                    output = convertPdfToWord(workDir, input, targetExt);
                } else {
                    output = convertWithLibreOffice(workDir, input, targetExt, dir);
                }

                byte[] bytes = Files.readAllBytes(output);
                if (bytes.length == 0) {
                    throw new IllegalStateException("转换结果为空，请检查文件内容");
                }
                return new ConvertResult(bytes, downloadName, contentType);
            } finally {
                deleteRecursively(workDir);
            }
        } finally {
            convertLock.unlock();
        }
    }

    /** PDF→Word：优先 pdf2docx，失败再回退 LibreOffice */
    private Path convertPdfToWord(Path workDir, Path input, String targetExt) throws Exception {
        if (properties.isPdf2docxEnabled()) {
            try {
                Path output = runPdf2docx(workDir, input);
                if (Files.isRegularFile(output) && Files.size(output) > 0) {
                    log.info("PDF→Word 使用 pdf2docx 完成: {}", output.getFileName());
                    return output;
                }
                log.warn("pdf2docx 未生成有效文件，回退 LibreOffice");
            } catch (Exception e) {
                log.warn("pdf2docx 失败，回退 LibreOffice: {}", e.getMessage());
            }
        }
        return convertWithLibreOffice(workDir, input, targetExt, DIRECTION_PDF_TO_WORD);
    }

    private Path convertWithLibreOffice(Path workDir, Path input, String targetExt, String direction)
            throws Exception {
        String soffice = resolveSoffice();
        Path profileDir = Files.createTempDirectory("lo-profile-");
        try {
            String loOutput = runLibreOffice(soffice, workDir, profileDir, input, targetExt, direction);
            return findOutput(workDir, input.getFileName().toString(), targetExt, loOutput);
        } finally {
            deleteRecursively(profileDir);
        }
    }

    private Path runPdf2docx(Path workDir, Path input) throws Exception {
        String python = resolvePython();
        String script = resolvePdf2docxScript();
        String base = stripExtension(input.getFileName().toString());
        Path output = workDir.resolve(base + ".docx");

        List<String> cmd = List.of(
                python,
                script,
                input.toAbsolutePath().toString(),
                output.toAbsolutePath().toString());
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(true);
        pb.directory(workDir.toFile());

        Process process = pb.start();
        String console;
        try (InputStream in = process.getInputStream()) {
            console = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }

        boolean finished = process.waitFor(properties.getTimeoutSeconds(), TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new IllegalStateException("pdf2docx 转换超时");
        }
        if (process.exitValue() != 0) {
            throw new IllegalStateException("pdf2docx 退出码=" + process.exitValue() + " " + truncate(console));
        }
        if (!Files.isRegularFile(output)) {
            throw new IllegalStateException("pdf2docx 未生成输出 " + truncate(console));
        }
        log.debug("pdf2docx 输出: {}", truncate(console));
        return output;
    }

    private String runLibreOffice(
            String soffice, Path workDir, Path profileDir, Path input, String targetExt, String direction)
            throws Exception {
        String profileUri = profileDir.toUri().toString();
        List<String> cmd = new ArrayList<>();
        cmd.add(soffice);
        cmd.add("--headless");
        cmd.add("--nologo");
        cmd.add("--nolockcheck");
        cmd.add("--nodefault");
        cmd.add("--nofirststartwizard");
        cmd.add("-env:UserInstallation=" + profileUri);
        // PDF 默认进 Draw，无法导出 docx；必须用 Writer PDF 导入过滤器
        if (DIRECTION_PDF_TO_WORD.equals(direction)) {
            cmd.add("--infilter=writer_pdf_import");
        }
        cmd.add("--convert-to");
        cmd.add(targetExt);
        cmd.add("--outdir");
        cmd.add(workDir.toAbsolutePath().toString());
        cmd.add(input.toAbsolutePath().toString());

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(true);
        pb.directory(workDir.toFile());

        Process process = pb.start();
        String output;
        try (InputStream in = process.getInputStream()) {
            output = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }

        boolean finished = process.waitFor(properties.getTimeoutSeconds(), TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new IllegalStateException("转换超时，请缩小文件后重试");
        }
        if (process.exitValue() != 0 || looksLikeLibreOfficeFailure(output)) {
            log.warn("LibreOffice 转换失败 exit={} output={}", process.exitValue(), truncate(output));
            throw new IllegalStateException("转换失败，请确认文件未损坏且格式受支持");
        }
        log.debug("LibreOffice 输出: {}", truncate(output));
        return output;
    }

    private boolean looksLikeLibreOfficeFailure(String output) {
        if (output == null || output.trim().isEmpty()) {
            return false;
        }
        String lower = output.toLowerCase(Locale.ROOT);
        return lower.contains("no export filter")
                || lower.contains("source file could not be loaded")
                || lower.contains("error: please verify input parameters");
    }

    private Path findOutput(Path workDir, String inputFileName, String targetExt, String loOutput)
            throws IOException {
        String base = stripExtension(inputFileName);
        Path expected = workDir.resolve(base + "." + targetExt);
        if (Files.isRegularFile(expected)) {
            return expected;
        }

        try (Stream<Path> stream = Files.list(workDir)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().toLowerCase(Locale.ROOT).endsWith("." + targetExt))
                    .findFirst()
                    .orElseThrow(() -> {
                        log.warn("未找到转换结果 targetExt={} loOutput={}", targetExt, truncate(loOutput));
                        return new IllegalStateException("未生成转换结果，请稍后重试");
                    });
        }
    }

    private String stripExtension(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot > 0 ? fileName.substring(0, dot) : fileName;
    }

    private String resolveSoffice() {
        String cached = resolvedSoffice;
        if (cached != null) {
            return cached;
        }

        if (StringUtils.hasText(properties.getSofficePath())) {
            Path configured = Path.of(properties.getSofficePath());
            if (Files.isExecutable(configured)) {
                resolvedSoffice = configured.toAbsolutePath().toString();
                return resolvedSoffice;
            }
            log.warn("配置的 soffice-path 不可用: {}，尝试自动探测", properties.getSofficePath());
        }

        for (String candidate : CANDIDATE_SOFFICE) {
            Path path = Path.of(candidate);
            if (path.isAbsolute()) {
                if (Files.isExecutable(path)) {
                    resolvedSoffice = path.toString();
                    return resolvedSoffice;
                }
            } else if (isOnPath(candidate)) {
                resolvedSoffice = candidate;
                return resolvedSoffice;
            }
        }
        throw new IllegalStateException(
                "未找到 LibreOffice。请按当前环境安装，并在 application-local.yaml / application-prod.yaml 配置 doc.convert.soffice-path");
    }

    private String resolvePython() {
        String cached = resolvedPython;
        if (cached != null) {
            return cached;
        }

        List<String> candidates = new ArrayList<>();
        if (StringUtils.hasText(properties.getPythonBin())) {
            candidates.add(properties.getPythonBin().trim());
        }
        for (String c : CANDIDATE_PYTHON) {
            if (!candidates.contains(c)) {
                candidates.add(c);
            }
        }

        for (String candidate : candidates) {
            Path path = Path.of(candidate);
            if (path.isAbsolute()) {
                if (Files.isExecutable(path)) {
                    resolvedPython = path.toString();
                    return resolvedPython;
                }
            } else if (isOnPath(candidate)) {
                resolvedPython = candidate;
                return resolvedPython;
            }
        }
        throw new IllegalStateException("未找到 python3。请安装 Python 3，并配置 doc.convert.python-bin");
    }

    private String resolvePdf2docxScript() {
        String cached = resolvedPdf2docxScript;
        if (cached != null) {
            return cached;
        }

        List<Path> candidates = new ArrayList<>();
        if (StringUtils.hasText(properties.getPdf2docxScript())) {
            candidates.add(Path.of(properties.getPdf2docxScript().trim()));
        }
        String appHome = System.getenv("APP_HOME");
        if (StringUtils.hasText(appHome)) {
            candidates.add(Path.of(appHome, "pdf2docx_convert.py"));
        }
        String userDir = System.getProperty("user.dir", "");
        if (StringUtils.hasText(userDir)) {
            candidates.add(Path.of(userDir, "pdf2docx_convert.py"));
            candidates.add(Path.of(userDir, "deploy", "pdf2docx_convert.py"));
        }
        candidates.add(Path.of("/var/app/my_common_util/pdf2docx_convert.py"));

        for (Path candidate : candidates) {
            if (Files.isRegularFile(candidate)) {
                resolvedPdf2docxScript = candidate.toAbsolutePath().toString();
                return resolvedPdf2docxScript;
            }
        }
        throw new IllegalStateException(
                "未找到 pdf2docx_convert.py。请确认已随发布上传，或配置 doc.convert.pdf2docx-script");
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

    private void validateFile(MultipartFile file, String direction) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("请上传文件");
        }
        if (file.getSize() > properties.getMaxFileSizeBytes()) {
            long maxMb = properties.getMaxFileSizeBytes() / (1024 * 1024);
            throw new IllegalArgumentException("文件大小不能超过" + maxMb + "M");
        }

        String filename = file.getOriginalFilename();
        String lower = filename == null ? "" : filename.toLowerCase(Locale.ROOT);

        if (DIRECTION_WORD_TO_PDF.equals(direction)) {
            boolean byName = lower.endsWith(".docx") || lower.endsWith(".doc");
            if (!byName) {
                throw new IllegalArgumentException("Word 转 PDF 仅支持 .doc / .docx");
            }
            validateWordMagic(file, lower);
        } else {
            boolean byName = lower.endsWith(".pdf");
            String contentType = file.getContentType();
            boolean byType = contentType != null && contentType.toLowerCase(Locale.ROOT).contains("pdf");
            if (!byName && !byType) {
                throw new IllegalArgumentException("PDF 转 Word 仅支持 .pdf");
            }
            validatePdfMagic(file);
        }
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

    private void validateWordMagic(MultipartFile file, String lowerName) {
        try (InputStream in = file.getInputStream()) {
            byte[] header = in.readNBytes(8);
            if (lowerName.endsWith(".docx")) {
                // OOXML 本质是 ZIP：PK\x03\x04
                if (header.length < 2 || header[0] != 'P' || header[1] != 'K') {
                    throw new IllegalArgumentException("文件内容不是有效的 Word(.docx)");
                }
            } else if (lowerName.endsWith(".doc")) {
                // OLE Compound Document
                boolean ole = header.length >= 4
                        && (header[0] & 0xFF) == 0xD0
                        && (header[1] & 0xFF) == 0xCF
                        && (header[2] & 0xFF) == 0x11
                        && (header[3] & 0xFF) == 0xE0;
                if (!ole) {
                    throw new IllegalArgumentException("文件内容不是有效的 Word(.doc)");
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (IOException e) {
            throw new IllegalArgumentException("无法读取上传文件");
        }
    }

    private String normalizeDirection(String direction) {
        if (!StringUtils.hasText(direction)) {
            throw new IllegalArgumentException("请选择转换方向");
        }
        String d = direction.trim().toLowerCase(Locale.ROOT);
        if (!DIRECTION_WORD_TO_PDF.equals(d) && !DIRECTION_PDF_TO_WORD.equals(d)) {
            throw new IllegalArgumentException("不支持的转换方向");
        }
        return d;
    }

    private String safeOriginalName(MultipartFile file, String direction) {
        String original = file.getOriginalFilename();
        if (!StringUtils.hasText(original)) {
            return DIRECTION_WORD_TO_PDF.equals(direction) ? "input.docx" : "input.pdf";
        }
        String name = Path.of(original).getFileName().toString()
                .replaceAll("[\\\\/:*?\"<>|]", "_");
        if (!name.contains(".")) {
            name = name + (DIRECTION_WORD_TO_PDF.equals(direction) ? ".docx" : ".pdf");
        }
        return name;
    }

    public String buildDownloadFileName(MultipartFile file, String targetExt) {
        String original = file.getOriginalFilename();
        String base = "document";
        if (StringUtils.hasText(original)) {
            String name = Path.of(original).getFileName().toString();
            int dot = name.lastIndexOf('.');
            base = (dot > 0 ? name.substring(0, dot) : name)
                    .replaceAll("[\\\\/:*?\"<>|]", "_");
        }
        return base + "." + targetExt;
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

    public record ConvertResult(byte[] bytes, String fileName, String contentType) {
    }
}
