/** Split a .sql file into executable statements, dropping comment lines. */
export function splitSql(sql: string): string[] {
  return sql
    .split("\n")
    .filter((l) => !/^\s*--/.test(l))
    .join("\n")
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Remove FOREIGN KEY constraint lines from a CREATE TABLE statement.
 * Some managed MySQL-compatible engines (older TiDB, some shared hosts,
 * Vitess-based services) reject them. The app never relies on DB-level
 * cascades for correctness, so dropping them is safe.
 */
export function stripForeignKeys(stmt: string): string {
  const withoutFk = stmt
    .split("\n")
    .filter((l) => !/^\s*CONSTRAINT\s+\w+\s+FOREIGN KEY/i.test(l))
    .join("\n");
  // clean up a trailing comma left before the closing paren
  return withoutFk.replace(/,(\s*)\)(\s*ENGINE)/i, "$1)$2");
}
