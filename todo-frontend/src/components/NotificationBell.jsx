import { useEffect, useRef, useState } from "react";

export default function NotificationBell({
  todos = [],
  onCompleteTodo,
  onSnoozeTodo,
  onSelectTodo,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState(() => {
    return typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported";
  });
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        setBrowserPermission(perm);
      } catch (err) {
        console.warn("Could not request notification permission:", err);
      }
    }
  };

  const now = new Date();

  // Find due/overdue reminders (pending tasks whose reminderDateTime or due date/time is past)
  const dueReminders = todos.filter((todo) => {
    if (todo.completed) return false;
    if (todo.reminderDateTime) {
      return new Date(todo.reminderDateTime) <= now;
    }
    if (todo.dueDate) {
      const due = new Date(
        todo.dueDate + (todo.dueTime ? `T${todo.dueTime}` : "T23:59:59")
      );
      return due <= now;
    }
    return false;
  });

  // Find upcoming reminders (due in the future within next 24 hours)
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const upcomingReminders = todos.filter((todo) => {
    if (todo.completed) return false;
    if (todo.reminderDateTime) {
      const rTime = new Date(todo.reminderDateTime);
      return rTime > now && rTime <= in24h;
    }
    if (todo.dueDate) {
      const due = new Date(
        todo.dueDate + (todo.dueTime ? `T${todo.dueTime}` : "T23:59:59")
      );
      return due > now && due <= in24h;
    }
    return false;
  });

  const totalAlertCount = dueReminders.length;

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        type="button"
        className={`bell-icon-button ${totalAlertCount > 0 ? "has-alerts" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title={
          totalAlertCount > 0
            ? `${totalAlertCount} reminder(s) need attention`
            : "Reminders & Notifications"
        }
        aria-label="Reminders"
      >
        <span>🔔</span>
        {totalAlertCount > 0 && (
          <span className="bell-badge">{totalAlertCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="bell-dropdown-card">
          <div className="bell-dropdown-header">
            <div className="bell-title-wrap">
              <span className="bell-icon-mini">⏰</span>
              <h4>Reminders Center</h4>
            </div>
            <button
              type="button"
              className="bell-close-btn"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>

          {/* PERMISSION BANNER */}
          {browserPermission !== "granted" &&
            browserPermission !== "unsupported" && (
              <div className="bell-perm-banner">
                <span>Enable desktop alerts so you never miss a deadline.</span>
                <button
                  type="button"
                  onClick={requestNotificationPermission}
                  className="bell-perm-btn"
                >
                  Enable Alerts
                </button>
              </div>
            )}

          <div className="bell-dropdown-body">
            {/* DUE NOW / OVERDUE SECTION */}
            {dueReminders.length > 0 && (
              <div className="bell-section">
                <span className="bell-section-title overdue">
                  ⚠️ Action Required ({dueReminders.length})
                </span>
                <div className="bell-list">
                  {dueReminders.map((todo) => (
                    <div key={todo.id} className="bell-item overdue">
                      <div className="bell-item-main">
                        <strong className="bell-item-title">
                          {todo.title}
                        </strong>
                        <span className="bell-item-subtitle">
                          {todo.dueDate
                            ? `Due: ${todo.dueDate} ${
                                todo.dueTime ? todo.dueTime.substring(0, 5) : ""
                              }`
                            : "Reminder due"}
                        </span>
                      </div>
                      <div className="bell-item-actions">
                        <button
                          type="button"
                          className="bell-act-btn done"
                          title="Mark Complete"
                          onClick={() => onCompleteTodo(todo)}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className="bell-act-btn snooze"
                          title="Snooze 10m"
                          onClick={() => onSnoozeTodo(todo.id, 10)}
                        >
                          ⏱
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* UPCOMING SECTION */}
            {upcomingReminders.length > 0 && (
              <div className="bell-section">
                <span className="bell-section-title upcoming">
                  📅 Due Next 24 Hours ({upcomingReminders.length})
                </span>
                <div className="bell-list">
                  {upcomingReminders.map((todo) => (
                    <div key={todo.id} className="bell-item upcoming">
                      <div className="bell-item-main">
                        <strong className="bell-item-title">
                          {todo.title}
                        </strong>
                        <span className="bell-item-subtitle">
                          {todo.dueDate} {todo.dueTime ? `at ${todo.dueTime.substring(0, 5)}` : ""}
                        </span>
                      </div>
                      {onSelectTodo && (
                        <button
                          type="button"
                          className="bell-view-btn"
                          onClick={() => {
                            onSelectTodo(todo);
                            setIsOpen(false);
                          }}
                        >
                          View
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dueReminders.length === 0 && upcomingReminders.length === 0 && (
              <div className="bell-empty">
                <span>🎉</span>
                <h5>All caught up!</h5>
                <p>No pending reminders for today.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
