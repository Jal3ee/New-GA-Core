import assert from 'node:assert/strict';
import { buildMessTransferBatch, sameMessId, undoMessTransferAction } from '../src/utils/messTransfer.js';

const date = '2026-10-14T03:00:00.000Z';
const room = bed => ({ building_id: 1, room_no: 'K1', bed_no: bed, guest_name: 'Antok Subakti', start_date: date });
const checkIn = { id: 'a', type: 'CHECK_IN', tempId: 'temp_a', payload: room('B1') };
const move = (id, source, bed) => ({ id, type: 'TRANSFER', stayId: source, tempId: `temp_${id}`, payload: room(bed) });
const out = source => ({ id: 'out', type: 'CHECK_OUT', stayId: source });
const close = id => ({ type: 'UPDATE', id, payload: { end_date: date } });
const create = payload => ({ type: 'CREATE', payload });

// PostgreSQL integer IDs and legacy string IDs both work, without prefix errors.
for (const id of [37, '37']) {
  assert.deepEqual(buildMessTransferBatch([out(id)], date), [close(id)]);
  const transfer = move('b', id, 'B2');
  assert.deepEqual(buildMessTransferBatch([transfer], date), [close(id), create(transfer.payload)]);
}
assert.equal(sameMessId(37, '37'), true);
assert.equal(sameMessId(null, null), false);
assert.equal(sameMessId(37, '137'), false);

const first = move('b', 'temp_a', 'B2');
const final = move('c', 'temp_b', 'B3');
assert.deepEqual(buildMessTransferBatch([checkIn, first, final], date), [create(final.payload)]);
assert.deepEqual(buildMessTransferBatch([checkIn, first, out('temp_b')], date), []);
const existingMove = move('b', 37, 'B2');
assert.deepEqual(buildMessTransferBatch([existingMove, final], date), [close(37), create(final.payload)]);
assert.deepEqual(buildMessTransferBatch([existingMove, out('temp_b')], date), [close(37)]);
const unrelated = { ...checkIn, id: 'other', tempId: 'temp_other' };
assert.deepEqual(undoMessTransferAction([checkIn, first, unrelated, final], 'a'), [unrelated]);
assert.deepEqual(undoMessTransferAction([checkIn, first, final], 'b'), [checkIn]);
assert.throws(() => buildMessTransferBatch([out(undefined)], date), /ID penghuni/);
assert.throws(() => buildMessTransferBatch([out('temp_missing')], date), /Draf penghuni/);
console.log('Mess transfer regression checks passed: numeric/string IDs, repeated moves, canceled check-in, checkout, dependent undo, invalid drafts.');
