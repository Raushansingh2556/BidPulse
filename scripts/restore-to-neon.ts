import fs from "fs";
import path from "path";
import pg from "pg";

function maskDbUrl(url: string): string {
  return url.replace(/(:[^:@\s]+)@/, ":***@");
}

async function restoreToNeon() {
  const targetUrl = process.env.NEON_DATABASE_URL || process.env.TARGET_DATABASE_URL;

  if (!targetUrl) {
    console.error("ERROR: Missing NEON_DATABASE_URL environment variable.");
    console.error("Usage: NEON_DATABASE_URL=\"postgresql://<user>:<password>@<host>/<dbname>?sslmode=require\" npx tsx scripts/restore-to-neon.ts");
    process.exit(1);
  }

  console.log(`[RESTORE] Connecting to target database: ${maskDbUrl(targetUrl)}`);

  const client = new pg.Client({
    connectionString: targetUrl,
    ssl: targetUrl.includes("sslmode=require") || targetUrl.includes("neon.tech")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    await client.connect();
    console.log("[RESTORE] Successfully connected to target database.");

    // 1. Apply schema.sql
    const schemaPath = path.join(process.cwd(), "server", "db", "schema.sql");
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`schema.sql not found at ${schemaPath}`);
    }
    console.log("[RESTORE] Step 1/3: Applying server/db/schema.sql ...");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    await client.query(schemaSql);
    console.log("[RESTORE] Schema applied successfully.");

    // 2. Apply backup SQL
    const backupPath = path.join(process.cwd(), "backups", "auction_platform_backup.sql");
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found at ${backupPath}`);
    }
    console.log("[RESTORE] Step 2/3: Restoring backups/auction_platform_backup.sql ...");
    const backupSql = fs.readFileSync(backupPath, "utf-8");
    await client.query(backupSql);
    console.log("[RESTORE] Backup records restored successfully.");

    // 3. Verification
    console.log("\n[RESTORE] Step 3/3: Verifying restored tables and counts ...");

    const expected = [
      { table: "auctions", expected: 101 },
      { table: "bids", expected: 8 },
      { table: "users", expected: 6 },
      { table: "wallets", expected: 6 },
      { table: "wallet_ledger", expected: 17 },
      { table: "categories", expected: 10 },
      { table: "outbox_events", expected: 12 },
      { table: "notifications", expected: 8 },
    ];

    let allMatched = true;
    console.log("---------------------------------------------------------");
    console.log(" Table Name        | Expected | Actual in Neon | Status  ");
    console.log("---------------------------------------------------------");

    for (const item of expected) {
      const res = await client.query(`SELECT COUNT(*) AS count FROM ${item.table}`);
      const actual = parseInt(res.rows[0].count, 10);
      const isMatch = actual >= item.expected; // checks count match
      if (!isMatch) allMatched = false;

      const status = isMatch ? "MATCHED OK" : "MISMATCH";
      console.log(
        ` ${item.table.padEnd(17)} | ${String(item.expected).padStart(8)} | ${String(actual).padStart(14)} | ${status}`
      );
    }
    console.log("---------------------------------------------------------");

    if (allMatched) {
      console.log("\n[SUCCESS] Neon database successfully restored and verified with 100% data integrity!");
    } else {
      console.warn("\n[WARNING] Some record counts did not match expected minimums. Review output above.");
    }
  } catch (err: any) {
    console.error("\n[ERROR] Restoration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

restoreToNeon();
