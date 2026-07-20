package com.example.my_common_util.service;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.awt.image.ConvolveOp;
import java.awt.image.Kernel;
import java.awt.image.RescaleOp;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Locale;

import javax.imageio.ImageIO;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.example.my_common_util.config.PdfScanProperties;
import com.itextpdf.text.Document;
import com.itextpdf.text.Image;
import com.itextpdf.text.PageSize;
import com.itextpdf.text.Rectangle;
import com.itextpdf.text.pdf.PdfWriter;

@Service
public class ImageScanService {

    private static final Logger log = LoggerFactory.getLogger(ImageScanService.class);

    public enum ScanMode {
        COLOR,
        GRAY,
        DOCUMENT;

        static ScanMode from(String raw) {
            if (raw == null || raw.isBlank()) {
                return DOCUMENT;
            }
            return switch (raw.trim().toLowerCase(Locale.ROOT)) {
                case "color" -> COLOR;
                case "gray", "grey", "grayscale" -> GRAY;
                case "document", "bw", "scan" -> DOCUMENT;
                default -> throw new IllegalArgumentException("不支持的扫描模式：" + raw);
            };
        }
    }

    private final PdfScanProperties properties;

    public ImageScanService(PdfScanProperties properties) {
        this.properties = properties;
    }

    public byte[] scanToPdf(List<MultipartFile> files, String modeRaw) throws Exception {
        if (files == null || files.isEmpty()) {
            throw new IllegalArgumentException("请至少上传一张图片");
        }
        if (files.size() > properties.getMaxImages()) {
            throw new IllegalArgumentException("单次最多上传 " + properties.getMaxImages() + " 张图片");
        }

        ScanMode mode = ScanMode.from(modeRaw);
        log.info("开始图片扫描转 PDF：images={}, mode={}", files.size(), mode);

        ByteArrayOutputStream pdfOut = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 18, 18, 18, 18);
        PdfWriter.getInstance(document, pdfOut);
        document.open();

        try {
            for (int i = 0; i < files.size(); i++) {
                MultipartFile file = files.get(i);
                validateImage(file, i + 1);

                BufferedImage source = readImage(file, i + 1);
                BufferedImage scanned = enhance(source, mode);

                byte[] pngBytes = toPngBytes(scanned);
                Image pdfImage = Image.getInstance(pngBytes);
                fitToPage(document, pdfImage);
                if (i > 0) {
                    document.newPage();
                }
                document.add(pdfImage);
            }
        } finally {
            document.close();
        }

