package com.example.my_common_util.web;

import java.util.Map;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.my_common_util.service.HttpProxyService;
import com.example.my_common_util.web.dto.HttpProxyRequest;

@RestController
@RequestMapping("/api/http")
public class HttpProxyController {

    private final HttpProxyService httpProxyService;

    public HttpProxyController(HttpProxyService httpProxyService) {
        this.httpProxyService = httpProxyService;
    }

    @PostMapping("/proxy")
    public Map<String, Object> proxy(@RequestBody HttpProxyRequest request) {
        return httpProxyService.execute(request);
    }
}
