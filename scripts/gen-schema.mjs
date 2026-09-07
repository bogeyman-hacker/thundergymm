import fs from "node:fs";
const sql = fs.readFileSync("db/schema.sql", "utf8");
fs.writeFileSync(
  "src/lib/schema.ts",
  `// AUTO-GENERATED from db/schema.sql — do not edit by hand.\n// Regenerate with: node scripts/gen-schema.mjs\nexport const SCHEMA_SQL = ${JSON.stringify(sql)};\n`
);
console.log("✔ src/lib/schema.ts regenerated");
