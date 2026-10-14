export function bhpCalendarDate(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).format(parsed);
}
export function bhpReceiptPeriod(row) {
  const from=bhpCalendarDate(row.period_start), to=bhpCalendarDate(row.period_end);
  return from && to ? {label:`${from} s.d. ${to}`,weekly:true} : {label:bhpCalendarDate(row.date),weekly:false};
}
