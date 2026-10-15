// Caller owns the transaction. This widens stored quantities without changing
// any existing whole-unit balances or rounding fractional packs to integers.
export async function migrateBhpQuantities(query) {
  const fields = [['bhp_usage','qty'],['bhp_stock_in','qty'],['bhp_transfers','qty'],['bhp_initial_stocks','qty']];
  for (const [table,column] of fields) {
    const current=(await query('SELECT format_type(atttypid,atttypmod) AS type FROM pg_attribute WHERE attrelid=to_regclass($1) AND attname=$2 AND NOT attisdropped',[table,column])).rows[0];
    if(current?.type!=='numeric(16,3)') await query(`ALTER TABLE ${table} ALTER COLUMN ${column} TYPE NUMERIC(16,3) USING ${column}::numeric`);
  }
  const current=(await query("SELECT format_type(atttypid,atttypmod) AS type FROM pg_attribute WHERE attrelid=to_regclass('bhp_opnames') AND attname='physical_qty' AND NOT attisdropped")).rows[0];
  if(current?.type!=='numeric(16,3)') {
    await query('ALTER TABLE bhp_opnames DROP COLUMN difference');
    await query('ALTER TABLE bhp_opnames ALTER COLUMN physical_qty TYPE NUMERIC(16,3), ALTER COLUMN system_qty TYPE NUMERIC(16,3)');
    await query('ALTER TABLE bhp_opnames ADD COLUMN difference NUMERIC(16,3) GENERATED ALWAYS AS (physical_qty-system_qty) STORED');
  }
}
