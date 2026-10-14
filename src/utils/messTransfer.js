export const sameMessId = (left, right) => left != null && right != null && String(left) === String(right);

const isTemporaryStay = id => typeof id === 'string' && id.startsWith('temp_');

export function messStaySnapshot(stay) {
  const day = value => value ? String(value).slice(0, 10) : null;
  return {
    id: String(stay.id), building_id: String(stay.building_id),
    room_no: stay.room_no ?? stay.room_number, bed_no: stay.bed_no ?? stay.bed_number ?? '',
    guest_name: stay.guest_name ?? stay.employee_name ?? '', status: stay.status ?? '',
    start_date: day(stay.start_date ?? stay.check_in), end_date: day(stay.end_date ?? stay.check_out),
    updated_at: stay.updated_at ? new Date(stay.updated_at).toISOString() : null,
  };
}

export function messDraftBaseline(actions, stays) {
  const ids = new Set(actions.filter(a => a.stayId != null && !isTemporaryStay(a.stayId)).map(a => String(a.stayId)));
  return stays.filter(s => ids.has(String(s.id))).map(messStaySnapshot);
}

// A simulated stay may move repeatedly before it is ever saved. Persist only
// its final placement, while retaining the checkout of the original DB stay.
export function buildMessTransferBatch(actions, checkoutDate) {
  const closedStays = new Map();
  const newStays = new Map();
  for (const action of actions) {
    if (action.type === 'TRANSFER' || action.type === 'CHECK_OUT') {
      if (action.stayId == null || action.stayId === '') throw new Error('ID penghuni tidak valid. Muat ulang data mess.');
      if (isTemporaryStay(action.stayId)) {
        if (!newStays.delete(String(action.stayId))) throw new Error('Draf penghuni tidak ditemukan. Periksa ulang simulasi.');
      } else {
        closedStays.set(String(action.stayId), { type: 'UPDATE', id: action.stayId, payload: { end_date: checkoutDate } });
      }
    }
    if (action.type === 'CHECK_IN' || action.type === 'TRANSFER') {
      if (!isTemporaryStay(action.tempId) || !action.payload) throw new Error('Draf kamar tidak valid. Periksa ulang simulasi.');
      newStays.set(action.tempId, { type: 'CREATE', payload: action.payload });
    }
  }
  return [...closedStays.values(), ...newStays.values()];
}

// Removing an earlier draft also removes later actions that rely on that stay.
export function undoMessTransferAction(actions, actionId) {
  const removedStays = new Set();
  return actions.filter(action => {
    const remove = sameMessId(action.id, actionId) || removedStays.has(String(action.stayId));
    if (remove && action.tempId) removedStays.add(String(action.tempId));
    return !remove;
  });
}
