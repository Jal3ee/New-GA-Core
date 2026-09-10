import { RRule, rrulestr } from 'rrule';

export function expandEvents(events, startDate, endDate) {
  const expanded = [];
  
  events.forEach(event => {
    const isClosed = event.status === 'Closed';
    const bgColor = isClosed ? 'var(--muted)' : 'var(--primary)';
    const borderColor = isClosed ? 'var(--border)' : 'var(--primary)';
    const textColor = isClosed ? 'var(--muted-foreground)' : 'white';

    const eventTitle = event.title || event.Title || event.nama_kegiatan || event.name || 'Tanpa Judul';

    if (!event.recurrence_rule) {
      expanded.push({
        id: event.id,
        title: eventTitle,
        start: event.start_time,
        end: event.end_time,
        backgroundColor: bgColor,
        borderColor: borderColor,
        textColor: textColor,
        extendedProps: { ...event }
      });
      return;
    }
    
    try {
      // Create rule based on string. Note: rrulestr ignores dtstart if it's part of the string, 
      // but we force dtstart to be the event's original start time.
      const dtstart = new Date(event.start_time);
      const ruleStr = `DTSTART:${dtstart.toISOString().replace(/[-:]/g, '').substring(0, 15)}Z\nRRULE:${event.recurrence_rule}`;
      const rule = rrulestr(ruleStr);
      
      // Get occurrences within the requested window
      const instances = rule.between(startDate, endDate, true);
      const durationMs = new Date(event.end_time).getTime() - new Date(event.start_time).getTime();
      
      instances.forEach((date, idx) => {
        const start = date.toISOString();
        const end = new Date(date.getTime() + durationMs).toISOString();
        expanded.push({
          id: `${event.id}_${idx}`,
          title: eventTitle,
          start,
          end,
          backgroundColor: bgColor,
          borderColor: borderColor,
          textColor: textColor,
          extendedProps: { ...event, instanceId: `${event.id}_${idx}` }
        });
      });
    } catch (e) {
      console.error("Error parsing rrule for event:", event.id, e);
    }
  });
  
  return expanded;
}
