// All API calls for the connector feature, centralised here.
// Uses the existing axios instance for consistency with the rest of the app.

import api from './api';
import { ConnectorFormData } from '../types/connector';

export async function testConnection(data: ConnectorFormData): Promise<{ status: string; message: string }> {
  const res = await api.post('/api/connectors/test', {
    db_type: data.dbType,
    host: data.host,
    port: data.port,
    database: data.database,
    username: data.username,
    password: data.password,
  });
  return res.data;
}

export async function connectDatabase(
  sessionId: string,
  data: ConnectorFormData
): Promise<{ tables: string[]; connection_name: string; table_count: number }> {
  const res = await api.post('/api/connectors/connect', {
    session_id: sessionId,
    connection_name: data.connectionName,
    db_type: data.dbType,
    host: data.host,
    port: data.port,
    database: data.database,
    username: data.username,
    password: data.password,
  });
  return res.data;
}

export async function mirrorTables(
  sessionId: string,
  tables: string[]
): Promise<{ tables: Array<{ table: string; rows_mirrored: number; status: string; error?: string }> }> {
  const res = await api.post('/api/connectors/mirror', {
    session_id: sessionId,
    tables,
  });
  return res.data;
}

export async function getConnectionStatus(sessionId: string) {
  const res = await api.get(`/api/connectors/status?session_id=${sessionId}`);
  return res.data;
}

export async function disconnect(sessionId: string) {
  const res = await api.delete(`/api/connectors/disconnect?session_id=${sessionId}`);
  return res.data;
}
