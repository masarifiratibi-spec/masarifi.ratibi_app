type Row = Record<string, unknown>;

export class StatefulSqlite {
  private rows = new Map<string, Row[]>();
  private failingTable: string | null = null;

  constructor(tables: readonly string[]) {
    for (const table of tables) this.rows.set(table, []);
  }

  read(table: string): Row[] {
    return (this.rows.get(table) ?? []).map((row) => ({ ...row }));
  }

  failNextWrite(table: string): void {
    this.failingTable = table;
  }

  async withExclusiveTransactionAsync(operation: (database: this) => Promise<void>): Promise<void> {
    const snapshot = new Map([...this.rows].map(([table, rows]) => [table, rows.map((row) => ({ ...row }))]));
    try {
      await operation(this);
    } catch (error) {
      this.rows = snapshot;
      throw error;
    }
  }

  async runAsync(sql: string, ...values: unknown[]): Promise<{ changes: number }> {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const insert = normalized.match(/^INSERT INTO (\w+) \(([^)]+)\)/);
    if (insert) {
      const [, table, rawColumns] = insert;
      if (this.failingTable === table) {
        this.failingTable = null;
        throw new Error(`injected ${table} failure`);
      }
      const columns = rawColumns.split(',').map((column) => column.trim());
      const row = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
      const rows = this.rows.get(table) ?? [];
      const existingIndex = rows.findIndex((stored) => stored.id === row.id);
      if (row.operation_id != null && rows.some((stored, index) => index !== existingIndex && stored.operation_id === row.operation_id)) {
        throw new Error(`UNIQUE constraint failed: ${table}.operation_id`);
      }
      if (existingIndex >= 0 && normalized.includes('ON CONFLICT(id) DO UPDATE')) rows[existingIndex] = row;
      else if (existingIndex >= 0) throw new Error(`UNIQUE constraint failed: ${table}.id`);
      else rows.push(row);
      this.rows.set(table, rows);
      return { changes: 1 };
    }

    const deletion = normalized.match(/^DELETE FROM (\w+) WHERE id = \?/);
    if (deletion) {
      if (this.failingTable === deletion[1]) {
        this.failingTable = null;
        throw new Error(`injected ${deletion[1]} failure`);
      }
      const rows = this.rows.get(deletion[1]) ?? [];
      const kept = rows.filter((row) => row.id !== values[0]);
      this.rows.set(deletion[1], kept);
      return { changes: rows.length - kept.length };
    }
    throw new Error(`unsupported SQL: ${normalized}`);
  }

  async getFirstAsync<T extends Row>(sql: string, ...values: unknown[]): Promise<T | null> {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const table = normalized.match(/FROM (\w+)/)?.[1];
    if (!table) throw new Error(`unsupported SQL: ${normalized}`);
    const column = normalized.includes('WHERE operation_id = ?') ? 'operation_id' : 'id';
    return (this.read(table).find((row) => row[column] === values[0]) as T | undefined) ?? null;
  }

  async getAllAsync<T extends Row>(sql: string): Promise<T[]> {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const table = normalized.match(/FROM (\w+)/)?.[1];
    if (!table) throw new Error(`unsupported SQL: ${normalized}`);
    return this.read(table) as T[];
  }
}
