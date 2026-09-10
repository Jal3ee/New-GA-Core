import { useMemo } from 'react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale';

export default function EventGanttView({ events, currentDate, onEventClick }) {
  
  // Calculate days in current month view
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  return (
    <div className="bg-[var(--card)] rounded-[var(--radius-lg)] border border-[var(--border)] h-[700px] flex flex-col shadow-sm overflow-hidden">
      
      {/* Gantt Header */}
      <div className="flex border-b border-[var(--border)] bg-[var(--muted)]/50 shrink-0">
        <div className="w-64 p-3 border-r border-[var(--border)] font-semibold text-sm text-[var(--foreground)] shrink-0 flex items-center">
          Kegiatan
        </div>
        <div className="flex-1 overflow-x-auto custom-scrollbar flex">
          {daysInMonth.map(day => (
            <div key={day.toISOString()} className="min-w-[40px] flex-1 flex flex-col items-center justify-center p-2 border-r border-[var(--border)] shrink-0">
              <span className="text-[10px] uppercase text-[var(--muted-foreground)]">{format(day, 'E', { locale: id })}</span>
              <span className={`text-sm font-medium ${isSameDay(day, new Date()) ? 'bg-[var(--primary)] text-white w-6 h-6 rounded-full flex items-center justify-center mt-1' : 'text-[var(--foreground)] mt-1'}`}>
                {format(day, 'd')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Gantt Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex">
        
        {/* Left Column (Titles) */}
        <div className="w-64 border-r border-[var(--border)] shrink-0 flex flex-col">
          {events.length === 0 ? (
            <div className="p-4 text-sm text-[var(--muted-foreground)] italic">Tidak ada kegiatan</div>
          ) : (
            events.map(event => (
              <div 
                key={event.id} 
                onClick={() => onEventClick(event.extendedProps)}
                className={`h-12 px-3 border-b border-[var(--border)] flex items-center text-sm truncate cursor-pointer hover:bg-[var(--muted)] transition-colors ${event.extendedProps.status === 'Closed' ? 'line-through text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'}`}
              >
                {event.title}
              </div>
            ))
          )}
        </div>
        
        {/* Right Column (Grid & Bars) */}
        <div className="flex-1 overflow-x-auto custom-scrollbar relative flex flex-col">
          {events.map((event, idx) => {
            const evStart = new Date(event.start);
            const evEnd = new Date(event.end);
            const monthStart = startOfMonth(currentDate);
            
            // Calculate left offset and width based on days
            let startDiffDays = (evStart.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24);
            if (startDiffDays < 0) startDiffDays = 0; // Starts before month
            
            let durationDays = (evEnd.getTime() - Math.max(evStart.getTime(), monthStart.getTime())) / (1000 * 60 * 60 * 24);
            // Min width of 1 day if it starts and ends on same day
            if (durationDays < 1) durationDays = 1;
            
            // If the start is way past this month, we still render the row but the bar might be off screen. 
            // In a real robust gantt we'd filter events. 

            return (
              <div key={event.id} className="h-12 border-b border-[var(--border)] relative flex items-center w-full min-w-max">
                {/* Background Grid */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {daysInMonth.map(day => (
                    <div key={`grid-${day.toISOString()}`} className="min-w-[40px] flex-1 border-r border-[var(--border)]/50 h-full"></div>
                  ))}
                </div>
                
                {/* Event Bar */}
                {startDiffDays >= 0 && startDiffDays <= daysInMonth.length && (
                  <div 
                    onClick={() => onEventClick(event.extendedProps)}
                    className="absolute h-8 rounded-[var(--radius-md)] cursor-pointer shadow-sm transition-transform hover:scale-[1.02] flex items-center px-2 truncate text-xs text-white z-10"
                    style={{
                      left: `calc((${startDiffDays} / ${daysInMonth.length}) * 100%)`,
                      width: `calc((${Math.min(durationDays, daysInMonth.length - startDiffDays)} / ${daysInMonth.length}) * 100%)`,
                      minWidth: '40px',
                      backgroundColor: event.backgroundColor
                    }}
                  >
                    {event.title}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
