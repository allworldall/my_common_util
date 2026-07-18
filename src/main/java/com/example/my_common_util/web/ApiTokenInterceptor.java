package com.example.my_common_util.web;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import com.example.my_common_util.config.PdfSplitProperties;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 可选的简易 API Token 校验（配置 pdf.split.api-token 后生效）
 */
@Component
public class ApiTokenInterceptor implements HandlerInterceptor {

    public static final String HEADER_NAME = "X-Api-Token";

    private final PdfSplitProperties properties;

    public ApiTokenInterceptor(PdfSplitProperties properties) {
        this.properties = properties;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String expected = properties.getApiToken();
        if (!StringUtils.hasText(expected)) {
            return true;
        }

        String provided = request.getHeader(HEADER_NAME);
        if (!expected.equals(provided)) {
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"success\":false,\"message\":\"无效的访问令牌\"}");
            return false;
        }
        return true;
    }
}
