import { useState, useCallback } from 'react';
import api from '../services/api';
import { DatasetMeta, StoryCard } from '../types/index';

const SESSIONS_KEY = 'datalens_my_sessions';   // array of session IDs owned by this browser
const ACTIVE_KEY = 'datalens_session_id';        // currently active session

// --- localStorage helpers for per-user session list ---
function getMySessionIds(): string[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function addMySessionId(id: string) {
  const ids = getMySessionIds();
  if (!ids.includes(id)) {
    ids.unshift(id);                // newest first
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(ids));
  }
}

function removeMySessionId(id: string) {
  const ids = getMySessionIds().filter(x => x !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(ids));
}

export const useSession = () => {
  const [sessionId, setSessionId] = useState<string | null>(localStorage.getItem(ACTIVE_KEY));
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [metricDict, setMetricDict] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<Record<string, any>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [precomputedInsights, setPrecomputedInsights] = useState<StoryCard[]>([]);

  // Fetch ONLY sessions that belong to this browser (stored in localStorage)
  const fetchSessions = async () => {
    const myIds = getMySessionIds();
    if (myIds.length === 0) { setAllSessions([]); return; }

    try {
      // Fetch all sessions from the backend, then filter to only our IDs
      const res = await api.get('/api/sessions');
      const allBackend: any[] = res.data || [];
      const mine = allBackend.filter((s: any) => myIds.includes(s.id));

      // Clean up any stale IDs that no longer exist on the backend
      const backendIds = new Set(mine.map((s: any) => s.id));
      const cleaned = myIds.filter(id => backendIds.has(id));
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(cleaned));

      setAllSessions(mine);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSession = async (id: string) => {
    try {
      const res = await api.get(`/api/sessions/${id}`);
      setSessionId(id);
      localStorage.setItem(ACTIVE_KEY, id);
      if (res.data?.dataset_meta) {
        setMeta(res.data.dataset_meta);
      }
      return res.data;
    } catch (e) {
      console.error('Failed to load session');
    }
  };

  const uploadFile = useCallback(async (file: File, trackAsChat: boolean = true) => {
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
      
      if (trackAsChat) {
        setSessionId(newSessionId);
        localStorage.setItem(ACTIVE_KEY, newSessionId);
        addMySessionId(newSessionId);           // <-- track in localStorage
        
        setMeta(res.data.dataset_meta);
        setMetricDict(res.data.metric_dictionary);
        setProfile(res.data.profile);
        setSuggestedQuestions(res.data.suggested_questions || []);
        setPrecomputedInsights(res.data.precomputed_insights || []);
        
        await fetchSessions();
      }
      
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
    localStorage.removeItem(ACTIVE_KEY);
  };

  // Activate a session by ID without loading from the API (used by DB connector)
  const activateSession = (id: string, trackAsChat: boolean = true) => {
    setSessionId(id);
    if (trackAsChat) {
      localStorage.setItem(ACTIVE_KEY, id);
      addMySessionId(id);                       // <-- track in localStorage
    }
  };

  // Delete a session and remove from local tracking
  const deleteSession = async (id: string) => {
    try {
      await api.delete(`/api/sessions/${id}`);
    } catch (e) {
      console.error('Failed to delete session on server', e);
    }
    removeMySessionId(id);
    if (sessionId === id) resetSession();
    await fetchSessions();
  };

  const updateSession = async (id: string, updates: { is_starred?: boolean; is_archived?: boolean }) => {
    try {
      await api.patch(`/api/sessions/${id}`, updates);
      setAllSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    } catch (e) {
      console.error('Failed to update session', e);
    }
  };

  return { 
    sessionId, meta, metricDict, profile, uploadFile, isUploading, 
    uploadProgress, resetSession, suggestedQuestions, setSuggestedQuestions,
    allSessions, fetchSessions, loadSession, precomputedInsights, activateSession,
    deleteSession, updateSession
  };
};
