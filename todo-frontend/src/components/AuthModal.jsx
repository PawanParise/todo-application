import { useState, useRef, useEffect } from "react";

const API_BASE = "http://localhost:4040/api/auth";

export default function AuthModal({ onLoginSuccess, isModal = false, onClose }) {
  // Mode: "login", "register", "forgot"
  const [mode, setMode] = useState("login");

  // Forgot password steps: 1 = enter email, 2 = enter OTP & new password, 3 = success
  const [forgotStep, setForgotStep] = useState(1);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // OTP segmented inputs (6 digits)
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const otpInputRefs = useRef([]);

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Loading & Feedback states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Resend OTP countdown
  const [resendTimer, setResendTimer] = useState(0);

  // Countdown effect for resending OTP
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Clear messages when switching mode or step
  const switchMode = (newMode) => {
    setMode(newMode);
    setErrorMsg("");
    setSuccessMsg("");
    if (newMode !== "forgot") {
      setForgotStep(1);
    }
  };

  // OTP Digits handler
  const handleOtpChange = (index, value) => {
    // Only accept numeric characters
    const cleanVal = value.replace(/\D/g, "");
    if (!cleanVal && value !== "") return;

    const newDigits = [...otpDigits];

    if (cleanVal.length > 1) {
      // Pasted string
      const pasted = cleanVal.slice(0, 6).split("");
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || "";
      }
      setOtpDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);

    // Auto move to next input
    if (cleanVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    const cleanPaste = pasteData.replace(/\D/g, "").slice(0, 6);
    if (!cleanPaste) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = cleanPaste[i] || "";
    }
    setOtpDigits(newDigits);
    const focusIndex = Math.min(cleanPaste.length, 5);
    otpInputRefs.current[focusIndex]?.focus();
  };

  const getFullOtp = () => otpDigits.join("");

  /* =======================================
     AUTH ACTIONS
  ======================================= */

  // 1. LOGIN
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email.trim() || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Invalid credentials. Please try again.");
      }

      setSuccessMsg("Login successful! Welcome back.");
      if (onLoginSuccess) {
        setTimeout(() => {
          onLoginSuccess(data.data);
        }, 500);
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to log in. Please check backend connection.");
    } finally {
      setLoading(false);
    }
  };

  // 2. REGISTER
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email.trim() || !password) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Registration failed.");
      }

      setSuccessMsg("Account created successfully! You can now sign in.");
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        switchMode("login");
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  // 3. SEND OTP (Forgot Password Step 1)
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email.trim()) {
      setErrorMsg("Please enter your registered email address.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to send OTP.");
      }

      setSuccessMsg(data.message || "OTP sent successfully to your email!");
      setForgotStep(2);
      setResendTimer(60);
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 200);
    } catch (err) {
      const msg = err.message || "";
      if (msg.toLowerCase().includes("authentication failed") || msg.toLowerCase().includes("badcredentials")) {
        setErrorMsg("Gmail SMTP Authentication failed: Google rejected the App Password for pavanparise77@gmail.com. Please generate a new 16-character App Password at myaccount.google.com/apppasswords and update application.properties.");
      } else {
        setErrorMsg(msg || "Unable to send OTP. Please check your email and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 4. RESET PASSWORD (Forgot Password Step 2)
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const fullOtp = getFullOtp();

    if (fullOtp.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit OTP code.");
      return;
    }

    if (!password) {
      setErrorMsg("Please enter a new password.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          otp: fullOtp,
          newPassword: password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to reset password.");
      }

      setSuccessMsg(data.message || "Password reset successfully!");
      setForgotStep(3);
    } catch (err) {
      setErrorMsg(err.message || "Failed to reset password. Please check the OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={isModal ? "auth-modal-overlay" : "auth-container-standalone"}>
      <div className="auth-card">
        {isModal && onClose && (
          <button className="auth-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        )}

        {/* Brand Header */}
        <div className="auth-header">
          <div className="auth-brand-badge">✓</div>
          <h2>Todo App</h2>
          <p className="auth-subtitle">
            {mode === "login" && "Welcome back! Please sign in to continue"}
            {mode === "register" && "Create your account to start managing tasks"}
            {mode === "forgot" && "Account Recovery via Email OTP"}
          </p>
        </div>

        {/* Mode Selector Tabs (only when not in forgot password flow) */}
        {mode !== "forgot" && (
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${mode === "login" ? "active" : ""}`}
              onClick={() => switchMode("login")}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === "register" ? "active" : ""}`}
              onClick={() => switchMode("register")}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Notifications / Alerts */}
        {errorMsg && (
          <div className="auth-alert error-alert" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-alert success-alert" role="alert">
            <span className="alert-icon">✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* =========================================================
            MODE 1: SIGN IN FORM
        ========================================================= */}
        {mode === "login" && (
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="auth-field">
              <label htmlFor="login-email">Email Address</label>
              <div className="auth-input-wrapper">
                <span className="input-prefix-icon">✉️</span>
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-field">
              <div className="field-label-row">
                <label htmlFor="login-password">Password</label>
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={() => switchMode("forgot")}
                >
                  Forgot password?
                </button>
              </div>
              <div className="auth-input-wrapper">
                <span className="input-prefix-icon">🔒</span>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="toggle-pw-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <span className="btn-spinner-content">
                  <span className="btn-spinner"></span> Signing In...
                </span>
              ) : (
                "Sign In →"
              )}
            </button>

            <div className="auth-switch-prompt">
              Don't have an account?{" "}
              <button
                type="button"
                className="link-inline"
                onClick={() => switchMode("register")}
              >
                Sign up
              </button>
            </div>
          </form>
        )}

        {/* =========================================================
            MODE 2: SIGN UP FORM
        ========================================================= */}
        {mode === "register" && (
          <form className="auth-form" onSubmit={handleRegister}>
            <div className="auth-field">
              <label htmlFor="reg-email">Email Address</label>
              <div className="auth-input-wrapper">
                <span className="input-prefix-icon">✉️</span>
                <input
                  id="reg-email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reg-password">Password</label>
              <div className="auth-input-wrapper">
                <span className="input-prefix-icon">🔒</span>
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="toggle-pw-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reg-confirm-password">Confirm Password</label>
              <div className="auth-input-wrapper">
                <span className="input-prefix-icon">🔒</span>
                <input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="toggle-pw-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <span className="btn-spinner-content">
                  <span className="btn-spinner"></span> Creating Account...
                </span>
              ) : (
                "Create Account →"
              )}
            </button>

            <div className="auth-switch-prompt">
              Already have an account?{" "}
              <button
                type="button"
                className="link-inline"
                onClick={() => switchMode("login")}
              >
                Sign in
              </button>
            </div>
          </form>
        )}

        {/* =========================================================
            MODE 3: FORGOT PASSWORD WIZARD (OTP)
        ========================================================= */}
        {mode === "forgot" && (
          <div className="forgot-flow">
            {/* Step indicator */}
            <div className="wizard-steps">
              <div className={`step-dot ${forgotStep >= 1 ? "active" : ""}`}>
                <span>1</span>
                <label>Email</label>
              </div>
              <div className="step-connector"></div>
              <div className={`step-dot ${forgotStep >= 2 ? "active" : ""}`}>
                <span>2</span>
                <label>Verify OTP</label>
              </div>
              <div className="step-connector"></div>
              <div className={`step-dot ${forgotStep === 3 ? "active" : ""}`}>
                <span>3</span>
                <label>Done</label>
              </div>
            </div>

            {/* STEP 1: Enter email to receive OTP */}
            {forgotStep === 1 && (
              <form className="auth-form" onSubmit={handleSendOtp}>
                <div className="flow-explanation">
                  <div className="key-icon">🔑</div>
                  <p>
                    Don't worry! Enter your registered email address and we'll send a
                    <strong> 6-digit OTP code</strong> to reset your password.
                  </p>
                </div>

                <div className="auth-field">
                  <label htmlFor="forgot-email">Registered Email</label>
                  <div className="auth-input-wrapper">
                    <span className="input-prefix-icon">✉️</span>
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading ? (
                    <span className="btn-spinner-content">
                      <span className="btn-spinner"></span> Sending OTP Code...
                    </span>
                  ) : (
                    "Send Verification Code 📩"
                  )}
                </button>

                <div className="auth-switch-prompt">
                  <button
                    type="button"
                    className="link-back"
                    onClick={() => switchMode("login")}
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Enter OTP & New Password */}
            {forgotStep === 2 && (
              <form className="auth-form" onSubmit={handleResetPassword}>
                <div className="otp-banner">
                  <span className="mail-icon">📬</span>
                  <div>
                    <p className="otp-sent-text">
                      We sent a 6-digit code to <strong>{email}</strong>
                    </p>
                    <button
                      type="button"
                      className="change-email-btn"
                      onClick={() => setForgotStep(1)}
                    >
                      Change email
                    </button>
                  </div>
                </div>

                {/* 6-Digit OTP Boxes */}
                <div className="auth-field">
                  <label>Enter 6-Digit OTP</label>
                  <div className="otp-boxes-grid" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        className="otp-digit-input"
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        autoComplete="one-time-code"
                      />
                    ))}
                  </div>
                </div>

                {/* Resend OTP button with timer */}
                <div className="resend-row">
                  {resendTimer > 0 ? (
                    <span className="resend-timer-text">
                      ⏱ Resend code in <strong>{resendTimer}s</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="resend-otp-btn"
                      onClick={() => handleSendOtp(null)}
                      disabled={loading}
                    >
                      ↻ Resend OTP
                    </button>
                  )}
                </div>

                {/* New Password */}
                <div className="auth-field">
                  <label htmlFor="reset-new-password">New Password</label>
                  <div className="auth-input-wrapper">
                    <span className="input-prefix-icon">🔒</span>
                    <input
                      id="reset-new-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="toggle-pw-btn"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="auth-field">
                  <label htmlFor="reset-confirm-password">Confirm New Password</label>
                  <div className="auth-input-wrapper">
                    <span className="input-prefix-icon">🔒</span>
                    <input
                      id="reset-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="toggle-pw-btn"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading ? (
                    <span className="btn-spinner-content">
                      <span className="btn-spinner"></span> Resetting Password...
                    </span>
                  ) : (
                    "Reset Password & Sign In ✓"
                  )}
                </button>

                <div className="auth-switch-prompt">
                  <button
                    type="button"
                    className="link-back"
                    onClick={() => switchMode("login")}
                  >
                    ← Cancel & Back to Sign In
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Success Screen */}
            {forgotStep === 3 && (
              <div className="reset-success-screen">
                <div className="success-badge-large">✓</div>
                <h3>Password Reset Complete!</h3>
                <p>
                  Your password has been successfully updated. You can now log in using your
                  new password.
                </p>

                <button
                  type="button"
                  className="auth-submit-btn"
                  onClick={() => {
                    setPassword("");
                    setConfirmPassword("");
                    setForgotStep(1);
                    switchMode("login");
                  }}
                >
                  Proceed to Sign In →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
