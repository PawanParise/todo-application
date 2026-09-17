package com.todo.todobackend.controller;

import com.todo.todobackend.dto.*;
import com.todo.todobackend.model.User;
import com.todo.todobackend.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(originPatterns = {"http://localhost:*", "http://127.0.0.1:*"}, allowCredentials = "true")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(
            @RequestBody(required = false) LoginRequest jsonRequest,
            @RequestParam(value = "email", required = false) String paramEmail,
            @RequestParam(value = "password", required = false) String paramPassword
    ) {
        try {
            String email = jsonRequest != null && jsonRequest.getEmail() != null ? jsonRequest.getEmail() : paramEmail;
            String password = jsonRequest != null && jsonRequest.getPassword() != null ? jsonRequest.getPassword() : paramPassword;

            if (email == null || email.isBlank()) {
                return ResponseEntity.badRequest().body(new AuthResponse(false, "Email is required"));
            }

            if (password == null || password.length() < 6) {
                return ResponseEntity.badRequest().body(new AuthResponse(false, "Password must be at least 6 characters"));
            }

            User user = userService.registerUser(email, password);
            Map<String, Object> userData = new HashMap<>();
            userData.put("id", user.getId());
            userData.put("email", user.getEmail());

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new AuthResponse(true, "Registration successful", userData));

        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new AuthResponse(false, e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new AuthResponse(false, "Something went wrong during registration"));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestBody(required = false) LoginRequest jsonRequest,
            @RequestParam(value = "email", required = false) String paramEmail,
            @RequestParam(value = "password", required = false) String paramPassword
    ) {
        try {
            String email = jsonRequest != null && jsonRequest.getEmail() != null ? jsonRequest.getEmail() : paramEmail;
            String password = jsonRequest != null && jsonRequest.getPassword() != null ? jsonRequest.getPassword() : paramPassword;

            if (email == null || email.isBlank()) {
                return ResponseEntity.badRequest().body(new AuthResponse(false, "Email is required"));
            }
            if (password == null || password.isBlank()) {
                return ResponseEntity.badRequest().body(new AuthResponse(false, "Password is required"));
            }

            User user = userService.loginUser(email, password);
            Map<String, Object> userData = new HashMap<>();
            userData.put("id", user.getId());
            userData.put("email", user.getEmail());

            return ResponseEntity.ok(new AuthResponse(true, "Login successful", userData));

        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new AuthResponse(false, e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new AuthResponse(false, "Something went wrong during login"));
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(
            @RequestBody(required = false) ForgotPasswordRequest jsonRequest,
            @RequestParam(value = "email", required = false) String paramEmail
    ) {
        try {
            String email = jsonRequest != null && jsonRequest.getEmail() != null ? jsonRequest.getEmail() : paramEmail;

            if (email == null || email.isBlank()) {
                return ResponseEntity.badRequest().body(new AuthResponse(false, "Email is required"));
            }

            userService.sendForgotPasswordOtp(email);
            return ResponseEntity.ok(new AuthResponse(true, "Verification OTP has been sent to your email."));

        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new AuthResponse(false, e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new AuthResponse(false, "Unable to send OTP: " + e.getMessage()));
        }
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(
            @RequestBody(required = false) VerifyOtpRequest jsonRequest,
            @RequestParam(value = "email", required = false) String paramEmail,
            @RequestParam(value = "otp", required = false) String paramOtp
    ) {
        try {
            String email = jsonRequest != null && jsonRequest.getEmail() != null ? jsonRequest.getEmail() : paramEmail;
            String otp = jsonRequest != null && jsonRequest.getOtp() != null ? jsonRequest.getOtp() : paramOtp;

            if (email == null || email.isBlank() || otp == null || otp.isBlank()) {
                return ResponseEntity.badRequest().body(new AuthResponse(false, "Email and OTP are required"));
            }

            userService.verifyOtp(email, otp);
            return ResponseEntity.ok(new AuthResponse(true, "OTP verified successfully."));

        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new AuthResponse(false, e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new AuthResponse(false, "Unable to verify OTP"));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(
            @RequestBody(required = false) ResetPasswordRequest jsonRequest,
            @RequestParam(value = "email", required = false) String paramEmail,
            @RequestParam(value = "otp", required = false) String paramOtp,
            @RequestParam(value = "newPassword", required = false) String paramNewPassword
    ) {
        try {
            String email = jsonRequest != null && jsonRequest.getEmail() != null ? jsonRequest.getEmail() : paramEmail;
            String otp = jsonRequest != null && jsonRequest.getOtp() != null ? jsonRequest.getOtp() : paramOtp;
            String newPassword = jsonRequest != null && jsonRequest.getNewPassword() != null ? jsonRequest.getNewPassword() : paramNewPassword;

            if (email == null || email.isBlank() || otp == null || otp.isBlank() || newPassword == null || newPassword.isBlank()) {
                return ResponseEntity.badRequest().body(new AuthResponse(false, "Email, OTP, and new password are required"));
            }

            userService.resetPasswordWithOtp(email, otp, newPassword);
            return ResponseEntity.ok(new AuthResponse(true, "Password has been successfully reset. You can now log in."));

        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new AuthResponse(false, e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new AuthResponse(false, "Unable to reset password"));
        }
    }
}
