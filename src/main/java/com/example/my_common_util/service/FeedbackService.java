package com.example.my_common_util.service;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.example.my_common_util.config.FeedbackProperties;
import com.example.my_common_util.web.dto.FeedbackImagePayload;
import com.example.my_common_util.web.dto.FeedbackRequest;
import com.example.my_common_util.web.dto.ToolRequestPayload;

import jakarta.activation.DataHandler;
import jakarta.mail.Message;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import jakarta.mail.util.ByteArrayDataSource;
import org.springframework.mail.javamail.JavaMailSender;

@Service
public class FeedbackService {

    private static final Logger log = LoggerFactory.getLogger(FeedbackService.class);

    private static final int MAX_CONTENT_LEN = 2000;
    private static final int MAX_SCENARIO_LEN = 1000;
    private static final int MAX_USAGE_LEN = 1000;
    private static final int MAX_CONTACT_LEN = 100;
    private static final int MAX_IMAGE_COUNT = 3;
    private static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    private static final Pattern IMAGE_MARKER = Pattern.compile("\\[图片(\\d+)\\]");
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp"
    );

    private final JavaMailSender mailSender;
    private final FeedbackProperties feedbackProperties;
    private final String mailUsername;
    private final String mailPassword;

    public FeedbackService(
            JavaMailSender mailSender,
            FeedbackProperties feedbackProperties,
            @Value("${spring.mail.username:}") String mailUsername,
            @Value("${spring.mail.password:}") String mailPassword) {
        this.mailSender = mailSender;
        this.feedbackProperties = feedbackProperties;
        this.mailUsername = mailUsername;
        this.mailPassword = mailPassword;
    }

    public void sendFeedback(FeedbackRequest request) {
        ensureMailReady("问题反馈");

        String trimmedContent = request.getContent() == null ? "" : request.getContent().trim();
        String trimmedContact = request.getContact() == null ? "" : request.getContact().trim();

        if (!StringUtils.hasText(trimmedContent)) {
            throw new IllegalArgumentException("请填写问题描述");
        }
        if (!StringUtils.hasText(trimmedContact)) {
            throw new IllegalArgumentException("请留下联系方式，方便我们优化后通知您");
        }
        if (trimmedContent.length() > MAX_CONTENT_LEN) {
            throw new IllegalArgumentException("反馈内容过长，请控制在 " + MAX_CONTENT_LEN + " 字以内");
        }
        if (trimmedContact.length() > MAX_CONTACT_LEN) {
            throw new IllegalArgumentException("联系方式过长");
        }

        List<DecodedImage> images = decodeImages(request.getImages());
        int markerCount = countImageMarkers(trimmedContent);
        if (markerCount > 0 && images.isEmpty()) {
            throw new IllegalArgumentException("图片未成功提交，请重新粘贴后再试");
        }
        if (markerCount > images.size()) {
            throw new IllegalArgumentException("部分图片未成功提交，请重新粘贴后再试");
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            message.setFrom(new InternetAddress(mailUsername));
            message.setRecipient(Message.RecipientType.TO, new InternetAddress(feedbackProperties.getTo()));
            message.setSubject("【工具集平台】问题反馈", "UTF-8");

            if (images.isEmpty()) {
                message.setText(buildProblemPlainText(trimmedContent, trimmedContact, 0), "UTF-8");
            } else {
                // multipart/related：HTML 正文 + 内嵌图；外层 mixed 再挂附件，兼容 QQ 邮箱
                MimeMultipart related = new MimeMultipart("related");

                MimeBodyPart htmlPart = new MimeBodyPart();
                htmlPart.setContent(buildProblemHtml(trimmedContent, trimmedContact, images), "text/html; charset=UTF-8");
                related.addBodyPart(htmlPart);

                for (int i = 0; i < images.size(); i++) {
                    DecodedImage image = images.get(i);
                    MimeBodyPart inlinePart = new MimeBodyPart();
                    inlinePart.setDataHandler(new DataHandler(
                            new ByteArrayDataSource(image.bytes(), image.contentType())));
                    inlinePart.setHeader("Content-ID", "<img" + (i + 1) + ">");
                    inlinePart.setDisposition(MimeBodyPart.INLINE);
                    inlinePart.setFileName(image.filename());
                    related.addBodyPart(inlinePart);
                }

                MimeBodyPart relatedWrapper = new MimeBodyPart();
                relatedWrapper.setContent(related);

                MimeMultipart mixed = new MimeMultipart("mixed");
                mixed.addBodyPart(relatedWrapper);

                for (int i = 0; i < images.size(); i++) {
                    DecodedImage image = images.get(i);
                    MimeBodyPart attachment = new MimeBodyPart();
                    attachment.setDataHandler(new DataHandler(
                            new ByteArrayDataSource(image.bytes(), image.contentType())));
                    attachment.setDisposition(MimeBodyPart.ATTACHMENT);
                    attachment.setFileName("图片" + (i + 1) + extensionFrom(image.contentType()));
                    mixed.addBodyPart(attachment);
                }

                message.setContent(mixed);
            }

            mailSender.send(message);
            log.info("问题反馈邮件已发送：images={}, contactLen={}", images.size(), trimmedContact.length());
        } catch (IllegalArgumentException | IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.error("问题反馈邮件发送失败", e);
            throw new IllegalStateException("邮件发送失败，请检查 QQ 邮箱 SMTP 与授权码是否正确", e);
        }
    }

    public void sendToolRequest(ToolRequestPayload request) {
        ensureMailReady("工具需求");

        String scenario = request.getScenario() == null ? "" : request.getScenario().trim();
        String usage = request.getUsage() == null ? "" : request.getUsage().trim();
        String contact = request.getContact() == null ? "" : request.getContact().trim();

        if (!StringUtils.hasText(scenario)) {
            throw new IllegalArgumentException("请描述工具的使用场景");
        }
        if (!StringUtils.hasText(usage)) {
            throw new IllegalArgumentException("请描述大概的使用方式");
        }
        if (!StringUtils.hasText(contact)) {
            throw new IllegalArgumentException("请留下联系方式，方便我们进一步沟通");
        }
        if (scenario.length() > MAX_SCENARIO_LEN) {
            throw new IllegalArgumentException("使用场景过长，请控制在 " + MAX_SCENARIO_LEN + " 字以内");
        }
        if (usage.length() > MAX_USAGE_LEN) {
            throw new IllegalArgumentException("使用方式过长，请控制在 " + MAX_USAGE_LEN + " 字以内");
        }
        if (contact.length() > MAX_CONTACT_LEN) {
            throw new IllegalArgumentException("联系方式过长");
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            message.setFrom(new InternetAddress(mailUsername));
            message.setRecipient(Message.RecipientType.TO, new InternetAddress(feedbackProperties.getTo()));
            message.setSubject("【工具集平台】工具需求反馈", "UTF-8");
            message.setText(buildToolRequestPlainText(scenario, usage, contact), "UTF-8");
            mailSender.send(message);
            log.info("工具需求邮件已发送：scenarioLen={}, usageLen={}", scenario.length(), usage.length());
        } catch (IllegalArgumentException | IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.error("工具需求邮件发送失败", e);
            throw new IllegalStateException("邮件发送失败，请检查 QQ 邮箱 SMTP 与授权码是否正确", e);
        }
    }

    private void ensureMailReady(String featureName) {
        if (!feedbackProperties.isEnabled()) {
            throw new IllegalStateException(featureName + "功能暂未开启");
        }
        if (!StringUtils.hasText(feedbackProperties.getTo())) {
            throw new IllegalStateException("未配置反馈接收邮箱");
        }
        if (!StringUtils.hasText(mailUsername) || !StringUtils.hasText(mailPassword)) {
            throw new IllegalStateException(
                    "邮件未配置完成：请设置 spring.mail.username，并用环境变量 MAIL_AUTH_CODE 配置 QQ 邮箱授权码");
        }
    }

    private static int countImageMarkers(String content) {
        Matcher matcher = IMAGE_MARKER.matcher(content);
        int count = 0;
        while (matcher.find()) {
            count++;
        }
        return count;
    }

    private List<DecodedImage> decodeImages(List<FeedbackImagePayload> payloads) {
        List<DecodedImage> images = new ArrayList<>();
        if (payloads == null || payloads.isEmpty()) {
            return images;
        }
        if (payloads.size() > MAX_IMAGE_COUNT) {
            throw new IllegalArgumentException("图片最多粘贴 " + MAX_IMAGE_COUNT + " 张");
        }

        for (int i = 0; i < payloads.size(); i++) {
            FeedbackImagePayload payload = payloads.get(i);
            if (payload == null || !StringUtils.hasText(payload.getDataBase64())) {
                throw new IllegalArgumentException("第 " + (i + 1) + " 张图片数据无效");
            }

            String contentType = normalizeContentType(payload.getContentType());
            if (!ALLOWED_IMAGE_TYPES.contains(contentType)) {
                throw new IllegalArgumentException("仅支持 JPG / PNG / GIF / WEBP 图片");
            }

            byte[] bytes = decodeBase64(payload.getDataBase64());
            if (bytes.length == 0) {
                throw new IllegalArgumentException("第 " + (i + 1) + " 张图片数据无效");
            }
            if (bytes.length > MAX_IMAGE_BYTES) {
                throw new IllegalArgumentException("单张图片不能超过 5MB");
            }

            String filename = buildFilename(payload.getName(), contentType, i + 1);
            images.add(new DecodedImage(filename, contentType, bytes));
        }
        return images;
    }

    private static byte[] decodeBase64(String raw) {
        String data = raw.trim();
        int comma = data.indexOf(',');
        if (data.startsWith("data:") && comma > 0) {
            data = data.substring(comma + 1);
        }
        data = data.replaceAll("\\s", "");
        try {
            return Base64.getDecoder().decode(data);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("图片数据解码失败", ex);
        }
    }

    private static String buildProblemPlainText(String content, String contact, int imageCount) {
        StringBuilder sb = new StringBuilder();
        sb.append("收到一条新的问题反馈：\n\n");
        sb.append("【问题描述】\n");
        sb.append(IMAGE_MARKER.matcher(content).replaceAll(mr -> "\n（见附件：图片" + mr.group(1) + "）\n"));
        sb.append("\n\n【用户联系方式】\n").append(contact);
        if (imageCount > 0) {
            sb.append("\n\n【图片】\n共 ").append(imageCount).append(" 张，请查看正文或附件");
        }
        sb.append("\n\n——系统自动发送");
        return sb.toString();
    }

    private static String buildToolRequestPlainText(String scenario, String usage, String contact) {
        return "收到一条新的工具需求：\n\n"
                + "【使用场景】\n" + scenario + "\n\n"
                + "【大概使用方式】\n" + usage + "\n\n"
                + "【用户联系方式】\n" + contact + "\n\n"
                + "——系统自动发送";
    }

    private static String buildProblemHtml(String content, String contact, List<DecodedImage> images) {
        String escaped = escapeHtml(content);
        Matcher matcher = IMAGE_MARKER.matcher(escaped);
        StringBuffer body = new StringBuffer();
        while (matcher.find()) {
            int index = Integer.parseInt(matcher.group(1));
            String replacement;
            if (index >= 1 && index <= images.size()) {
                replacement = "<br><img src=\"cid:img" + index
                        + "\" alt=\"图片" + index
                        + "\" style=\"max-width:100%;height:auto;border:1px solid #d5dee8;"
                        + "border-radius:8px;margin:8px 0;display:block;\"/><br>";
            } else {
                replacement = "（图片" + index + "缺失）";
            }
            matcher.appendReplacement(body, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(body);

        return "<div style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#152033;line-height:1.6;\">"
                + "<p>收到一条新的问题反馈：</p>"
                + "<p><strong>【问题描述】</strong></p>"
                + "<div>" + body.toString().replace("\n", "<br>") + "</div>"
                + "<p style=\"margin-top:16px;\"><strong>【用户联系方式】</strong><br>"
                + escapeHtml(contact) + "</p>"
                + "<p style=\"color:#5b6b7c;\">若正文未显示图片，请打开本邮件附件查看。</p>"
                + "<p style=\"color:#5b6b7c;\">——系统自动发送</p>"
                + "</div>";
    }

    private static String escapeHtml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private static String normalizeContentType(String contentType) {
        if (!StringUtils.hasText(contentType)) {
            return "";
        }
        return contentType.trim().toLowerCase(Locale.ROOT).split(";")[0];
    }

    private static String buildFilename(String original, String contentType, int index) {
        String ext = extensionFrom(contentType);
        String base = "feedback-" + index;
        if (StringUtils.hasText(original)) {
            String cleaned = original.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
            if (StringUtils.hasText(cleaned)) {
                int dot = cleaned.lastIndexOf('.');
                String nameOnly = dot > 0 ? cleaned.substring(0, dot) : cleaned;
                if (StringUtils.hasText(nameOnly)) {
                    base = nameOnly.length() > 40 ? nameOnly.substring(0, 40) : nameOnly;
                }
            }
        }
        return base + "-" + UUID.randomUUID().toString().substring(0, 8) + ext;
    }

    private static String extensionFrom(String contentType) {
        if ("image/jpeg".equals(contentType)) {
            return ".jpg";
        }
        if ("image/png".equals(contentType)) {
            return ".png";
        }
        if ("image/gif".equals(contentType)) {
            return ".gif";
        }
        if ("image/webp".equals(contentType)) {
            return ".webp";
        }
        return ".png";
    }

    private record DecodedImage(String filename, String contentType, byte[] bytes) {
    }
}
