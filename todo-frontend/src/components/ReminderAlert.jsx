import { BellIcon, CalendarIcon, ClockIcon, CheckIcon, XIcon } from "./Icons";

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
            <BellIcon size={24} className="bell-ring" />
          </div>
          <div>
            <span className="reminder-kicker">Task Due Reminder</span>
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
              <span className="meta-val">
                <CalendarIcon size={14} />
                <span>{activeReminder.dueDate}</span>
              </span>
            </div>
          )}
          {activeReminder.dueTime && (
            <div className="reminder-meta-item">
              <span className="meta-label">Due Time</span>
              <span className="meta-val">
                <ClockIcon size={14} />
                <span>{activeReminder.dueTime.substring(0, 5)}</span>
              </span>
            </div>
          )}
        </div>

        <div className="reminder-actions-row">
          <button
            type="button"
            className="reminder-btn complete"
            onClick={() => onComplete(activeReminder)}
          >
            <CheckIcon size={16} />
            <span>Mark Complete</span>
          </button>
          <button
            type="button"
            className="reminder-btn snooze"
            onClick={() => onSnooze(activeReminder.id, 10)}
          >
            <ClockIcon size={15} />
            <span>Snooze (10m)</span>
          </button>
          <button
            type="button"
            className="reminder-btn dismiss"
            onClick={() => onDismiss(activeReminder.id)}
          >
            <XIcon size={15} />
            <span>Dismiss</span>
          </button>
        </div>
      </div>
    </div>
  );
}
