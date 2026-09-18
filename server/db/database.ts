import pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
}

class DatabaseManager {
  private pool: pg.Pool | null = null;
  private pglite: PGlite | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const dbUrl = process.env.DATABASE_URL;
      let connectedToPg = false;

      if (dbUrl && !dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")) {
        try {
          console.log("[DB] Attempting connection to external PostgreSQL pool...");
          const pool = new pg.Pool({
            connectionString: dbUrl,
            max: 20,
            connectionTimeoutMillis: 3000,
          });
          const client = await pool.connect();
          await client.query("SELECT 1");
          client.release();
          this.pool = pool;
          connectedToPg = true;
          console.log("[DB] Successfully connected to PostgreSQL Pool!");
        } catch (err: any) {
          console.warn("[DB] Could not connect to external PostgreSQL:", err.message);
        }
      }

      if (!connectedToPg) {
        console.log("[DB] Initializing embedded PostgreSQL 16 (PGlite WASM) engine...");
        const dataDir = path.join(process.cwd(), "data");
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        // Use embedded PGlite for reliable zero-setup container execution
        this.pglite = new PGlite(path.join(dataDir, "postgres_pglite"));
        await this.pglite.waitReady;
        console.log("[DB] Embedded PostgreSQL 16 ready!");
      }

      // Execute initial schema
      await this.runMigrations();
      this.isInitialized = true;
    })();

    return this.initPromise;
  }

  private async runMigrations(): Promise<void> {
    const schemaPath = path.join(process.cwd(), "server", "db", "schema.sql");
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, "utf-8");
      try {
        if (this.pool) {
          await this.pool.query(schemaSql);
        } else if (this.pglite) {
          await this.pglite.exec(schemaSql);
        }
        console.log("[DB] Database migrations applied successfully!");
      } catch (err: any) {
        console.error("[DB] Migration warning (or already applied):", err.message);
      }
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    await this.init();

    if (this.pool) {
      const res = await this.pool.query(sql, params);
      return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
    } else if (this.pglite) {
      const res = await this.pglite.query<T>(sql, params);
      return { rows: res.rows, rowCount: res.rows.length };
    }
    throw new Error("No database driver available");
  }

  /**
   * Runs a block inside a transaction with explicit isolation level and bounded retry with jitter.
   */
  async withTransaction<T>(
    callback: (client: DbClient) => Promise<T>,
    options: {
      isolationLevel?: "SERIALIZABLE" | "READ COMMITTED" | "REPEATABLE READ";
      maxRetries?: number;
      initialBackoffMs?: number;
    } = {}
  ): Promise<T> {
    await this.init();

    const isolation = options.isolationLevel || "SERIALIZABLE";
    const maxRetries = options.maxRetries ?? 5;
    const initialBackoff = options.initialBackoffMs ?? 20;

    let attempt = 0;
    while (true) {
      attempt++;
      try {
        if (this.pool) {
          const client = await this.pool.connect();
          try {
            await client.query(`BEGIN TRANSACTION ISOLATION LEVEL ${isolation}`);
            const dbClient: DbClient = {
              query: (sql, params) => client.query(sql, params).then(r => ({ rows: r.rows, rowCount: r.rowCount ?? r.rows.length })),
            };
            const result = await callback(dbClient);
            await client.query("COMMIT");
            return result;
          } catch (err) {
            await client.query("ROLLBACK").catch(() => {});
            throw err;
          } finally {
            client.release();
          }
        } else if (this.pglite) {
          // PGlite transaction support
          return await this.pglite.transaction(async (tx) => {
            const dbClient: DbClient = {
              query: async <T = any>(sql: string, params?: any[]) => {
                const res = await tx.query(sql, params);
                return { rows: res.rows as T[], rowCount: res.rows.length };
              },
            };
            return await callback(dbClient);
          });
        }
        throw new Error("Database engine not initialized");
      } catch (err: any) {
        const isSerializationError =
          err.code === "40001" || // serialization_failure
          err.code === "40P01" || // deadlock_detected
          err.message?.includes("could not serialize access") ||
          err.message?.includes("deadlock detected") ||
          err.message?.includes("concurrent update");

        if (isSerializationError && attempt < maxRetries) {
          const jitter = Math.floor(Math.random() * (initialBackoff * Math.pow(1.5, attempt)));
          console.warn(`[DB] Serialization conflict on attempt ${attempt}. Retrying in ${jitter}ms...`);
          await new Promise((res) => setTimeout(res, jitter));
          continue;
        }
        throw err;
      }
    }
  }
}

export const db = new DatabaseManager();
