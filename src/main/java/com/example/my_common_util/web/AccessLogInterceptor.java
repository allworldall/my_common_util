package com.example.my_common_util.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 记录 API 访问：客户端 IP、方法、路径、状态码、耗时
 */
@Component
public class AccessLogInterceptor implements HandlerInterceptor {

    private static final Logger ACCESS_LOG = LoggerFactory.getLogger("ACCESS_LOG");
    private static final String START_ATTR = "accessLogStartNs";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        request.setAttribute(START_ATTR, System.nanoTime());
        return true;
    }

    @Override
    public void afterCompletion(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler,
            Exception ex) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return;
        }

        Object start = request.getAttribute(START_ATTR);
        long costMs = 0L;
        if (start instanceof Long startNs) {
            costMs = (System.nanoTime() - startNs) / 1_000_000L;
        }

        String query = request.getQueryString();
        String uri = request.getRequestURI();
        if (query != null && !query.isBlank()) {
            uri = uri + "?" + query;
        }

        ACCESS_LOG.info(
                "{} | {} {} | status={} | {}ms",
                ClientIpResolver.resolve(request),
                request.getMethod(),
                uri,
                response.getStatus(),
                costMs);
    }
}
