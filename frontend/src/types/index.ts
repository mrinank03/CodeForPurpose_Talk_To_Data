export interface DatasetMeta {
  row_count: number;
  col_count: number;
  columns: string[];
  column_types: Record<string, string>;
  head: any[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  chart_type?: string;
  chart_data?: any[];
  confidence?: string;
  columns_used?: string[];
  intent?: string;
}

export interface StoryCard {
  headline: string;
  explanation: string;
  sql: string;
  chart_type: string;
  chart_data: any[];
  drill_in_question: string;
}

export interface SessionDetail {
  metadata: any;
  messages: Message[];
}

export interface AnomalyAlert {
  severity: 'high' | 'medium';
  type: string;
  column: string;
  message: string;
  values: (number | string)[];
  method: string;
}

export interface ColumnStat {
  column: string;
  display_name: string;
  total_rows: number;
  null_count: number;
  null_pct: number;
  unique_count: number;
  type: 'numeric' | 'categorical';
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std_dev?: number;
  sum?: number;
  top_values?: Record<string, number>;
}

export interface ReportData {
  metadata: {
    total_rows: number;
    total_columns: number;
    columns_analyzed: string[];
  };
  summary: ColumnStat[];
  anomalies: AnomalyAlert[];
  insights: StoryCard[];
  narrative: string;
}
