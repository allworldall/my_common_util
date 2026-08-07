package com.example.my_common_util.web;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.example.my_common_util.config.FeedbackProperties;
import com.example.my_common_util.config.HttpProxyProperties;
import com.example.my_common_util.config.PdfCompressProperties;
import com.example.my_common_util.config.PdfSplitProperties;
import com.example.my_common_util.config.WordPdfProperties;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 基于 IP 的简易滑动窗口限流
 */
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private final PdfSplitProperties pdfProperties;
    private final PdfCompressProperties pdfCompressProperties;
    private final WordPdfProperties wordPdfProperties;
    private final FeedbackProperties feedbackProperties;
    private final HttpProxyProperties httpProxyProperties;
    private final Map<String, WindowCounter> counters = new ConcurrentHashMap<>();

    public RateLimitInterceptor(
            PdfSplitProperties pdfProperties,
            PdfCompressProperties pdfCompressProperties,
            WordPdfProperties wordPdfProperties,
            FeedbackProperties feedbackProperties,
            HttpProxyProperties httpProxyProperties) {
        this.pdfProperties = pdfProperties;
        this.pdfCompressProperties = pdfCompressProperties;
        this.wordPdfProperties = wordPdfProperties;
        this.feedbackProperties = feedbackProperties;
        this.httpProxyProperties = httpProxyProperties;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String path = request.getRequestURI();
        int limit;
        String bucket;
        if (path.startsWith("/api/feedback")) {
            limit = feedbackProperties.getRateLimitPerMinute();
            bucket = "feedback";
        } else if (path.startsWith("/api/doc")) {
            limit = wordPdfProperties.getRateLimitPerMinute();
            bucket = "doc";
        } else if (path.startsWith("/api/http")) {
            limit = httpProxyProperties.getRateLimitPerMinute();
            bucket = "http";
        } else if (path.startsWith("/api/pdf/compress")) {
            limit = pdfCompressProperties.getRateLimitPerMinute();
            bucket = "pdf-compress";
        } else {
            limit = pdfProperties.getRateLimitPerMinute();
            bucket = "pdf";
        }

        String clientIp = ClientIpResolver.resolve(request);
        String key = bucket + ":" + clientIp;
        long now = System.currentTimeMillis();
        WindowCounter counter = counters.compute(key, (k, existing) -> {
            if (existing == null || now - existing.windowStartMs >= 60_000L) {
                return new WindowCounter(now);
            }
            return existing;
        });

        int current = counter.count.incrementAndGet();
        if (current > limit) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"success\":false,\"message\":\"请求过于频繁，请稍后再试\"}");
            return false;
        }
        return true;
    }

    private static final class WindowCounter {
        final long windowStartMs;
        final AtomicInteger count = new AtomicInteger(0);

        WindowCounter(long windowStartMs) {
            this.windowStartMs = windowStartMs;
        }
    }
}
