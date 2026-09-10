import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

export default function EventCalendarView({ events, onEventClick, onDateClick }) {
  return (
    <div className="bg-[var(--card)] p-4 rounded-[var(--radius-lg)] border border-[var(--border)] min-h-[700px] h-full overflow-hidden shadow-sm">
      <style>{`
        .fc-theme-standard td, .fc-theme-standard th { border-color: var(--border); }
        .fc-button-primary { 
          background-color: var(--primary) !important; 
          border-color: var(--primary) !important; 
        }
        .fc-button-primary:hover { opacity: 0.9; }
        .fc .fc-toolbar-title { font-family: 'Outfit', sans-serif; font-weight: 700; color: var(--foreground); }
        .fc-col-header-cell-cushion { color: var(--foreground); }
        .fc-daygrid-day-number { color: var(--foreground); }
        .fc-day-today { background-color: var(--muted) !important; }
      `}</style>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        events={events}
        eventClick={(info) => onEventClick(info.event.extendedProps)}
        dateClick={(info) => onDateClick(info.date)}
        height="auto"
        eventContent={(arg) => {
          const isClosed = arg.event.extendedProps.status === 'Closed';
          const isBirthday = arg.event.extendedProps.isBirthday;
          
          if (isBirthday) {
             return (
               <div className="p-1.5 text-xs truncate rounded-md w-full bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 shadow-sm border border-pink-200 dark:border-pink-800">
                 <div className="whitespace-normal leading-tight font-medium">{arg.event.title}</div>
               </div>
             );
          }

          return (
            <div className={`p-1.5 text-xs rounded-md w-full transition-opacity shadow-sm border overflow-hidden ${isClosed ? 'line-through opacity-60 bg-[var(--muted)] text-[var(--muted-foreground)] border-transparent' : 'bg-[var(--primary)] text-white border-[var(--primary)]'}`}>
              {arg.timeText && <div className="font-semibold mb-0.5 opacity-90">{arg.timeText}</div>}
              <div className="whitespace-normal leading-tight font-medium">
                {arg.event.title || arg.event.extendedProps.title || 'Tanpa Judul'}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
