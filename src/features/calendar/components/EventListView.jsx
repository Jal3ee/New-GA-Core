import FullCalendar from '@fullcalendar/react';
import listPlugin from '@fullcalendar/list';

export default function EventListView({ events, onEventClick }) {
  return (
    <div className="bg-[var(--card)] p-4 rounded-[var(--radius-lg)] border border-[var(--border)] h-[700px] overflow-hidden shadow-sm">
      <style>{`
        .fc-theme-standard td, .fc-theme-standard th { border-color: var(--border); }
        .fc-list-day-cushion { background-color: var(--muted) !important; color: var(--foreground); }
        .fc-list-event-title { color: var(--foreground); }
        .fc-list-event-time { color: var(--muted-foreground); }
        .fc-list-event:hover td { background-color: var(--muted); cursor: pointer; }
      `}</style>
      <FullCalendar
        plugins={[listPlugin]}
        initialView="listMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'listMonth,listWeek'
        }}
        events={events}
        eventClick={(info) => onEventClick(info.event.extendedProps)}
        height="100%"
        eventContent={(arg) => {
          const isClosed = arg.event.extendedProps.status === 'Closed';
          return (
            <div className={`flex items-center space-x-2 ${isClosed ? 'line-through opacity-60' : ''}`}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: arg.event.backgroundColor }}></div>
              <span>{arg.event.title}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] border border-[var(--border)] ml-auto">
                {arg.event.extendedProps.category}
              </span>
            </div>
          );
        }}
      />
    </div>
  );
}
