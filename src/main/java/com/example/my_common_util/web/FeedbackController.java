package com.example.my_common_util.web;

import java.util.HashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.my_common_util.web.dto.FeedbackRequest;

@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    private final FeedbackService feedbackService;

    public FeedbackController(FeedbackService feedbackService) {
        this.feedbackService = feedbackService;
    }

    @PostMapping
    public Map<String, Object> submit(@RequestBody FeedbackRequest request) {
        feedbackService.sendFeedback(request);
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "感谢您的反馈，我们已收到！");
        return result;
    }
}
