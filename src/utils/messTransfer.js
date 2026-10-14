export const sameMessId = (left, right) => left != null && right != null && String(left) === String(right);

const isTemporaryStay = id => typeof id === 'string' && id.startsWith('temp_');

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
