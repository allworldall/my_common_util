package com.example.my_common_util.web.dto;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * HTTP 请求模拟：前端提交的代理请求
 */
public class HttpProxyRequest {

    private String method = "GET";
    private String url;
    private Map<String, String> headers = new LinkedHashMap<>();
    private String body;
    /** 超时毫秒；空则用服务端默认值 */
    private Integer timeoutMs;

    public String getMethod() {
        return method;
    }

    public void setMethod(String method) {
        this.method = method;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public Map<String, String> getHeaders() {
        return headers;
    }

    public void setHeaders(Map<String, String> headers) {
        this.headers = headers;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public Integer getTimeoutMs() {
        return timeoutMs;
    }

    public void setTimeoutMs(Integer timeoutMs) {
        this.timeoutMs = timeoutMs;
    }
}
