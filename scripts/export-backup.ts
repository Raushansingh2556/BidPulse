import fs from "fs";
import path from "path";
import { db } from "../server/db/database";

async function exportDatabase() {
  console.log("[BACKUP] Starting safe database export from /data/postgres_pglite/ ...");

  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  await db.init();

  const tables = [
    "users",
    "categories",
    "auctions",
    "bids",
    "auction_participants",
    "wallets",
    "wallet_ledger",
    "outbox_events",
    "auction_change_requests",
    "notifications",
    "reports",
    "support_tickets",
    "system_metrics",
    "audit_logs",
  ];

  const fullBackup: Record<string, any> = {
    exportedAt: new Date().toISOString(),
    engine: "PostgreSQL 16 (PGlite)",
    storagePath: "/data/postgres_pglite/",
    tableCounts: {},
    tables: {},
  };

  let sqlOutput = `-- ==============================================================================
-- DATABASE BACKUP EXPORT FOR REAL-TIME AUCTION PLATFORM
-- Generated: ${new Date().toISOString()}
-- Source: /data/postgres_pglite/
-- ==============================================================================

BEGIN;
SET CONSTRAINTS ALL DEFERRED;

`;

  for (const table of tables) {
    try {
      const res = await db.query(`SELECT * FROM ${table}`);
      fullBackup.tableCounts[table] = res.rows.length;
      fullBackup.tables[table] = res.rows;
      console.log(`[BACKUP] Table "${table}": ${res.rows.length} records found`);

      if (res.rows.length > 0) {
        sqlOutput += `-- ----------------------------------------------------------------------\n`;
        sqlOutput += `-- Data for Name: ${table}; Type: TABLE DATA; Rows: ${res.rows.length}\n`;
        sqlOutput += `-- ----------------------------------------------------------------------\n`;

        for (const row of res.rows) {
          const cols: string[] = [];
          const vals: string[] = [];

          for (const [key, val] of Object.entries(row)) {
            // Skip generated column in wallets if present
            if (table === "wallets" && key === "total_balance") continue;

            cols.push(`"${key}"`);

            if (val === null || val === undefined) {
              vals.push("NULL");
            } else if (typeof val === "number" || typeof val === "bigint") {
              vals.push(String(val));
            } else if (typeof val === "boolean") {
              vals.push(val ? "TRUE" : "FALSE");
            } else if (val instanceof Date) {
              vals.push(`'${val.toISOString()}'`);
            } else if (typeof val === "object") {
              const jsonStr = JSON.stringify(val).replace(/'/g, "''");
              vals.push(`'${jsonStr}'::jsonb`);
            } else {
              const strVal = String(val).replace(/'/g, "''");
              vals.push(`'${strVal}'`);
            }
          }

          sqlOutput += `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${vals.join(", ")}) ON CONFLICT DO NOTHING;\n`;
        }
        sqlOutput += `\n`;
      }
    } catch (err: any) {
      console.warn(`[BACKUP] Note: Table "${table}" skipped or not found:`, err.message);
    }
  }

  sqlOutput += `COMMIT;\n`;

  // Write JSON backup
  const jsonPath = path.join(backupDir, "auction_platform_backup.json");
  fs.writeFileSync(jsonPath, JSON.stringify(fullBackup, null, 2), "utf-8");
  console.log(`[BACKUP] JSON backup written to: ${jsonPath}`);

  // Write SQL backup
  const sqlPath = path.join(backupDir, "auction_platform_backup.sql");
  fs.writeFileSync(sqlPath, sqlOutput, "utf-8");
  console.log(`[BACKUP] SQL backup written to: ${sqlPath}`);

  console.log("\n[BACKUP] Summary of Preserved Records:");
  for (const [tbl, count] of Object.entries(fullBackup.tableCounts)) {
    console.log(` - ${tbl}: ${count} rows`);
  }
}

exportDatabase()
  .then(() => {
    console.log("\n[BACKUP] Database export completed successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[BACKUP] Export failed:", err);
    process.exit(1);
  });
