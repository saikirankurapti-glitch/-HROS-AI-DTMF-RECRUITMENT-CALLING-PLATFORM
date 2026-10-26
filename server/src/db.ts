import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type Database = DatabaseSync;
export function openDatabase(file = process.env.DATABASE_PATH || './data/hros.db'): Database {
  if (file !== ':memory:') mkdirSync(dirname(resolve(file)),{recursive:true});
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode=WAL;');
  // Migrations are copied to dist/migrations in the Docker build.
  const sql = readFileSync(new URL('../migrations/001_init.sql', import.meta.url),'utf8');
  db.exec(sql);
  return db;
}
export function getRows<T>(db: Database, sql: string, ...args: (string|number|null)[]): T[] {
  return db.prepare(sql).all(...args) as T[];
}
export function getRow<T>(db: Database, sql: string, ...args: (string|number|null)[]): T|undefined {
  return db.prepare(sql).get(...args) as T|undefined;
}
export function audit(db: Database, actor: string, action: string, type: string, id?:number, details?:unknown):void {
  db.prepare('INSERT INTO audit_events(actor,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)')
    .run(actor,action,type,id??null,details ? JSON.stringify(details) : null);
}