        byte[] result = pdfOut.toByteArray();
        log.info("图片扫描转 PDF 完成：pages={}, size={} bytes", files.size(), result.length);
        return result;
    }

    public String buildDownloadFileName() {
        return "scan-" + System.currentTimeMillis() + ".pdf";
    }

    private void validateImage(MultipartFile file, int index) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("第 " + index + " 张图片为空");
        }
        if (file.getSize() > properties.getMaxFileSizeBytes()) {
            long maxMb = properties.getMaxFileSizeBytes() / (1024 * 1024);
            throw new IllegalArgumentException("第 " + index + " 张图片不能超过 " + maxMb + "MB");
        }

        String contentType = file.getContentType() == null
                ? ""
                : file.getContentType().toLowerCase(Locale.ROOT);
        String name = file.getOriginalFilename() == null
                ? ""
                : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        boolean okType = contentType.contains("jpeg")
                || contentType.contains("jpg")
                || contentType.contains("png")
                || contentType.contains("bmp")
                || contentType.contains("gif");
        boolean okName = name.endsWith(".jpg")
                || name.endsWith(".jpeg")
                || name.endsWith(".png")
                || name.endsWith(".bmp")
                || name.endsWith(".gif");
        if (!okType && !okName) {
            throw new IllegalArgumentException("第 " + index + " 张仅支持 JPG / PNG / BMP / GIF");
        }
    }

    private static BufferedImage readImage(MultipartFile file, int index) throws IOException {
        BufferedImage image = ImageIO.read(file.getInputStream());
        if (image == null) {
            throw new IllegalArgumentException("第 " + index + " 张图片无法识别，请换一张重试");
        }
        return image;
    }

    private static BufferedImage enhance(BufferedImage source, ScanMode mode) {
        BufferedImage working = toRgb(source);
        working = mildSharpen(working);

        return switch (mode) {
            case COLOR -> boostContrast(working, 1.18f, -12f);
            case GRAY -> boostContrast(toGray(working), 1.25f, -16f);
            case DOCUMENT -> documentLook(toGray(working));
        };
    }

    private static BufferedImage toRgb(BufferedImage source) {
        if (source.getType() == BufferedImage.TYPE_INT_RGB) {
            return source;
        }
        BufferedImage rgb = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(source, 0, 0, null);
        g.dispose();
        return rgb;
    }

    private static BufferedImage toGray(BufferedImage source) {
        BufferedImage gray = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D g = gray.createGraphics();
        g.drawImage(source, 0, 0, null);
        g.dispose();
        return gray;
    }

    private static BufferedImage mildSharpen(BufferedImage source) {
        float[] kernel = {
                0f, -0.15f, 0f,
                -0.15f, 1.6f, -0.15f,
                0f, -0.15f, 0f
        };
        ConvolveOp op = new ConvolveOp(new Kernel(3, 3, kernel), ConvolveOp.EDGE_NO_OP, null);
        return op.filter(source, null);
    }

    private static BufferedImage boostContrast(BufferedImage source, float scale, float offset) {
        RescaleOp op = new RescaleOp(scale, offset, null);
        return op.filter(source, null);
    }

    /**
     * 文档扫描观感：灰度 + 对比拉伸 + 轻度二值化，接近扫描件白底黑字
     */
    private static BufferedImage documentLook(BufferedImage gray) {
        BufferedImage stretched = histogramStretch(gray);
        BufferedImage boosted = boostContrast(stretched, 1.35f, -28f);

        int w = boosted.getWidth();
        int h = boosted.getHeight();
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_BYTE_GRAY);
        long sum = 0L;
        int[] samples = new int[w * h];
        int idx = 0;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int v = boosted.getRaster().getSample(x, y, 0);
                samples[idx++] = v;
                sum += v;
            }
        }
        int mean = (int) (sum / samples.length);
        int threshold = Math.min(210, Math.max(140, mean + 18));

        idx = 0;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int v = samples[idx++];
                // 软阈值：接近阈值保留灰阶，远处推向黑/白
                int result;
                if (v < threshold - 25) {
                    result = Math.max(0, v - 30);
                } else if (v > threshold + 25) {
                    result = Math.min(255, v + 35);
                } else {
                    result = v > threshold ? 245 : 35;
                }
                out.getRaster().setSample(x, y, 0, result);
            }
        }
        return out;
    }

    private static BufferedImage histogramStretch(BufferedImage gray) {
        int w = gray.getWidth();
        int h = gray.getHeight();
        int min = 255;
        int max = 0;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int v = gray.getRaster().getSample(x, y, 0);
                if (v < min) min = v;
                if (v > max) max = v;
            }
        }
        if (max <= min) {
            return gray;
        }

        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_BYTE_GRAY);
        float scale = 255f / (max - min);
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int v = gray.getRaster().getSample(x, y, 0);
                int nv = Math.round((v - min) * scale);
                out.getRaster().setSample(x, y, 0, Math.max(0, Math.min(255, nv)));
            }
        }
        return out;
    }

    private static byte[] toPngBytes(BufferedImage image) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        if (!ImageIO.write(image, "png", baos)) {
            throw new IllegalStateException("图片编码失败");
        }
        return baos.toByteArray();
    }

    private static void fitToPage(Document document, Image image) {
        Rectangle page = document.getPageSize();
        float maxW = page.getWidth() - document.leftMargin() - document.rightMargin();
        float maxH = page.getHeight() - document.topMargin() - document.bottomMargin();
        image.scaleToFit(maxW, maxH);
        image.setAlignment(Image.ALIGN_CENTER);
    }
}
