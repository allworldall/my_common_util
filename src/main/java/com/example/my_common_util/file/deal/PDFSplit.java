package com.example.my_common_util.file.deal;

import com.itextpdf.text.Document;
import com.itextpdf.text.DocumentException;
import com.itextpdf.text.pdf.PdfCopy;
import com.itextpdf.text.pdf.PdfReader;
import com.itextpdf.text.pdf.PdfWriter;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * PDF拆分工具类
 * 功能：从指定PDF文件中提取指定页码范围，生成新的PDF文件
 */
public class PDFSplit {

    public static void main(String[] args) {
        splitByPage("/Users/panpan/document/学习/ai学习/agentic-design-patterns-zh.pdf",14, 24 );
    }

    /**
     * 按页码范围拆分PDF
     *
     * @param sourcePath 源PDF文件路径（本地绝对路径或相对路径）
     * @param startPage  起始页码（从1开始）
     * @param endPage    结束页码（包含该页）
     * @return 拆分后生成的新文件路径，如果失败则返回null
     * @throws IOException         文件读取/写入异常
     * @throws DocumentException   PDF处理异常
     */
    public static String splitByPage(String sourcePath, int startPage, int endPage) {

        // 1. 参数校验
        if (sourcePath == null || sourcePath.trim().isEmpty()) {
            throw new IllegalArgumentException("源文件路径不能为空");
        }

        File sourceFile = new File(sourcePath);
        if (!sourceFile.exists() || !sourceFile.isFile()) {
            throw new IllegalArgumentException("源文件不存在或不是有效文件: " + sourcePath);
        }

        if (startPage < 1) {
            throw new IllegalArgumentException("起始页码必须大于等于1");
        }

        if (endPage < startPage) {
            throw new IllegalArgumentException("结束页码不能小于起始页码");
        }

        // 2. 读取源PDF获取总页数
        PdfReader reader = null;
        Document document = null;
        PdfCopy copy = null;
        FileOutputStream fos = null;
        String outputPath = null;

        try {
            reader = new PdfReader(sourcePath);
            int totalPages = reader.getNumberOfPages();

            if (startPage > totalPages) {
                throw new IllegalArgumentException("起始页码(" + startPage + ")超过PDF总页数(" + totalPages + ")");
            }
            if (endPage > totalPages) {
                throw new IllegalArgumentException("结束页码(" + endPage + ")超过PDF总页数(" + totalPages + ")");
            }

            // 3. 生成输出文件名：split-年月日时分秒.pdf
            String timestamp = new SimpleDateFormat("yyyyMMddHHmm").format(new Date());
            String parentDir = sourceFile.getParent();
            String fileName = sourceFile.getName();
            String baseName = fileName.substring(0, fileName.lastIndexOf('.'));
            outputPath = parentDir + File.separator + "split-" + startPage + "-" + endPage + ".pdf";

            // 4. 创建新PDF文档
            document = new Document();
            fos = new FileOutputStream(outputPath);
            copy = new PdfCopy(document, fos);
            document.open();

            // 5. 提取指定范围的页面
            int pageCount = endPage - startPage + 1;
            for (int i = 0; i < pageCount; i++) {
                int pageNumber = startPage + i;
                // 导入页面并添加到新文档
                copy.addPage(copy.getImportedPage(reader, pageNumber));
            }

            System.out.println("✅ PDF拆分成功！");
            System.out.println("📄 源文件: " + sourcePath);
            System.out.println("📑 页码范围: " + startPage + " - " + endPage);
            System.out.println("📁 输出文件: " + outputPath);

            return outputPath;
        }catch (Exception e){
            e.printStackTrace();
            return "";
        } finally {
            // 6. 关闭资源（注意顺序）
            if (copy != null) {
                copy.close();
            }
            if (document != null) {
                document.close();
            }
            if (fos != null) {
                try {
                    fos.close();
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }
            if (reader != null) {
                reader.close();
            }
        }
    }

    public static List<String> splitByPage(String sourcePath, List<int[]> pageRanges) {
        List<String> result = new ArrayList<String>();
        if(! pageRanges.isEmpty()) {
            pageRanges.forEach(arr -> {
                result.add(splitByPage(sourcePath, arr[0], arr[1]));
            });
        }
        return result;
    }
}
