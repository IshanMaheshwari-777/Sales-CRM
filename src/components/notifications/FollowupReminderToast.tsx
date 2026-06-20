// @ts-nocheck
import { useEffect, useState } from 'react';
import { Bell, X, Clock, User, Phone } from 'lucide-react';
import { useReminders, type FollowupReminder } from '../../contexts/ReminderContext';

interface ToastItemProps {
  reminder: FollowupReminder;
  onView: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
  index: number;
}

function ToastItem({ reminder, onView, onSnooze, onDismiss, index }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [autoCloseTimer, setAutoCloseTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, 30000);

    setAutoCloseTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  const handleView = () => {
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    setIsExiting(true);
    setTimeout(() => {
      onView();
    }, 300);
  };

  const handleSnooze = () => {
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    setIsExiting(true);
    setTimeout(() => {
      onSnooze();
    }, 300);
  };

  const formatTime = () => {
    const { minutesUntil } = reminder;

    if (minutesUntil < 1) {
      return 'Now';
    } else if (minutesUntil === 1) {
      return 'in 1 minute';
    } else {
      return `in ${minutesUntil} minutes`;
    }
  };

  const formatScheduledTime = () => {
    const hours = reminder.scheduledTime.getHours();
    const minutes = reminder.scheduledTime.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    const displayMinutes = String(minutes).padStart(2, '0');

    return `${displayHour}:${displayMinutes} ${ampm}`;
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-lg border-l-4 border-orange-500 overflow-hidden transition-all duration-300 ${
        isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      }`}
      style={{
        width: '400px',
        maxWidth: 'calc(100vw - 40px)',
        animation: isExiting ? 'none' : 'slideIn 0.3s ease-out',
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell className="w-5 h-5 text-orange-500" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-ping" />
            </div>
            <h3 className="font-semibold text-slate-800">Follow-up Reminder</h3>
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-500" />
            <span className="font-medium text-slate-800">{reminder.leadName}</span>
          </div>

          {reminder.mobileNumber && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-600">{reminder.mobileNumber}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-600">
              {formatScheduledTime()} ({formatTime()})
            </span>
          </div>

          <div className="bg-orange-50 rounded p-2 mt-2">
            <p className="text-sm text-slate-700 line-clamp-2">{reminder.remarks}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleView}
            className="flex-1 px-3 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition text-sm"
          >
            View
          </button>
          <button
            onClick={handleSnooze}
            className="px-3 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition text-sm"
          >
            Snooze 2min
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition text-sm"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export function FollowupReminderToast() {
  const { reminders, viewFollowup, snoozeReminder, dismissReminder } = useReminders();

  if (reminders.length === 0) return null;

  return (
    <>
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 pointer-events-none">
        <div className="pointer-events-auto flex flex-col gap-3">
          {reminders.map((reminder, index) => (
            <ToastItem
              key={reminder.id}
              reminder={reminder}
              index={index}
              onView={() => viewFollowup(reminder.id)}
              onSnooze={() => snoozeReminder(reminder.id)}
              onDismiss={() => dismissReminder(reminder.id)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
