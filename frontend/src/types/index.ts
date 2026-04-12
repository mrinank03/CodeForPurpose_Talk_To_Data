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
