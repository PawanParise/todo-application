export default function ReminderAlert({
  activeReminder,
  onDismiss,
  onSnooze,
  onComplete,
}) {
  if (!activeReminder) return null;

  return (
    <div className="reminder-alert-backdrop" role="dialog" aria-modal="true">
      <div className="reminder-alert-modal">
        <div className="reminder-alert-glow"></div>
        
        <div className="reminder-alert-header">
          <div className="reminder-pulse-icon">
            <span className="bell-ring">🔔</span>
          </div>
          <div>
            <span className="reminder-kicker">Task Reminder</span>
            <h3 className="reminder-title">{activeReminder.title}</h3>
          </div>
        </div>

        {activeReminder.description && (
          <p className="reminder-description">{activeReminder.description}</p>
        )}

        <div className="reminder-meta-box">
          {activeReminder.dueDate && (
            <div className="reminder-meta-item">
              <span className="meta-label">Due Date</span>
              <span className="meta-val">📆 {activeReminder.dueDate}</span>
            </div>
          )}
          {activeReminder.dueTime && (
            <div className="reminder-meta-item">
              <span className="meta-label">Due Time</span>
              <span className="meta-val">⏰ {activeReminder.dueTime.substring(0, 5)}</span>
            </div>
          )}
        </div>

        <div className="reminder-actions-row">
          <button
            type="button"
            className="reminder-btn complete"
            onClick={() => onComplete(activeReminder)}
          >
            ✓ Mark Complete
          </button>
          <button
            type="button"
            className="reminder-btn snooze"
            onClick={() => onSnooze(activeReminder.id, 10)}
          >
            ⏱ Snooze (10m)
          </button>
          <button
            type="button"
            className="reminder-btn dismiss"
            onClick={() => onDismiss(activeReminder.id)}
          >
            ✕ Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
