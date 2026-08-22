package com.example.my_common_util.file.deal;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

import com.itextpdf.text.Document;
import com.itextpdf.text.exceptions.BadPasswordException;
import com.itextpdf.text.pdf.PdfCopy;
import com.itextpdf.text.pdf.PdfReader;

/**
 * 面向 HTTP 接口的 PDF 合并实现：按顺序复印两个文件的全部页面。
 */
public final class PdfStreamMerger {

    private static final String ENCRYPTED_MESSAGE = "不支持加密的 PDF";

    private PdfStreamMerger() {
    }

    /**
     * 将两个 PDF 按顺序合并，结果写入输出流。
     *
     * @return 合并后的总页数
     */
    public static int merge(InputStream first, InputStream second, OutputStream outputStream) throws Exception {
        PdfReader reader1 = null;
        PdfReader reader2 = null;
        Document document = null;

        try {
            reader1 = openReader(first);
            reader2 = openReader(second);

            document = new Document();
            PdfCopy copy = new PdfCopy(document, outputStream);
            document.open();

            int pages = addAllPages(copy, reader1) + addAllPages(copy, reader2);
            document.close();
            document = null;
            return pages;
        } finally {
            if (document != null && document.isOpen()) {
                document.close();
            }
            closeQuietly(reader1);
            closeQuietly(reader2);
        }
    }

    /**
     * 将两个 PDF 按顺序合并，返回字节数组。
     */
    public static byte[] mergeToBytes(InputStream first, InputStream second) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        merge(first, second, baos);
        return baos.toByteArray();
    }

    private static PdfReader openReader(InputStream inputStream) throws IOException {
        PdfReader reader;
        try {
            reader = new PdfReader(inputStream);
        } catch (BadPasswordException e) {
            throw new IllegalArgumentException(ENCRYPTED_MESSAGE);
        } catch (NoClassDefFoundError e) {
            // iText 读加密 PDF 依赖 BouncyCastle；未引入时也按加密处理
            if (e.getMessage() != null && e.getMessage().contains("bouncycastle")) {
                throw new IllegalArgumentException(ENCRYPTED_MESSAGE);
            }
            throw e;
        } catch (IOException e) {
            if (e.getMessage() != null && e.getMessage().toLowerCase().contains("password")) {
                throw new IllegalArgumentException(ENCRYPTED_MESSAGE);
            }
            throw e;
        }
        if (reader.isEncrypted()) {
            reader.close();
            throw new IllegalArgumentException(ENCRYPTED_MESSAGE);
        }
        return reader;
    }

    private static int addAllPages(PdfCopy copy, PdfReader reader) throws Exception {
        int total = reader.getNumberOfPages();
        for (int i = 1; i <= total; i++) {
            copy.addPage(copy.getImportedPage(reader, i));
        }
        return total;
    }

    private static void closeQuietly(PdfReader reader) {
        if (reader != null) {
            reader.close();
        }
    }
}
