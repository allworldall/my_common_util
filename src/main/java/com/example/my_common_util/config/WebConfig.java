package com.example.my_common_util.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.example.my_common_util.web.RateLimitInterceptor;
import com.example.my_common_util.web.ApiTokenInterceptor;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final RateLimitInterceptor rateLimitInterceptor;
    private final ApiTokenInterceptor apiTokenInterceptor;

    public WebConfig(RateLimitInterceptor rateLimitInterceptor, ApiTokenInterceptor apiTokenInterceptor) {
        this.rateLimitInterceptor = rateLimitInterceptor;
        this.apiTokenInterceptor = apiTokenInterceptor;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("Content-Disposition")
                .allowCredentials(false)
                .maxAge(3600);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(apiTokenInterceptor)
                .addPathPatterns("/api/pdf/**");
        registry.addInterceptor(rateLimitInterceptor)
                .addPathPatterns("/api/pdf/**", "/api/feedback/**");
    }
}
