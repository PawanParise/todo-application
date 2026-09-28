package com.todo.todobackend.dto;

public class AuthResponse {
    private boolean success;
    private String message;
    private Object data;

    public AuthResponse() {}

    public AuthResponse(boolean success, String message) {
        this.success = success;
        this.message = message;
    }

    public AuthResponse(boolean success, String message, Object data) {
        this.success = success;
        this.message = message;
        this.data = data;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Object getData() {
        return data;
    }

    public void setData(Object data) {
        this.data = data;
    }

    public Long getUserId() {
        if (data instanceof java.util.Map) {
            Object idObj = ((java.util.Map<?, ?>) data).get("id");
            if (idObj instanceof Number) {
                return ((Number) idObj).longValue();
            }
            Object userIdObj = ((java.util.Map<?, ?>) data).get("userId");
            if (userIdObj instanceof Number) {
                return ((Number) userIdObj).longValue();
            }
        }
        return null;
    }
}
