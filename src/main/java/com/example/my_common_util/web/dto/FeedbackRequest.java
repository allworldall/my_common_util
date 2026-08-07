package com.example.my_common_util.web.dto;

import java.util.ArrayList;
import java.util.List;

public class FeedbackRequest {

    private String content;
    private String contact;
    private List<FeedbackImagePayload> images = new ArrayList<>();

    /** 蜜罐字段：正常用户应为空；机器人填写则静默丢弃 */
    private String website;

    /** 反馈来源工具名（工具详情页提交时有值，首页为空） */
    private String sourceTool;

    /** 反馈来源页面，如「首页」或「/tools/json.html」 */
    private String sourcePage;

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

    public String getWebsite() {
        return website;
    }

    public void setWebsite(String website) {
        this.website = website;
    }

    public String getSourceTool() {
        return sourceTool;
    }

    public void setSourceTool(String sourceTool) {
        this.sourceTool = sourceTool;
    }

    public String getSourcePage() {
        return sourcePage;
    }

    public void setSourcePage(String sourcePage) {
        this.sourcePage = sourcePage;
    }
}
