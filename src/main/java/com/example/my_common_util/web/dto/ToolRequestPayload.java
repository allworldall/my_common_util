package com.example.my_common_util.web.dto;

/**
 * 「您还需要哪些工具」需求反馈
 */
public class ToolRequestPayload {

    /** 使用场景描述 */
    private String scenario;

    /** 大概的使用方式 */
    private String usage;

    /** 联系方式 */
    private String contact;

    public String getScenario() {
        return scenario;
    }

    public void setScenario(String scenario) {
        this.scenario = scenario;
    }

    public String getUsage() {
        return usage;
    }

    public void setUsage(String usage) {
        this.usage = usage;
    }

    public String getContact() {
        return contact;
    }

    public void setContact(String contact) {
        this.contact = contact;
    }
}
