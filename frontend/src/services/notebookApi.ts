// All API calls for the Notebooks feature. Import from here, not inline in components.

import api from './api';
import { Notebook, NotebookCell, NotebookSummary } from '../types/notebook';

const BASE = '/api/notebooks';

export async function createNotebook(sessionId?: string | null, title = 'Untitled Notebook'): Promise<Notebook> {
  const payload: any = { title };
  if (sessionId) payload.session_id = sessionId;
  const res = await api.post(`${BASE}/create`, payload);
  return res.data;
}

export async function listNotebooks(): Promise<NotebookSummary[]> {
  const res = await api.get(`${BASE}/list`);
  return res.data;
}

export async function getNotebook(notebookId: string): Promise<Notebook> {
  const res = await api.get(`${BASE}/${notebookId}`);
  return res.data;
}

export async function saveNotebook(
  notebookId: string,
  title: string,
  cells: NotebookCell[],
  sessionId?: string | null
): Promise<Notebook> {
  const payload: any = { title, cells };
  if (sessionId) payload.session_id = sessionId;
  const res = await api.put(`${BASE}/${notebookId}`, payload);
  return res.data;
}

export async function deleteNotebook(notebookId: string): Promise<void> {
  await api.delete(`${BASE}/${notebookId}`);
}

export async function runCell(
  notebookId: string,
  cell: NotebookCell
): Promise<{ result: any; result_type: string; error: string | null }> {
  const res = await api.post(`${BASE}/${notebookId}/run-cell`, {
    cell_id: cell.id,
    cell_type: cell.type,
    content: cell.content,
  });
  return res.data;
}
