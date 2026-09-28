import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import AuthModal from "./components/AuthModal";
import CalendarView from "./components/CalendarView";
import NotificationBell from "./components/NotificationBell";
import ReminderAlert from "./components/ReminderAlert";
import { playReminderChime } from "./utils/reminderSound";
import {
  LogoIcon,
  HomeIcon,
  CalendarIcon,
  ListTodoIcon,
  ClockIcon,
  CheckCircleIcon,
  CheckIcon,
  SunIcon,
  MoonIcon,
  LogOutIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  SearchIcon,
  UndoIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  MailIcon,
  BellIcon,
  ImageIcon,
  XIcon,
  InboxIcon,
  TrendingUpIcon,
  MenuIcon,
} from "./components/Icons";

const API_URL = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:4040"}/api/todos`;

function App() {
  const [todos, setTodos] = useState([]);

  // Mobile navigation drawer toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        const parsed = JSON.parse(sessionUser);
        if (parsed && parsed.id) {
          return parsed;
        }
      }
      // 2. Global fallback from last login
      const localUser = localStorage.getItem("todo_user");
      if (localUser) {
        const parsed = JSON.parse(localUser);
        if (parsed && parsed.id) {
          sessionStorage.setItem("todo_user", localUser);
          return parsed;
        }
      }
      // Remove any broken/incomplete sessions missing an id
      sessionStorage.removeItem("todo_user");
      localStorage.removeItem("todo_user");
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
     MULTI-BROWSER & MULTI-TAB CLOUD SYNCHRONIZATION
     - Re-fetches instantly whenever user focuses window / switches back
     - Gentle 10-second polling keeps Safari and Chrome mirrored in real-time
  ========================================================= */
  useEffect(() => {
    const handleSync = () => {
      if (document.visibilityState === "visible" && currentUser?.id) {
        fetchTodos();
      }
    };

    window.addEventListener("focus", handleSync);
    document.addEventListener("visibilitychange", handleSync);

    const pollInterval = setInterval(() => {
      if (document.visibilityState === "visible" && currentUser?.id) {
        fetchTodos();
      }
    }, 10000);

    return () => {
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleSync);
      clearInterval(pollInterval);
    };
  }, [fetchTodos, currentUser?.id]);

  /* =========================================================
     SESSION INTEGRITY & AUTO-HEALING
     - Recovers user ID if session has email but lost id
  ========================================================= */
  useEffect(() => {
    const checkAndRepairSession = async () => {
      let emailToLookup = currentUser?.email;
      if (!emailToLookup) {
        try {
          const raw = localStorage.getItem("todo_user") || sessionStorage.getItem("todo_user");
          if (raw) {
            const parsed = JSON.parse(raw);
            emailToLookup = parsed?.email;
          }
        } catch {}
      }

      if (emailToLookup && (!currentUser || !currentUser.id)) {
        try {
          const authBase = API_URL.replace("/api/todos", "/api/auth");
          const res = await fetch(`${authBase}/me?email=${encodeURIComponent(emailToLookup)}`);
          if (res.ok) {
            const json = await res.json();
            const data = json.data || {};
            const userId = data.id || data.userId || json.userId;
            if (userId) {
              const healedUser = { id: userId, email: data.email || emailToLookup };
              setCurrentUser(healedUser);
              sessionStorage.setItem("todo_user", JSON.stringify(healedUser));
              localStorage.setItem("todo_user", JSON.stringify(healedUser));
            }
          }
        } catch (e) {
          console.warn("Could not auto-repair session:", e);
        }
      }
    };

    checkAndRepairSession();
  }, [currentUser]);

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

    if (file.size > 10 * 1024 * 1024) {
      alert("Image size must be less than 10MB.");
      event.target.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image.");
      event.target.value = "";
      return;
    }

    // Client-side optimize/compress to ensure snappy sync across browsers
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 800;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
              });
              setImage(compressedFile);
              setImagePreview(canvas.toDataURL("image/jpeg", 0.85));
            } else {
              setImage(file);
              setImagePreview(URL.createObjectURL(file));
            }
          },
          "image/jpeg",
          0.85
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
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

    if (!currentUser?.id) {
      alert("Session expired. Please sign in again.");
      setCurrentUser(null);
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
            <div className="brand-icon">
              <LogoIcon size={32} />
            </div>
            <div>
              <strong className="brand-title">TaskFlow</strong>
              <span className="brand-tagline">Personal Workspace</span>
            </div>
          </div>
          <button
            className="icon-button"
            onClick={toggleTheme}
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
        </header>

        <main className="auth-main-area">
          <AuthModal onLoginSuccess={handleLoginSuccess} />
        </main>
      </div>
    );
  }

  const completionRate = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  return (
    <div className={`app ${darkMode ? "dark-mode" : "light-mode"}`}>
      {/* MOBILE DRAWER BACKDROP */}
      {mobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* =========================
          SIDEBAR
      ========================= */}
      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-top-row">
          <div className="brand">
            <div className="brand-icon">
              <LogoIcon size={30} />
            </div>
            <div>
              <div className="brand-title-row">
                <h1>TaskFlow</h1>
                <span className="pro-pill">PRO</span>
              </div>
              <span className="brand-subtitle">Personal Workspace</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            <XIcon size={18} />
          </button>
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
              setMobileMenuOpen(false);
            }}
          >
            <HomeIcon size={18} />
            <span>Dashboard</span>
          </button>

          <button
            className={
              activeView === "calendar"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => {
              setActiveView("calendar");
              setMobileMenuOpen(false);
            }}
          >
            <CalendarIcon size={18} />
            <span>Calendar</span>
            {scheduledCount > 0 && <b className="nav-badge">{scheduledCount}</b>}
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
              setMobileMenuOpen(false);
            }}
          >
            <ClockIcon size={18} />
            <span>Pending</span>
            {pendingCount > 0 && <b className="nav-badge warning">{pendingCount}</b>}
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
              setMobileMenuOpen(false);
            }}
          >
            <CheckCircleIcon size={18} />
            <span>Completed</span>
            {completedCount > 0 && <b className="nav-badge success">{completedCount}</b>}
          </button>
        </nav>

        {/* MOBILE USER PROFILE SECTION IN DRAWER */}
        <div className="sidebar-mobile-user">
          <div className="sidebar-user-info">
            <div className="avatar">
              {currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="user-details">
              <span className="user-name">
                {currentUser?.email ? currentUser.email.split("@")[0] : "User"}
              </span>
              <span className="user-email-small">
                {currentUser?.email || ""}
              </span>
            </div>
          </div>
          <button
            className="sidebar-logout-btn"
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
          >
            <LogOutIcon size={15} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* MODERN PRODUCTIVITY CARD */}
        <div className="sidebar-progress-card">
          <div className="progress-header">
            <div className="progress-title-wrap">
              <TrendingUpIcon size={15} />
              <span>Daily Progress</span>
            </div>
            <span className="progress-percentage">{completionRate}%</span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${completionRate}%` }}
            ></div>
          </div>
          <p className="progress-caption">
            {completedCount} of {todos.length} tasks completed
          </p>
        </div>
      </aside>

      {/* =========================
          MAIN CONTENT
      ========================= */}
      <main className="main">
        {/* HEADER */}
        <header className="header">
          <div className="mobile-header-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <MenuIcon size={22} />
            </button>
            <div className="mobile-brand">
              <LogoIcon size={26} />
              <strong>TaskFlow</strong>
            </div>
          </div>

          <div className="header-view-title">
            <h2>{activeView === "calendar" ? "Calendar Schedule" : "Task Workspace"}</h2>
          </div>

          <div className="header-actions">
            {/* NOTIFICATION & REMINDER BELL */}
            <NotificationBell
              todos={todos}
              onCompleteTodo={toggleTodo}
              onSnoozeTodo={handleSnooze}
              onSelectTodo={editTodo}
            />

            {/* SYNC CLOUD BUTTON */}
            <button
              className={`icon-button ${loading ? "spinning" : ""}`}
              onClick={fetchTodos}
              title="Sync Tasks with Cloud"
              aria-label="Sync Tasks"
              id="sync-tasks-btn"
            >
              <RefreshCwIcon size={18} />
            </button>

            {/* DAY / NIGHT BUTTON */}
            <button
              className="icon-button"
              onClick={toggleTheme}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            </button>

            {/* LOGGED IN USER PILL */}
            <div className="user" title={`Logged in as ${currentUser?.email || "User"}`}>
              <div className="avatar">
                {currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : "U"}
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
                <LogOutIcon size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </header>

        {connectionError && (
          <div className="connection-alert-banner">
            <div className="connection-alert-text">
              <AlertTriangleIcon size={18} />
              <span>Could not connect to Spring Boot backend at <code>http://localhost:4040</code></span>
            </div>
            <button type="button" onClick={fetchTodos} className="retry-conn-btn">
              <RefreshCwIcon size={14} />
              <span>Retry</span>
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
                QUICK STATS SUMMARY CARDS
            ========================= */}
            <section className="stats-row">
              <div className="stat-card">
                <div className="stat-icon-wrap total">
                  <ListTodoIcon size={18} />
                </div>
                <div className="stat-meta">
                  <span className="stat-label">Total Tasks</span>
                  <strong className="stat-value">{todos.length}</strong>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-wrap pending">
                  <ClockIcon size={18} />
                </div>
                <div className="stat-meta">
                  <span className="stat-label">Pending</span>
                  <strong className="stat-value">{pendingCount}</strong>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-wrap completed">
                  <CheckCircleIcon size={18} />
                </div>
                <div className="stat-meta">
                  <span className="stat-label">Completed</span>
                  <strong className="stat-value">{completedCount}</strong>
                </div>
              </div>

              <div
                className="stat-card clickable"
                onClick={() => setActiveView("calendar")}
                title="Switch to calendar view"
              >
                <div className="stat-icon-wrap scheduled">
                  <CalendarIcon size={18} />
                </div>
                <div className="stat-meta">
                  <span className="stat-label">Scheduled</span>
                  <strong className="stat-value">{scheduledCount}</strong>
                </div>
              </div>
            </section>

            {/* =========================
                FORM CARD
            ========================= */}
            <section className="add-card">
              <div className="form-header">
                <div className="form-icon">
                  {editingId !== null ? <EditIcon size={18} /> : <PlusIcon size={18} />}
                </div>
                <div>
                  <h2>{editingId !== null ? "Edit Task" : "Create New Task"}</h2>
                  <p>Organize, schedule, and execute your goals with clarity.</p>
                </div>
              </div>

              <div className="form-grid">
                {/* TITLE */}
                <div className="field title-field">
                  <label>
                    Task Title <span>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Design system tokens & components"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>

                {/* DESCRIPTION */}
                <div className="field desc-field">
                  <label>Description</label>
                  <textarea
                    placeholder="Add details, context, or links (optional)..."
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                  />
                </div>

                {/* DATE */}
                <div className="field">
                  <label>Due Date</label>
                  <div className="input-icon" onClick={openDatePicker}>
                    <CalendarIcon size={16} />
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
                    <ClockIcon size={16} />
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
                      <BellIcon size={16} />
                      <span>Set Task Reminder</span>
                    </label>

                    {enableReminder && (
                      <label className="checkbox-toggle-label email-sub-label">
                        <input
                          type="checkbox"
                          checked={sendReminderEmail}
                          onChange={(e) => setSendReminderEmail(e.target.checked)}
                        />
                        <MailIcon size={15} />
                        <span>Email Alert</span>
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
                          <label>Reminder Date</label>
                          <input
                            type="date"
                            value={reminderDate}
                            onChange={(e) => setReminderDate(e.target.value)}
                          />
                        </div>

                        <div className="reminder-input-group">
                          <label>Reminder Time</label>
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
                            <div className="reminder-banner-content">
                              <AlertTriangleIcon size={16} />
                              <span>Selected reminder time is in the past! Please select a future time.</span>
                            </div>
                          ) : (
                            <div className="reminder-banner-content">
                              <BellIcon size={16} />
                              <span>Alarm scheduled for: <strong>{reminderPreviewText}</strong></span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* IMAGE ATTACHMENT */}
                <div className="field image-field">
                  <label>Attachment Image</label>
                  <div className="image-input-control">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                      onChange={handleImageChange}
                      id="todo-file-upload"
                      className="hidden-file-input"
                    />
                    <label htmlFor="todo-file-upload" className="file-upload-button">
                      <ImageIcon size={16} />
                      <span>{image ? "Replace Image" : "Upload File"}</span>
                    </label>
                    <small>JPG, PNG, GIF, WEBP • Max 5MB</small>
                  </div>

                  {imagePreview && (
                    <div className="preview-wrapper">
                      <img src={imagePreview} alt="Preview" />
                      <button
                        type="button"
                        className="preview-remove-btn"
                        onClick={() => {
                          setImage(null);
                          setImagePreview("");
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        aria-label="Remove image"
                      >
                        <XIcon size={14} />
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
                  {saving ? (
                    "Saving..."
                  ) : editingId !== null ? (
                    <>
                      <CheckIcon size={16} />
                      <span>Update Task</span>
                    </>
                  ) : (
                    <>
                      <PlusIcon size={16} />
                      <span>Add Task</span>
                    </>
                  )}
                </button>

                <button className="clear-button" onClick={clearForm}>
                  <RefreshCwIcon size={15} />
                  <span>Clear</span>
                </button>
              </div>
            </section>

            {/* =========================
                SEARCH + FILTER TOOLBAR
            ========================= */}
            <section className="toolbar">
              <div className="search-box">
                <SearchIcon size={17} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search tasks by title or description..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>

              <div className="filters">
                <button
                  className={filter === "all" ? "filter active" : "filter"}
                  onClick={() => setFilter("all")}
                >
                  <ListTodoIcon size={14} />
                  <span>All</span>
                  <span className="filter-count">{todos.length}</span>
                </button>

                <button
                  className={filter === "pending" ? "filter pending active" : "filter pending"}
                  onClick={() => setFilter("pending")}
                >
                  <ClockIcon size={14} />
                  <span>Pending</span>
                  <span className="filter-count">{pendingCount}</span>
                </button>

                <button
                  className={filter === "completed" ? "filter completed active" : "filter completed"}
                  onClick={() => setFilter("completed")}
                >
                  <CheckCircleIcon size={14} />
                  <span>Completed</span>
                  <span className="filter-count">{completedCount}</span>
                </button>
              </div>
            </section>

            {/* =========================
                TODOS LIST
            ========================= */}
            {loading ? (
              <div className="empty">
                <div className="loader"></div>
                <p>Loading your tasks...</p>
              </div>
            ) : filteredTodos.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">
                  <InboxIcon size={46} />
                </div>
                <h3>No tasks found</h3>
                <p>
                  {search
                    ? `No tasks matching "${search}". Try clearing your search.`
                    : "Your workspace is clear. Create a new task to get started."}
                </p>
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
                      {/* ATTACHMENT IMAGE */}
                      {todoImage && (
                        <div className="todo-image">
                          <img src={todoImage} alt={todo.title} />
                        </div>
                      )}

                      {/* CONTENT */}
                      <div className="todo-content">
                        <div className="todo-header-row">
                          <button
                            type="button"
                            className={`todo-checkbox ${todo.completed ? "checked" : ""}`}
                            onClick={() => toggleTodo(todo)}
                            title={todo.completed ? "Mark as Pending" : "Mark as Completed"}
                          >
                            {todo.completed && <CheckIcon size={13} />}
                          </button>
                          <h3 className="todo-title">{todo.title}</h3>
                        </div>

                        {todo.description && (
                          <p className="description">{todo.description}</p>
                        )}

                        <div className="todo-meta">
                          {todo.dueDate && (
                            <span className="meta-chip date-chip">
                              <CalendarIcon size={13} />
                              <span>{formatDate(todo.dueDate)}</span>
                            </span>
                          )}

                          {todo.dueTime && (
                            <span className="meta-chip time-chip">
                              <ClockIcon size={13} />
                              <span>{todo.dueTime.substring(0, 5)}</span>
                            </span>
                          )}

                          {todo.reminderDateTime && (
                            <span
                              className="reminder-tag"
                              title={`Reminder active for ${todo.reminderDateTime.replace("T", " ")}`}
                            >
                              <BellIcon size={12} />
                              <span>Reminder</span>
                            </span>
                          )}
                        </div>

                        <div className="todo-bottom">
                          <span
                            className={
                              todo.completed ? "status completed" : "status pending"
                            }
                          >
                            {todo.completed ? (
                              <>
                                <CheckCircleIcon size={13} />
                                <span>Completed</span>
                              </>
                            ) : (
                              <>
                                <ClockIcon size={13} />
                                <span>Pending</span>
                              </>
                            )}
                          </span>

                          <div className="actions">
                            {/* COMPLETE / UNDO */}
                            <button
                              className="complete-btn"
                              title={todo.completed ? "Mark Pending" : "Complete"}
                              onClick={() => toggleTodo(todo)}
                            >
                              {todo.completed ? (
                                <UndoIcon size={15} />
                              ) : (
                                <CheckIcon size={15} />
                              )}
                            </button>

                            {/* EDIT */}
                            <button
                              className="edit-btn"
                              title="Edit"
                              onClick={() => editTodo(todo)}
                            >
                              <EditIcon size={15} />
                            </button>

                            {/* DELETE */}
                            <button
                              className="delete-btn"
                              title="Delete"
                              onClick={() => deleteTodo(todo.id)}
                            >
                              <TrashIcon size={15} />
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
              <strong>{todos.length}</strong> tasks
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

      {/* =========================
          MOBILE BOTTOM TAB BAR
      ========================= */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <button
          type="button"
          className={`mobile-tab-btn ${activeView === "tasks" && filter === "all" ? "active" : ""}`}
          onClick={() => {
            setActiveView("tasks");
            setFilter("all");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <HomeIcon size={20} />
          <span>Tasks</span>
          {todos.length > 0 && <span className="tab-badge">{todos.length}</span>}
        </button>

        <button
          type="button"
          className={`mobile-tab-btn ${activeView === "calendar" ? "active" : ""}`}
          onClick={() => {
            setActiveView("calendar");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <CalendarIcon size={20} />
          <span>Calendar</span>
          {scheduledCount > 0 && <span className="tab-badge">{scheduledCount}</span>}
        </button>

        <button
          type="button"
          className="mobile-tab-btn mobile-add-tab-btn"
          onClick={() => {
            setActiveView("tasks");
            const titleInput = document.querySelector(".title-field input");
            if (titleInput) {
              titleInput.scrollIntoView({ behavior: "smooth", block: "center" });
              titleInput.focus();
            }
          }}
          aria-label="Add New Task"
        >
          <div className="mobile-add-btn-circle">
            <PlusIcon size={22} />
          </div>
          <span>Add</span>
        </button>

        <button
          type="button"
          className={`mobile-tab-btn ${activeView === "tasks" && filter === "pending" ? "active" : ""}`}
          onClick={() => {
            setActiveView("tasks");
            setFilter("pending");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <ClockIcon size={20} />
          <span>Pending</span>
          {pendingCount > 0 && <span className="tab-badge warning">{pendingCount}</span>}
        </button>

        <button
          type="button"
          className={`mobile-tab-btn ${activeView === "tasks" && filter === "completed" ? "active" : ""}`}
          onClick={() => {
            setActiveView("tasks");
            setFilter("completed");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <CheckCircleIcon size={20} />
          <span>Done</span>
          {completedCount > 0 && <span className="tab-badge success">{completedCount}</span>}
        </button>
      </nav>
    </div>
  );
}

export default App;