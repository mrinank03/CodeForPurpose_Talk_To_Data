export type CellType = 'text' | 'prompt' | 'code';

export interface NotebookCell {
  id: string;
  type: CellType;
  content: string;
  result?: any;
  result_type?: 'table' | 'chart' | 'text' | null;
}

export interface Notebook {
  id: string;
  session_id?: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  cells: NotebookCell[];
}

export interface NotebookSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  cell_count: number;
}
