import { useMemo, useState } from "react";

export default function CalendarView({
  todos = [],
  onToggleTodo,
  onEditTodo,
  onDeleteTodo,
  onAddTaskForDate,
  getImageUrl,
}) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    const today = new Date();
    return formatLocalDate(today);
  });
  const [calendarFilter, setCalendarFilter] = useState("all"); // all, pending, completed

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0 - 11

  // Helper to format Date to "YYYY-MM-DD"
  function formatLocalDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDateStr(formatLocalDate(today));
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Map of date string -> array of todos
  const todosByDate = useMemo(() => {
    const map = {};
    todos.forEach((todo) => {
      if (todo.dueDate) {
        if (!map[todo.dueDate]) {
          map[todo.dueDate] = [];
        }
        map[todo.dueDate].push(todo);
      }
    });
    return map;
  }, [todos]);

  // Calendar matrix calculation
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];
    const todayStr = formatLocalDate(new Date());

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateStr = formatLocalDate(prevDate);
      cells.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const date = new Date(year, month, dayNum);
      const dateStr = formatLocalDate(date);
      cells.push({
        dateStr,
        dayNum,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month filler days (to complete 35 or 42 grid cells)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextDate = new Date(year, month + 1, dayNum);
      const dateStr = formatLocalDate(nextDate);
      cells.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return cells;
  }, [year, month]);

  // Check if a task is overdue
  const isOverdue = (todo) => {
    if (todo.completed || !todo.dueDate) return false;
    const now = new Date();
    const due = new Date(todo.dueDate + (todo.dueTime ? `T${todo.dueTime}` : "T23:59:59"));
    return due < now;
  };

  // Month stats
  const monthStats = useMemo(() => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const thisMonthTodos = todos.filter((t) => t.dueDate && t.dueDate.startsWith(monthPrefix));
    const completed = thisMonthTodos.filter((t) => t.completed).length;
    const pending = thisMonthTodos.length - completed;
    const overdue = thisMonthTodos.filter(isOverdue).length;

    return { total: thisMonthTodos.length, completed, pending, overdue };
  }, [todos, year, month]);

  // Tasks for selected date
  const selectedDateTasks = useMemo(() => {
    const list = todosByDate[selectedDateStr] || [];
    if (calendarFilter === "pending") return list.filter((t) => !t.completed);
    if (calendarFilter === "completed") return list.filter((t) => t.completed);
    return list;
  }, [todosByDate, selectedDateStr, calendarFilter]);

  const readableSelectedDate = useMemo(() => {
    if (!selectedDateStr) return "";
    const [y, m, d] = selectedDateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [selectedDateStr]);

  return (
    <div className="calendar-view-container">
      {/* HEADER & MONTH CONTROLS */}
      <div className="calendar-header-card">
        <div className="calendar-title-group">
          <div className="calendar-icon-badge">📅</div>
          <div>
            <h2 className="calendar-title">
              {monthNames[month]} {year}
            </h2>
            <p className="calendar-subtitle">
              Plan, schedule, and track your daily deadlines
            </p>
          </div>
        </div>

        {/* MONTH STATS */}
        <div className="calendar-stats-row">
          <div className="calendar-stat-pill total">
            <span className="stat-label">This Month</span>
            <strong className="stat-value">{monthStats.total}</strong>
          </div>
          <div className="calendar-stat-pill pending">
            <span className="stat-label">Pending</span>
            <strong className="stat-value">{monthStats.pending}</strong>
          </div>
          <div className="calendar-stat-pill completed">
            <span className="stat-label">Completed</span>
            <strong className="stat-value">{monthStats.completed}</strong>
          </div>
          {monthStats.overdue > 0 && (
            <div className="calendar-stat-pill overdue">
              <span className="stat-label">Overdue</span>
              <strong className="stat-value">{monthStats.overdue}</strong>
            </div>
          )}
        </div>

        {/* NAVIGATION BUTTONS */}
        <div className="calendar-controls">
          <div className="calendar-nav-buttons">
            <button
              type="button"
              className="cal-nav-btn"
              onClick={prevMonth}
              title="Previous Month"
              aria-label="Previous Month"
            >
              ‹
            </button>
            <button
              type="button"
              className="cal-today-btn"
              onClick={goToToday}
            >
              Today
            </button>
            <button
              type="button"
              className="cal-nav-btn"
              onClick={nextMonth}
              title="Next Month"
              aria-label="Next Month"
            >
              ›
            </button>
          </div>

          <div className="calendar-filters">
            <button
              type="button"
              className={`cal-filter-btn ${calendarFilter === "all" ? "active" : ""}`}
              onClick={() => setCalendarFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`cal-filter-btn ${calendarFilter === "pending" ? "active" : ""}`}
              onClick={() => setCalendarFilter("pending")}
            >
              Pending
            </button>
            <button
              type="button"
              className={`cal-filter-btn ${calendarFilter === "completed" ? "active" : ""}`}
              onClick={() => setCalendarFilter("completed")}
            >
              Completed
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CALENDAR LAYOUT (GRID + AGENDA DRAWER) */}
      <div className="calendar-main-grid-layout">
        {/* MONTH GRID */}
        <div className="calendar-grid-card">
          {/* WEEKDAY NAMES HEADER */}
          <div className="calendar-weekdays-row">
            {weekdayNames.map((name) => (
              <div key={name} className="calendar-weekday-cell">
                {name}
              </div>
            ))}
          </div>

          {/* CELLS */}
          <div className="calendar-days-grid">
            {calendarCells.map((cell) => {
              const dayTasks = todosByDate[cell.dateStr] || [];
              const filteredDayTasks = dayTasks.filter((t) => {
                if (calendarFilter === "pending") return !t.completed;
                if (calendarFilter === "completed") return t.completed;
                return true;
              });

              const isSelected = cell.dateStr === selectedDateStr;
              const hasOverdue = dayTasks.some(isOverdue);

              return (
                <div
                  key={cell.dateStr}
                  className={`calendar-day-cell ${
                    cell.isCurrentMonth ? "in-month" : "out-month"
                  } ${cell.isToday ? "today-cell" : ""} ${
                    isSelected ? "selected-cell" : ""
                  }`}
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="day-cell-top">
                    <span className={`day-number ${cell.isToday ? "today-badge" : ""}`}>
                      {cell.dayNum}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="task-count-indicator">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* MINI TASK PILLS */}
                  <div className="day-task-pills">
                    {filteredDayTasks.slice(0, 2).map((todo) => {
                      const taskOverdue = isOverdue(todo);
                      return (
                        <div
                          key={todo.id}
                          className={`day-task-pill ${
                            todo.completed
                              ? "pill-completed"
                              : taskOverdue
                              ? "pill-overdue"
                              : "pill-pending"
                          }`}
                          title={`${todo.title} ${todo.dueTime ? `(${todo.dueTime.substring(0, 5)})` : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDateStr(cell.dateStr);
                          }}
                        >
                          <span className="pill-dot"></span>
                          <span className="pill-title">{todo.title}</span>
                          {todo.dueTime && (
                            <span className="pill-time">
                              {todo.dueTime.substring(0, 5)}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {filteredDayTasks.length > 2 && (
                      <div className="pill-more">
                        +{filteredDayTasks.length - 2} more
                      </div>
                    )}
                  </div>

                  {hasOverdue && !cell.isToday && (
                    <div className="day-overdue-pip" title="Has overdue tasks"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SELECTED DAY AGENDA PANEL */}
        <aside className="calendar-agenda-panel">
          <div className="agenda-header">
            <div>
              <span className="agenda-date-tag">Selected Day</span>
              <h3 className="agenda-date-title">{readableSelectedDate}</h3>
            </div>
            <button
              type="button"
              className="agenda-add-btn"
              onClick={() => onAddTaskForDate(selectedDateStr)}
              title="Add task for this date"
            >
              + Add Task
            </button>
          </div>

          <div className="agenda-tasks-list">
            {selectedDateTasks.length === 0 ? (
              <div className="agenda-empty-state">
                <div className="agenda-empty-icon">🏖️</div>
                <h4>No tasks scheduled</h4>
                <p>Enjoy your free day or schedule a new goal.</p>
                <button
                  type="button"
                  className="agenda-create-btn"
                  onClick={() => onAddTaskForDate(selectedDateStr)}
                >
                  + Create Task for {selectedDateStr}
                </button>
              </div>
            ) : (
              selectedDateTasks.map((todo) => {
                const taskImage = getImageUrl ? getImageUrl(todo) : null;
                const overdue = isOverdue(todo);

                return (
                  <div
                    key={todo.id}
                    className={`agenda-task-card ${
                      todo.completed
                        ? "completed"
                        : overdue
                        ? "overdue"
                        : "pending"
                    }`}
                  >
                    <div className="agenda-task-main">
                      <button
                        type="button"
                        className={`agenda-checkbox ${todo.completed ? "checked" : ""}`}
                        onClick={() => onToggleTodo(todo)}
                        title={todo.completed ? "Mark as Pending" : "Mark as Completed"}
                      >
                        {todo.completed ? "✓" : ""}
                      </button>

                      <div className="agenda-task-info">
                        <div className="agenda-task-title-row">
                          <h4 className="agenda-task-title">{todo.title}</h4>
                          {todo.reminderDateTime && (
                            <span
                              className="agenda-reminder-badge"
                              title={`Reminder set for ${todo.reminderDateTime.replace("T", " ")}`}
                            >
                              🔔
                            </span>
                          )}
                        </div>

                        {todo.description && (
                          <p className="agenda-task-desc">{todo.description}</p>
                        )}

                        <div className="agenda-task-meta">
                          {todo.dueTime && (
                            <span className="agenda-meta-time">
                              ⏰ {todo.dueTime.substring(0, 5)}
                            </span>
                          )}
                          {overdue && (
                            <span className="agenda-meta-status overdue">
                              ⚠️ Overdue
                            </span>
                          )}
                          {todo.completed && (
                            <span className="agenda-meta-status done">
                              ✓ Completed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {taskImage && (
                      <div className="agenda-task-thumb">
                        <img src={taskImage} alt={todo.title} />
                      </div>
                    )}

                    <div className="agenda-task-actions">
                      <button
                        type="button"
                        className="agenda-action-btn edit"
                        onClick={() => onEditTodo(todo)}
                        title="Edit Task"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="agenda-action-btn delete"
                        onClick={() => onDeleteTodo(todo.id)}
                        title="Delete Task"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
