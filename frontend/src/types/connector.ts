// Type definitions for the connector feature.

export type DbType = 'postgresql' | 'mysql';

export interface ConnectorFormData {
  connectionName: string;
  dbType: DbType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface TableInfo {
  name: string;
  selected: boolean;
}

export interface ConnectorStatus {
  connected: boolean;
  connectionName?: string;
  dbType?: DbType;
  database?: string;
  mirroredTables?: string[];
  lastSyncedAt?: string;
}

export type ConnectorStep = 'form' | 'testing' | 'table_select' | 'mirroring' | 'connected';
