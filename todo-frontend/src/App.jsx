import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import AuthModal from "./components/AuthModal";
import CalendarView from "./components/CalendarView";
import NotificationBell from "./components/NotificationBell";
import ReminderAlert from "./components/ReminderAlert";
import { playReminderChime } from "./utils/reminderSound";

const API_URL = "http://localhost:4040/api/todos";

function App() {
  const [todos, setTodos] = useState([]);

  // Active view: "tasks" or "calendar"
  const [activeView, setActiveView] = useState("tasks");

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  // Reminder form states
  const [enableReminder, setEnableReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [sendReminderEmail, setSendReminderEmail] = useState(false);

  // Active triggered reminder modal
  const [activeReminder, setActiveReminder] = useState(null);

  const [editingId, setEditingId] = useState(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* =========================================================
     USER & AUTHENTICATION (TAB-ISOLATED SESSION STORAGE)
     Uses sessionStorage first to prevent cross-tab account mixup.
  ========================================================= */

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      // 1. Check tab-isolated session (priority)
      const sessionUser = sessionStorage.getItem("todo_user");
      if (sessionUser) {
        return JSON.parse(sessionUser);
      }
      // 2. Global fallback from last login
      const localUser = localStorage.getItem("todo_user");
      if (localUser) {
        sessionStorage.setItem("todo_user", localUser);
        return JSON.parse(localUser);
      }
      return null;
    } catch {
      return null;
    }
  });

  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);
    sessionStorage.setItem("todo_user", JSON.stringify(userData));
    localStorage.setItem("todo_user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    if (window.confirm(`Are you sure you want to sign out of ${currentUser?.email || "this account"}?`)) {
      setCurrentUser(null);
      sessionStorage.removeItem("todo_user");
      localStorage.removeItem("todo_user");
      setTodos([]);
      clearForm();
    }
  };

  /* =========================
     DARK / LIGHT MODE
  ========================= */

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("todo-theme") === "dark";
  });

  const fileInputRef = useRef(null);

  /* =========================
     DATE / TIME REFS
  ========================= */

  const dateInputRef = useRef(null);
  const timeInputRef = useRef(null);

  /* =========================
     THEME
  ========================= */

  useEffect(() => {
    localStorage.setItem("todo-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode((previousMode) => !previousMode);
  };

  /* =========================
     OPEN DATE / TIME PICKER
  ========================= */

  const openDatePicker = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === "function") {
        try {
          dateInputRef.current.showPicker();
        } catch {
          dateInputRef.current.focus();
        }
      } else {
        dateInputRef.current.focus();
      }
    }
  };

  const openTimePicker = () => {
    if (timeInputRef.current) {
      if (typeof timeInputRef.current.showPicker === "function") {
        try {
          timeInputRef.current.showPicker();
        } catch {
          timeInputRef.current.focus();
        }
      } else {
        timeInputRef.current.focus();
      }
    }
  };

  /* =========================
     GET TODOS
  ========================= */

  const [connectionError, setConnectionError] = useState(false);

  const fetchTodos = useCallback(async () => {
    if (!currentUser?.id) {
      setTodos([]);
      return;
    }

    try {
      setLoading(true);
      setConnectionError(false);

      const response = await fetch(`${API_URL}?userId=${currentUser.id}`, {
        headers: {
          "X-User-Id": String(currentUser.id),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch todos");
      }

      const data = await response.json();
      setTodos(data);
    } catch (error) {
      console.error("Backend connection error:", error);
      setConnectionError(true);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  /* =========================================================
     REAL-TIME INDUSTRY-LEVEL REMINDER SCHEDULER
     - Evaluates every second with zero drift
     - Triggers live alarm without needing page reload
     - Remembers dismissed reminders in localStorage by user ID
  ========================================================= */

  const getAcknowledgedReminders = useCallback(() => {
    if (!currentUser?.id) return new Set();
    try {
      const raw = localStorage.getItem(`todo_acked_reminders_${currentUser.id}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  }, [currentUser]);

  const recordAcknowledgedReminder = useCallback((id) => {
    if (!currentUser?.id) return;
    try {
      const current = getAcknowledgedReminders();
      current.add(id);
      localStorage.setItem(
        `todo_acked_reminders_${currentUser.id}`,
        JSON.stringify([...current])
      );
    } catch (e) {
      console.warn("Could not save acknowledged reminder:", e);
    }
  }, [currentUser, getAcknowledgedReminders]);

  useEffect(() => {
    if (!currentUser?.id || todos.length === 0) return;

    const checkReminders = () => {
      const now = new Date();
      const acked = getAcknowledgedReminders();

      for (const todo of todos) {
        if (todo.completed) continue;
        if (!todo.reminderDateTime) continue; // ONLY trigger if explicit reminderDateTime is set!
        if (acked.has(todo.id)) continue;
        if (activeReminder?.id === todo.id) continue;

        const rDate = new Date(todo.reminderDateTime);
        if (isNaN(rDate.getTime())) continue;

        const diffMs = now.getTime() - rDate.getTime();

        // Trigger condition:
        // 1. Current time has reached or passed reminder time (diffMs >= 0)
        // 2. Reminder is fresh (due within the last 5 minutes)
        // This prevents old reminders from months ago from screaming alarms on page reload!
        if (diffMs >= 0 && diffMs < 5 * 60 * 1000) {
          setActiveReminder(todo);
          playReminderChime();
          recordAcknowledgedReminder(todo.id);

          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(`⏰ Reminder: ${todo.title}`, {
                body: todo.description || (todo.dueDate ? `Due: ${todo.dueDate} ${todo.dueTime || ""}` : "Your scheduled reminder is due!"),
                icon: "/favicon.ico",
                tag: `reminder-${todo.id}`,
                requireInteraction: true,
              });
            } catch (err) {
              console.warn("Desktop notification error:", err);
            }
          }
          break; // Show one modal at a time
        }
      }
    };

    // 1-second interval for real-time second-accurate alarm trigger
    const interval = setInterval(checkReminders, 1000);
    checkReminders();

    return () => clearInterval(interval);
  }, [todos, currentUser?.id, activeReminder, getAcknowledgedReminders, recordAcknowledgedReminder]);

  /* =========================
     SNOOZE & DISMISS
  ========================= */

  const handleSnooze = async (id, minutes = 10) => {
    try {
      const response = await fetch(
        `${API_URL}/${id}/snooze?minutes=${minutes}&userId=${currentUser?.id || ""}`,
        {
          method: "PATCH",
          headers: currentUser?.id ? { "X-User-Id": String(currentUser.id) } : {},
        }
      );
      if (response.ok) {
        const updated = await response.json();
        // Remove from acknowledged set so it rings again when snooze time arrives
        const acked = getAcknowledgedReminders();
        acked.delete(id);
        localStorage.setItem(
          `todo_acked_reminders_${currentUser?.id}`,
          JSON.stringify([...acked])
        );

        setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
    } catch (err) {
      console.error("Failed to snooze reminder:", err);
    } finally {
      setActiveReminder(null);
    }
  };

  const handleDismissReminder = (id) => {
    recordAcknowledgedReminder(id);
    setActiveReminder(null);
  };

  /* =========================
     IMAGE SELECT
  ========================= */

  const handleImageChange = (event) => {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB.");
      event.target.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image.");
      event.target.value = "";
      return;
    }

    setImage(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  };

  /* =========================
     PRESET REMINDER CALCULATOR
  ========================= */

  const applyReminderPreset = (preset) => {
    const baseDate = dueDate || new Date().toISOString().split("T")[0];
    const baseTime = dueTime || "12:00";
    const target = new Date(`${baseDate}T${baseTime}:00`);

    if (isNaN(target.getTime())) return;

    let offsetMs = 0;
    if (preset === "10_min") offsetMs = 10 * 60 * 1000;
    else if (preset === "30_min") offsetMs = 30 * 60 * 1000;
    else if (preset === "1_hour") offsetMs = 60 * 60 * 1000;
    else if (preset === "1_day") offsetMs = 24 * 60 * 60 * 1000;

    const computed = new Date(target.getTime() - offsetMs);
    const y = computed.getFullYear();
    const m = String(computed.getMonth() + 1).padStart(2, "0");
    const d = String(computed.getDate()).padStart(2, "0");
    const hh = String(computed.getHours()).padStart(2, "0");
    const mm = String(computed.getMinutes()).padStart(2, "0");

    setReminderDate(`${y}-${m}-${d}`);
    setReminderTime(`${hh}:${mm}`);
  };

  const isReminderInPast = useMemo(() => {
    if (!enableReminder || !reminderDate || !reminderTime) return false;
    const rDate = new Date(`${reminderDate}T${reminderTime}:00`);
    return rDate < new Date();
  }, [enableReminder, reminderDate, reminderTime]);

  const reminderPreviewText = useMemo(() => {
    if (!enableReminder || !reminderDate || !reminderTime) return "";
    const rDate = new Date(`${reminderDate}T${reminderTime}:00`);
    if (isNaN(rDate.getTime())) return "";

    const dateStr = rDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const timeStr = rDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const diffMinutes = Math.round((rDate.getTime() - Date.now()) / (1000 * 60));
    let relative = "";
    if (diffMinutes > 0) {
      if (diffMinutes < 60) relative = ` (in ${diffMinutes}m)`;
      else if (diffMinutes < 1440) relative = ` (in ${Math.round(diffMinutes / 60)}h)`;
      else relative = ` (in ${Math.round(diffMinutes / 1440)}d)`;
    }

    return `${dateStr} at ${timeStr}${relative}`;
  }, [enableReminder, reminderDate, reminderTime]);

  /* =========================
     CLEAR FORM
  ========================= */

  const clearForm = () => {
    setTitle("");
    setDescription("");
    setDueDate("");
    setDueTime("");
    setImage(null);
    setImagePreview("");
    setEditingId(null);
    setEnableReminder(false);
    setReminderDate("");
    setReminderTime("");
    setSendReminderEmail(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /* =========================
     CREATE / UPDATE
  ========================= */

  const saveTodo = async () => {
    if (!title.trim()) {
      alert("Please enter a title.");
      return;
    }

    try {
      setSaving(true);

      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("completed", "false");

      if (dueDate) {
        formData.append("dueDate", dueDate);
      }

      if (dueTime) {
        formData.append("dueTime", dueTime);
      }

      // Explicit reminder datetime
      if (enableReminder && reminderDate && reminderTime) {
        formData.append("reminderDateTime", `${reminderDate}T${reminderTime}:00`);
        formData.append("reminderEmail", String(sendReminderEmail));
      } else {
        formData.append("reminderDateTime", "");
        formData.append("reminderEmail", "false");
      }

      if (image) {
        formData.append("image", image);
      }

      if (currentUser?.id) {
        formData.append("userId", String(currentUser.id));
      }

      const url = editingId !== null ? `${API_URL}/${editingId}` : API_URL;
      const method = editingId !== null ? "PUT" : "POST";

      /* Keep current completed status while editing */
      if (editingId !== null) {
        const existingTodo = todos.find((todo) => todo.id === editingId);
        formData.set("completed", String(existingTodo?.completed || false));
      }

      const response = await fetch(url, {
        method,
        headers: currentUser?.id ? { "X-User-Id": String(currentUser.id) } : {},
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const savedTodo = await response.json();

      if (editingId !== null) {
        setTodos((previousTodos) =>
          previousTodos.map((todo) => (todo.id === savedTodo.id ? savedTodo : todo))
        );
      } else {
        setTodos((previousTodos) => [...previousTodos, savedTodo]);
      }

      clearForm();
    } catch (error) {
      console.error(error);
      alert("Failed to save todo.");
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     EDIT
  ========================= */

  const editTodo = (todo) => {
    setEditingId(todo.id);
    setTitle(todo.title || "");
    setDescription(todo.description || "");
    setDueDate(todo.dueDate || "");
    setDueTime(todo.dueTime ? todo.dueTime.substring(0, 5) : "");
    setImage(null);

    if (todo.reminderDateTime) {
      setEnableReminder(true);
      const dtParts = todo.reminderDateTime.split("T");
      setReminderDate(dtParts[0] || "");
      setReminderTime(dtParts[1] ? dtParts[1].substring(0, 5) : "");
    } else {
      setEnableReminder(false);
      setReminderDate("");
      setReminderTime("");
    }
    setSendReminderEmail(Boolean(todo.reminderEmail));

    if (todo.imageData && todo.imageType) {
      setImagePreview(`data:${todo.imageType};base64,${todo.imageData}`);
    } else {
      setImagePreview("");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setActiveView("tasks");
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* =========================
     ADD TASK FOR DATE (CALENDAR)
  ========================= */

  const handleAddTaskForDate = (dateStr) => {
    clearForm();
    setDueDate(dateStr);
    setActiveView("tasks");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* =========================
     TOGGLE COMPLETE
  ========================= */

  const toggleTodo = async (todo) => {
    try {
      const formData = new FormData();
      formData.append("title", todo.title);
      formData.append("description", todo.description || "");
      formData.append("completed", String(!todo.completed));

      if (todo.dueDate) {
        formData.append("dueDate", todo.dueDate);
      }

      if (todo.dueTime) {
        formData.append("dueTime", todo.dueTime.substring(0, 5));
      }

      if (todo.reminderDateTime) {
        formData.append("reminderDateTime", todo.reminderDateTime);
      }
      formData.append("reminderEmail", String(Boolean(todo.reminderEmail)));

      if (currentUser?.id) {
        formData.append("userId", String(currentUser.id));
      }

      const response = await fetch(`${API_URL}/${todo.id}`, {
        method: "PUT",
        headers: currentUser?.id ? { "X-User-Id": String(currentUser.id) } : {},
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to update todo");
      }

      const updatedTodo = await response.json();

      setTodos((previousTodos) =>
        previousTodos.map((item) => (item.id === updatedTodo.id ? updatedTodo : item))
      );
    } catch (error) {
      console.error(error);
      alert("Failed to update todo.");
    }
  };

  /* =========================
     DELETE
  ========================= */

  const deleteTodo = async (id) => {
    const confirmed = window.confirm("Are you sure you want to delete this todo?");
    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_URL}/${id}?userId=${currentUser?.id || ""}`,
        {
          method: "DELETE",
          headers: currentUser?.id ? { "X-User-Id": String(currentUser.id) } : {},
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete todo");
      }

      setTodos((previousTodos) => previousTodos.filter((todo) => todo.id !== id));
    } catch (error) {
      console.error(error);
      alert("Failed to delete todo.");
    }
  };

  /* =========================
     FILTER + SEARCH
  ========================= */

  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      const searchText = `${todo.title} ${todo.description || ""}`.toLowerCase();
      const matchesSearch = searchText.includes(search.toLowerCase());

      let matchesFilter = true;
      if (filter === "pending") matchesFilter = !todo.completed;
      if (filter === "completed") matchesFilter = todo.completed;

      return matchesSearch && matchesFilter;
    });
  }, [todos, search, filter]);

  /* =========================
     COUNTS
  ========================= */

  const completedCount = todos.filter((todo) => todo.completed).length;
  const pendingCount = todos.length - completedCount;
  const scheduledCount = todos.filter((todo) => todo.dueDate).length;

  /* =========================
     IMAGE URL
  ========================= */

  const getImageUrl = (todo) => {
    if (todo.imageData && todo.imageType) {
      return `data:${todo.imageType};base64,${todo.imageData}`;
    }
    return null;
  };

  /* =========================
     DATE FORMAT
  ========================= */

  const formatDate = (date) => {
    if (!date) return "";
    const parts = date.split("-");
    if (parts.length !== 3) return date;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  /* Unauthenticated View */
  if (!currentUser) {
    return (
      <div className={`app auth-wrapper ${darkMode ? "dark-mode" : "light-mode"}`}>
        <header className="auth-standalone-header">
          <div className="brand-standalone">
            <div className="brand-icon">✓</div>
            <div>
              <strong className="brand-title">Todo App</strong>
              <span className="brand-tagline">Plan • Do • Achieve</span>
            </div>
          </div>
          <button
            className="icon-button"
            onClick={toggleTheme}
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
        </header>

        <main className="auth-main-area">
          <AuthModal onLoginSuccess={handleLoginSuccess} />
        </main>
      </div>
    );
  }

  return (
    <div className={`app ${darkMode ? "dark-mode" : "light-mode"}`}>
      {/* =========================
          SIDEBAR
      ========================= */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">✓</div>
          <div>
            <h1>Todo App</h1>
            <span>Plan • Do • Achieve</span>
          </div>
        </div>

        <nav className="navigation">
          <button
            className={
              activeView === "tasks" && filter === "all"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => {
              setActiveView("tasks");
              setFilter("all");
            }}
          >
            <span>⌂</span>
            <span>Home</span>
          </button>

          <button
            className={
              activeView === "calendar"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => setActiveView("calendar")}
          >
            <span>📅</span>
            <span>Calendar</span>
            <b>{scheduledCount}</b>
          </button>

          <button
            className={
              activeView === "tasks" && filter === "all"
                ? "nav-item"
                : "nav-item"
            }
            onClick={() => {
              setActiveView("tasks");
              setFilter("all");
            }}
          >
            <span>☷</span>
            <span>All Todos</span>
            <b>{todos.length}</b>
          </button>

          <button
            className={
              activeView === "tasks" && filter === "pending"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => {
              setActiveView("tasks");
              setFilter("pending");
            }}
          >
            <span>◷</span>
            <span>Pending</span>
            <b>{pendingCount}</b>
          </button>

          <button
            className={
              activeView === "tasks" && filter === "completed"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => {
              setActiveView("tasks");
              setFilter("completed");
            }}
          >
            <span>✓</span>
            <span>Completed</span>
            <b>{completedCount}</b>
          </button>
        </nav>

        <div className="sidebar-message">
          <div className="leaf">🌱</div>
          <p>
            Small steps
            <br />
            every day lead
            <br />
            to big results!
          </p>
        </div>
      </aside>

      {/* =========================
          MAIN CONTENT
      ========================= */}
      <main className="main">
        {/* HEADER */}
        <header className="header">
          <div className="mobile-brand">
            <div className="brand-icon">✓</div>
            <strong>Todo App</strong>
          </div>

          <div className="header-actions">
            {/* NOTIFICATION & REMINDER BELL */}
            <NotificationBell
              todos={todos}
              onCompleteTodo={toggleTodo}
              onSnoozeTodo={handleSnooze}
              onSelectTodo={editTodo}
            />

            {/* DAY / NIGHT BUTTON */}
            <button
              className="icon-button"
              onClick={toggleTheme}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? "☀️" : "🌙"}
            </button>

            {/* LOGGED IN USER PILL */}
            <div className="user" title={`Logged in as ${currentUser?.email || "User"}`}>
              <div className="avatar">
                {currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : "👤"}
              </div>

              <div className="user-details">
                <span className="user-name">
                  {currentUser?.email ? currentUser.email.split("@")[0] : "User"}
                </span>
                <span className="user-email-small">
                  {currentUser?.email || ""}
                </span>
              </div>

              <button
                className="logout-button"
                onClick={handleLogout}
                title="Sign Out"
                aria-label="Sign Out"
              >
                Sign Out ↪
              </button>
            </div>
          </div>
        </header>

        {connectionError && (
          <div className="connection-alert-banner">
            <span>
              ⚠️ Could not connect to Spring Boot backend at <code>http://localhost:4040</code>
            </span>
            <button type="button" onClick={fetchTodos} className="retry-conn-btn">
              ↻ Retry
            </button>
          </div>
        )}

        {/* VIEW CONDITIONAL: CALENDAR VIEW VS TASKS VIEW */}
        {activeView === "calendar" ? (
          <CalendarView
            todos={todos}
            onToggleTodo={toggleTodo}
            onEditTodo={editTodo}
            onDeleteTodo={deleteTodo}
            onAddTaskForDate={handleAddTaskForDate}
            getImageUrl={getImageUrl}
          />
        ) : (
          <>
            {/* =========================
                FORM CARD
            ========================= */}
            <section className="add-card">
              <div className="form-header">
                <div className="form-icon">
                  {editingId !== null ? "✎" : "+"}
                </div>
                <div>
                  <h2>{editingId !== null ? "Edit Todo" : "Add New Todo"}</h2>
                  <p>Stay organized, meet your deadlines, and achieve more!</p>
                </div>
              </div>

              <div className="form-grid">
                {/* TITLE */}
                <div className="field">
                  <label>
                    Title <span>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter todo title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>

                {/* DESCRIPTION */}
                <div className="field">
                  <label>Description</label>
                  <textarea
                    placeholder="Enter description (optional)"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>

                {/* DATE */}
                <div className="field">
                  <label>Due Date</label>
                  <div className="input-icon" onClick={openDatePicker}>
                    <span>📆</span>
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                      onClick={(event) => {
                        event.stopPropagation();
                        openDatePicker();
                      }}
                    />
                  </div>
                </div>

                {/* TIME */}
                <div className="field">
                  <label>Due Time</label>
                  <div className="input-icon" onClick={openTimePicker}>
                    <span>⌛</span>
                    <input
                      ref={timeInputRef}
                      type="time"
                      value={dueTime}
                      onChange={(event) => setDueTime(event.target.value)}
                      onClick={(event) => {
                        event.stopPropagation();
                        openTimePicker();
                      }}
                    />
                  </div>
                </div>

                {/* INDUSTRY-LEVEL TASK REMINDER CONTROLS */}
                <div className="field reminder-field-wrapper">
                  <div className="reminder-header-row">
                    <label className="checkbox-toggle-label">
                      <input
                        type="checkbox"
                        checked={enableReminder}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEnableReminder(checked);
                          if (checked && !reminderDate) {
                            const today = new Date().toISOString().split("T")[0];
                            setReminderDate(dueDate || today);
                            if (dueTime) {
                              setReminderTime(dueTime);
                            } else {
                              const in15m = new Date(Date.now() + 15 * 60 * 1000);
                              const hh = String(in15m.getHours()).padStart(2, "0");
                              const mm = String(in15m.getMinutes()).padStart(2, "0");
                              setReminderTime(`${hh}:${mm}`);
                            }
                          }
                        }}
                      />
                      <span>⏰ Set Task Reminder</span>
                    </label>

                    {enableReminder && (
                      <label className="checkbox-toggle-label email-sub-label">
                        <input
                          type="checkbox"
                          checked={sendReminderEmail}
                          onChange={(e) => setSendReminderEmail(e.target.checked)}
                        />
                        <span>✉ Email Alert</span>
                      </label>
                    )}
                  </div>

                  {enableReminder && (
                    <div className="reminder-configs-box">
                      {/* PRESET CHIPS */}
                      <div className="reminder-presets-row">
                        <span className="presets-title">Quick Presets:</span>
                        <button
                          type="button"
                          className="reminder-preset-chip"
                          onClick={() => applyReminderPreset("at_due")}
                          title="Trigger at task due time"
                        >
                          At Due Time
                        </button>
                        <button
                          type="button"
                          className="reminder-preset-chip"
                          onClick={() => applyReminderPreset("10_min")}
                          title="Trigger 10 minutes before due time"
                        >
                          10m Before
                        </button>
                        <button
                          type="button"
                          className="reminder-preset-chip"
                          onClick={() => applyReminderPreset("30_min")}
                          title="Trigger 30 minutes before due time"
                        >
                          30m Before
                        </button>
                        <button
                          type="button"
                          className="reminder-preset-chip"
                          onClick={() => applyReminderPreset("1_hour")}
                          title="Trigger 1 hour before due time"
                        >
                          1h Before
                        </button>
                        <button
                          type="button"
                          className="reminder-preset-chip"
                          onClick={() => applyReminderPreset("1_day")}
                          title="Trigger 1 day before due time"
                        >
                          1 Day Before
                        </button>
                      </div>

                      {/* EXPLICIT DATE & TIME INPUTS */}
                      <div className="reminder-datetime-inputs">
                        <div className="reminder-input-group">
                          <label>Reminder Date:</label>
                          <input
                            type="date"
                            value={reminderDate}
                            onChange={(e) => setReminderDate(e.target.value)}
                          />
                        </div>

                        <div className="reminder-input-group">
                          <label>Reminder Time:</label>
                          <input
                            type="time"
                            value={reminderTime}
                            onChange={(e) => setReminderTime(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* LIVE FEEDBACK PREVIEW */}
                      {reminderDate && reminderTime && (
                        <div
                          className={`reminder-preview-banner ${
                            isReminderInPast ? "past-warning" : "active-schedule"
                          }`}
                        >
                          {isReminderInPast ? (
                            <span>
                              ⚠️ Selected reminder time is in the past! Please choose a future time.
                            </span>
                          ) : (
                            <span>
                              🔔 Alarm scheduled for: <strong>{reminderPreviewText}</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* IMAGE */}
                <div className="field image-field">
                  <label>Image</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    onChange={handleImageChange}
                  />
                  <small>JPG, PNG, GIF, WEBP • Max 5MB</small>

                  {imagePreview && (
                    <div className="preview-wrapper">
                      <img src={imagePreview} alt="Preview" />
                      <button
                        type="button"
                        onClick={() => {
                          setImage(null);
                          setImagePreview("");
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* FORM BUTTONS */}
              <div className="form-actions">
                <button
                  className="add-button"
                  onClick={saveTodo}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId !== null
                    ? "✓ Update Todo"
                    : "+ Add Todo"}
                </button>

                <button className="clear-button" onClick={clearForm}>
                  ↻ Clear
                </button>
              </div>
            </section>

            {/* =========================
                SEARCH + FILTER
            ========================= */}
            <section className="toolbar">
              <div className="search-box">
                <span>⌕</span>
                <input
                  type="text"
                  placeholder="Search todos..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div className="filters">
                <button
                  className={filter === "all" ? "filter active" : "filter"}
                  onClick={() => setFilter("all")}
                >
                  ✦ All
                  <span>{todos.length}</span>
                </button>

                <button
                  className={filter === "pending" ? "filter pending active" : "filter pending"}
                  onClick={() => setFilter("pending")}
                >
                  ◷ Pending
                  <span>{pendingCount}</span>
                </button>

                <button
                  className={filter === "completed" ? "filter completed active" : "filter completed"}
                  onClick={() => setFilter("completed")}
                >
                  ✓ Completed
                  <span>{completedCount}</span>
                </button>
              </div>
            </section>

            {/* =========================
                TODOS LIST
            ========================= */}
            {loading ? (
              <div className="empty">
                <div className="loader"></div>
                <p>Loading todos...</p>
              </div>
            ) : filteredTodos.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">📝</div>
                <h3>No todos found</h3>
                <p>Add a new task to get started.</p>
              </div>
            ) : (
              <div className="todo-grid">
                {filteredTodos.map((todo) => {
                  const todoImage = getImageUrl(todo);

                  return (
                    <article
                      className={
                        todo.completed ? "todo-card completed-card" : "todo-card"
                      }
                      key={todo.id}
                    >
                      {/* IMAGE */}
                      {todoImage ? (
                        <div className="todo-image">
                          <img src={todoImage} alt={todo.title} />
                          <span className="image-badge">▧</span>
                        </div>
                      ) : (
                        <div className="todo-image no-image">📝</div>
                      )}

                      {/* CONTENT */}
                      <div className="todo-content">
                        <h3>{todo.title}</h3>

                        {todo.description && (
                          <p className="description">{todo.description}</p>
                        )}

                        <div className="todo-meta">
                          {todo.dueDate && (
                            <span>▣ {formatDate(todo.dueDate)}</span>
                          )}

                          {todo.dueTime && (
                            <span>◷ {todo.dueTime.substring(0, 5)}</span>
                          )}

                          {todo.reminderDateTime && (
                            <span
                              className="reminder-tag"
                              title={`Reminder active for ${todo.reminderDateTime.replace("T", " ")}`}
                            >
                              🔔 Reminder
                            </span>
                          )}
                        </div>

                        <div className="todo-bottom">
                          <span
                            className={
                              todo.completed ? "status completed" : "status pending"
                            }
                          >
                            {todo.completed ? "✓ Completed" : "◷ Pending"}
                          </span>

                          <div className="actions">
                            {/* COMPLETE */}
                            <button
                              className="complete-btn"
                              title={todo.completed ? "Mark Pending" : "Complete"}
                              onClick={() => toggleTodo(todo)}
                            >
                              {todo.completed ? "↶" : "✓"}
                            </button>

                            {/* EDIT */}
                            <button
                              className="edit-btn"
                              title="Edit"
                              onClick={() => editTodo(todo)}
                            >
                              ✎
                            </button>

                            {/* DELETE */}
                            <button
                              className="delete-btn"
                              title="Delete"
                              onClick={() => deleteTodo(todo.id)}
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* FOOTER */}
            <footer className="footer">
              Showing <strong>{filteredTodos.length}</strong> of{" "}
              <strong>{todos.length}</strong> todos
            </footer>
          </>
        )}
      </main>

      {/* IN-APP REMINDER ALERT MODAL */}
      <ReminderAlert
        activeReminder={activeReminder}
        onDismiss={handleDismissReminder}
        onSnooze={handleSnooze}
        onComplete={async (todo) => {
          await toggleTodo(todo);
          setActiveReminder(null);
        }}
      />
    </div>
  );
}

export default App;