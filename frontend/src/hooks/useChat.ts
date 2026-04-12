import { useState } from 'react';
import { Message } from '../types/index';
import api from '../services/api';

export const useChat = (sessionId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const setInitialMessages = (msgs: Message[]) => {
    setMessages(msgs);
  };

  const sendMessage = async (question: string) => {
    if (!sessionId || !question.trim()) return;

    const userMsg: Message = { role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await api.post('/api/query', { session_id: sessionId, question });
      
      const assistantMsg: Message = {
        role: 'assistant',
        content: res.data.answer,
        sql: res.data.sql,
        chart_type: res.data.chart_type,
        chart_data: res.data.chart_data,
        confidence: res.data.confidence,
        columns_used: res.data.columns_used,
        intent: res.data.intent
      };
      
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.response?.data?.detail || "An error occurred fetching the insight."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => setMessages([]);

  return { messages, sendMessage, isLoading, clearChat, setInitialMessages };
};
