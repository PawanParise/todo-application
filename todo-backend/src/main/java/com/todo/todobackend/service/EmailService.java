package com.todo.todobackend.service;

import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.properties.mail.smtp.from:pavanparise77@gmail.com}")
    private String fromEmail;

    @Value("${spring.mail.username:pavanparise77@gmail.com}")
    private String smtpUsername;

    @Value("${spring.mail.password:}")
    private String smtpPassword;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendOtpEmail(String toEmail, String otp) {
        if (smtpPassword == null || smtpPassword.isBlank() || smtpPassword.contains("YOUR_")) {
            System.err.println("❌ Cannot send email: Gmail App Password is not set in application.properties.");
            throw new RuntimeException("Gmail App Password is not configured in application.properties. Please configure spring.mail.password with your 16-character Google App Password.");
        }

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("🔐 Todo App - Password Reset Verification Code");

            String html = "<!DOCTYPE html>"
                    + "<html><head><meta charset='UTF-8'>"
                    + "<style>"
                    + "body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f6f8fa; margin: 0; padding: 20px; }"
                    + ".container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; }"
                    + ".header { text-align: center; margin-bottom: 24px; }"
                    + ".logo { font-size: 24px; font-weight: bold; color: #aa3bff; }"
                    + ".title { font-size: 20px; font-weight: 600; color: #111827; margin: 12px 0 6px 0; }"
                    + ".subtitle { color: #6b7280; font-size: 14px; margin: 0; }"
                    + ".otp-box { background: #f9f5ff; border: 2px dashed #aa3bff; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }"
                    + ".otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #aa3bff; font-family: Consolas, monospace; }"
                    + ".expiry { font-size: 13px; color: #7c3aed; margin-top: 8px; font-weight: 500; }"
                    + ".note { color: #6b7280; font-size: 13px; line-height: 1.5; margin: 16px 0; }"
                    + ".footer { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; }"
                    + "</style></head><body>"
                    + "<div class='container'>"
                    + "<div class='header'>"
                    + "<div class='logo'>✓ Todo App</div>"
                    + "<h2 class='title'>Password Reset Verification</h2>"
                    + "<p class='subtitle'>Use the verification code below to reset your password.</p>"
                    + "</div>"
                    + "<div class='otp-box'>"
                    + "<div class='otp-code'>" + otp + "</div>"
                    + "<div class='expiry'>⏱ This code is valid for 10 minutes</div>"
                    + "</div>"
                    + "<p class='note'>If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>"
                    + "<div class='footer'>© Todo App • All rights reserved.</div>"
                    + "</div></body></html>";

            helper.setText(html, true);
            mailSender.send(mimeMessage);
            System.out.println("✅ [TODO-APP OTP] Email successfully delivered to " + toEmail + " from " + fromEmail);
        } catch (Exception e) {
            System.err.println("❌ Failed to deliver OTP email via SMTP: " + e.getMessage());
            throw new RuntimeException("Failed to deliver verification email: " + e.getMessage());
        }
    }

    public void sendTaskReminderEmail(String toEmail, com.todo.todobackend.model.Todo todo) {
        if (smtpPassword == null || smtpPassword.isBlank() || smtpPassword.contains("YOUR_")) {
            System.err.println("⚠️ Cannot send reminder email: Gmail App Password is not set in application.properties.");
            return;
        }

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("⏰ Task Reminder: " + todo.getTitle());

            String dueDateStr = todo.getDueDate() != null ? todo.getDueDate().toString() : "Not specified";
            String dueTimeStr = todo.getDueTime() != null ? todo.getDueTime().toString().substring(0, 5) : "Not specified";
            String descStr = todo.getDescription() != null && !todo.getDescription().isBlank()
                    ? "<p style='color: #4b5563; font-size: 14px; margin: 12px 0 0 0; line-height: 1.5;'>" + todo.getDescription() + "</p>"
                    : "";

            String html = "<!DOCTYPE html>"
                    + "<html><head><meta charset='UTF-8'>"
                    + "<style>"
                    + "body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f6f8fa; margin: 0; padding: 20px; }"
                    + ".container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; }"
                    + ".header { text-align: center; margin-bottom: 24px; }"
                    + ".logo { font-size: 24px; font-weight: bold; color: #4f46e5; }"
                    + ".title { font-size: 20px; font-weight: 600; color: #111827; margin: 12px 0 6px 0; }"
                    + ".subtitle { color: #6b7280; font-size: 14px; margin: 0; }"
                    + ".task-box { background: #f5f3ff; border: 1px solid #c7d2fe; border-left: 5px solid #4f46e5; border-radius: 8px; padding: 20px; margin: 24px 0; }"
                    + ".task-title { font-size: 18px; font-weight: 700; color: #1e1b4b; margin: 0 0 8px 0; }"
                    + ".badge-row { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }"
                    + ".badge { display: inline-block; background: #ffffff; border: 1px solid #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }"
                    + ".footer { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; }"
                    + "</style></head><body>"
                    + "<div class='container'>"
                    + "<div class='header'>"
                    + "<div class='logo'>✓ Todo App</div>"
                    + "<h2 class='title'>Task Due Reminder</h2>"
                    + "<p class='subtitle'>Don't forget to complete your scheduled task!</p>"
                    + "</div>"
                    + "<div class='task-box'>"
                    + "<h3 class='task-title'>📋 " + todo.getTitle() + "</h3>"
                    + descStr
                    + "<div class='badge-row'>"
                    + "<span class='badge'>📆 Due Date: " + dueDateStr + "</span>"
                    + "<span class='badge'>⏰ Due Time: " + dueTimeStr + "</span>"
                    + "</div>"
                    + "</div>"
                    + "<p style='color: #6b7280; font-size: 13px; text-align: center; margin: 16px 0;'>Log in to your Todo App to mark this task complete or reschedule.</p>"
                    + "<div class='footer'>© Todo App • Plan • Do • Achieve</div>"
                    + "</div></body></html>";

            helper.setText(html, true);
            mailSender.send(mimeMessage);
            System.out.println("✅ [TODO-APP REMINDER] Reminder email sent to " + toEmail + " for task '" + todo.getTitle() + "'");
        } catch (Exception e) {
            System.err.println("❌ Failed to deliver task reminder email to " + toEmail + ": " + e.getMessage());
        }
    }
}
