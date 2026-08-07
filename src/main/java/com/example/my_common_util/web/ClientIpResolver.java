package com.example.my_common_util.web;

import jakarta.servlet.http.HttpServletRequest;

final class ClientIpResolver {

    private ClientIpResolver() {
    }

    /**
     * 优先信任 Nginx 写入的 X-Real-IP；不再优先使用可伪造的 X-Forwarded-For。
     * 部署时 Nginx 应设置：proxy_set_header X-Real-IP $remote_addr;
     */
    static String resolve(HttpServletRequest request) {
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
