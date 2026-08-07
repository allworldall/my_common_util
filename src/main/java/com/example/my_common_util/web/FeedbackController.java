package com.example.my_common_util.web;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.my_common_util.service.FeedbackService;
import com.example.my_common_util.web.dto.FeedbackRequest;
import com.example.my_common_util.web.dto.ToolRequestPayload;

@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    private static final Logger log = LoggerFactory.getLogger(FeedbackController.class);

    private final FeedbackService feedbackService;

    public FeedbackController(FeedbackService feedbackService) {
        this.feedbackService = feedbackService;
    }

    @PostMapping
    public Map<String, Object> submit(@RequestBody FeedbackRequest request) {
        if (isHoneypot(request != null ? request.getWebsite() : null)) {
            return ok("感谢您的反馈，我们已收到！");
        }
        feedbackService.sendFeedback(request);
        return ok("感谢您的反馈，我们已收到！");
    }

    @PostMapping("/tool-request")
    public Map<String, Object> submitToolRequest(@RequestBody ToolRequestPayload request) {
        if (isHoneypot(request != null ? request.getWebsite() : null)) {
            return ok("感谢您的建议，我们已收到！");
        }
        feedbackService.sendToolRequest(request);
        return ok("感谢您的建议，我们已收到！");
    }

    private boolean isHoneypot(String website) {
        if (StringUtils.hasText(website)) {
            log.info("反馈蜜罐触发，已静默丢弃");
            return true;
        }
        return false;
    }

    private Map<String, Object> ok(String message) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", message);
        return result;
    }
}
