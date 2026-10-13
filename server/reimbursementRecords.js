import { parseReimbursementCSV, SPREADSHEET_CSV_URL } from '../src/utils/reimbursementSource.js';

let cached;
let pending;
export async function loadReimbursementRecords() {
  if (cached?.expires > Date.now()) return cached.records;
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch(SPREADSHEET_CSV_URL, { signal: AbortSignal.timeout(20000) });
    if (!response.ok || !response.headers.get('content-type')?.includes('csv')) throw new Error('Spreadsheet sumber tidak dapat diakses.');
    const records = parseReimbursementCSV(await response.text());
    cached = { records, expires: Date.now() + 60000 };
    return records;
  })();
  try { return await pending; } finally { pending = null; }
}
