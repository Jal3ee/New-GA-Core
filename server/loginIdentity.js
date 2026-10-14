// Compare numeric NIKs as strings: leading zeros can be dropped by source data.
// Keep alphabetic NIKs and the admin alias unchanged; never use numeric casts.
export const LOGIN_NIK_MATCH = `(LOWER(BTRIM(nik)) = LOWER($1)
  OR ($1 ~ '^[0-9]+$' AND BTRIM(nik) ~ '^[0-9]+$'
    AND LTRIM($1, '0') <> '' AND LTRIM(BTRIM(nik), '0') = LTRIM($1, '0'))
  OR (LOWER($1) = 'admin' AND nik = 'ADM001'))`;

// Exact matches retain priority if a legacy database contains duplicate identities.
export const LOGIN_ACCOUNT_ORDER = `ORDER BY CASE WHEN LOWER(BTRIM(nik)) = LOWER($1) THEN 0 ELSE 1 END, id LIMIT 1`;
export const loginIdentifier = value => typeof value === 'string' ? value.trim() : '';
