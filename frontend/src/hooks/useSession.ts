import { useState, useCallback } from 'react';
import api from '../services/api';
import { DatasetMeta, StoryCard } from '../types/index';

export const useSession = () => {
  const [sessionId, setSessionId] = useState<string | null>(localStorage.getItem('datalens_session_id'));
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [metricDict, setMetricDict] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<Record<string, any>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [precomputedInsights, setPrecomputedInsights] = useState<StoryCard[]>([]);

  const fetchSessions = async () => {
    try {
      const res = await api.get('/api/sessions');
      setAllSessions(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSession = async (id: string) => {
    try {
      const res = await api.get(`/api/sessions/${id}`);
      setSessionId(id);
      localStorage.setItem('datalens_session_id', id);
      // Restore dataset meta so the chat UI shows instead of uploader
      if (res.data?.dataset_meta) {
        setMeta(res.data.dataset_meta);
      }
      return res.data;
    } catch (e) {
      console.error('Failed to load session');
    }
  };

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted < 50 ? percentCompleted : 50 + (percentCompleted / 2));
          }
        }
      });
      
      setUploadProgress(100);
      const newSessionId = res.data.session_id;
      setSessionId(newSessionId);
      localStorage.setItem('datalens_session_id', newSessionId);
      
      setMeta(res.data.dataset_meta);
      setMetricDict(res.data.metric_dictionary);
      setProfile(res.data.profile);
      setSuggestedQuestions(res.data.suggested_questions || []);
      setPrecomputedInsights(res.data.precomputed_insights || []);
      
      await fetchSessions();
      
      setIsUploading(false);
      return res.data;
    } catch (err) {
      setIsUploading(false);
      throw err;
    }
  }, []);

  const resetSession = () => {
    setSessionId(null);
    setMeta(null);
    setPrecomputedInsights([]);
    localStorage.removeItem('datalens_session_id');
  };

  return { 
    sessionId, meta, metricDict, profile, uploadFile, isUploading, 
    uploadProgress, resetSession, suggestedQuestions, setSuggestedQuestions,
    allSessions, fetchSessions, loadSession, precomputedInsights
  };
};
