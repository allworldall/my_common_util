package com.example.my_common_util.web.dto;

import java.util.ArrayList;
import java.util.List;

public class FeedbackRequest {

    private String content;
    private String contact;
    private List<FeedbackImagePayload> images = new ArrayList<>();

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getContact() {
        return contact;
    }

    public void setContact(String contact) {
        this.contact = contact;
    }

    public List<FeedbackImagePayload> getImages() {
        return images;
    }

    public void setImages(List<FeedbackImagePayload> images) {
        this.images = images != null ? images : new ArrayList<>();
    }
}
