package com.example.my_common_util.file.deal;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

import com.itextpdf.text.Document;
import com.itextpdf.text.pdf.PdfCopy;
import com.itextpdf.text.pdf.PdfReader;

/**
 * 面向 HTTP 接口的 PDF 拆分实现（基于输入流/字节，与本地文件版 {@link PDFSplit} 相互独立）
 */
public final class PdfStreamSplitter {

    private PdfStreamSplitter() {
    }

    /**
     * 按页码范围拆分 PDF，结果写入输出流
     *
     * @return 拆分出的页数
     */
    public static int splitByPage(InputStream inputStream, int startPage, int endPage, OutputStream outputStream)
            throws Exception {
        validatePageRange(startPage, endPage);

        PdfReader reader = null;
        Document document = null;

        try {
            reader = new PdfReader(inputStream);
            int totalPages = reader.getNumberOfPages();
            validateAgainstTotalPages(startPage, endPage, totalPages);

            document = new Document();
            PdfCopy copy = new PdfCopy(document, outputStream);
            document.open();

            int pageCount = endPage - startPage + 1;
            for (int i = 0; i < pageCount; i++) {
                copy.addPage(copy.getImportedPage(reader, startPage + i));
            }
            document.close();
            document = null;
            return pageCount;
        } finally {
            if (document != null && document.isOpen()) {
                document.close();
            }
            if (reader != null) {
                reader.close();
            }
        }
    }

    /**
     * 按页码范围拆分 PDF，返回字节数组
     */
    public static byte[] splitByPageToBytes(InputStream inputStream, int startPage, int endPage) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        splitByPage(inputStream, startPage, endPage, baos);
        return baos.toByteArray();
    }

    /**
     * 获取 PDF 总页数
     */
    public static int getPageCount(InputStream inputStream) throws IOException {
        PdfReader reader = null;
        try {
            reader = new PdfReader(inputStream);
            return reader.getNumberOfPages();
        } finally {
            if (reader != null) {
                reader.close();
            }
        }
    }

    private static void validatePageRange(int startPage, int endPage) {
        if (startPage < 1) {
            throw new IllegalArgumentException("起始页码必须大于等于1");
        }
        if (endPage < startPage) {
            throw new IllegalArgumentException("结束页码不能小于起始页码");
        }
    }

    private static void validateAgainstTotalPages(int startPage, int endPage, int totalPages) {
        if (startPage > totalPages) {
            throw new IllegalArgumentException("起始页码(" + startPage + ")超过PDF总页数(" + totalPages + ")");
        }
        if (endPage > totalPages) {
            throw new IllegalArgumentException("结束页码(" + endPage + ")超过PDF总页数(" + totalPages + ")");
        }
    }
}
