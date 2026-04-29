import { useState } from 'react';
import { StoryCard, ReportData } from '../types/index';
import api from '../services/api';

export const useStory = (sessionId: string | null, precomputedInsights: StoryCard[] = []) => {
  const [cards, setCards] = useState<StoryCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Report state
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportPrompt, setReportPrompt] = useState<string>('');
  const [reportError, setReportError] = useState<string | null>(null);

  const runStory = async () => {
    if (!sessionId) {
      console.warn('[useStory] No sessionId, aborting.');
      return;
    }

    setIsLoading(true);

    // Path A: Use precomputed insights if available (instant)
    if (precomputedInsights && precomputedInsights.length > 0) {
      console.log('[useStory] Using precomputed insights:', precomputedInsights.length, 'cards');
      setCards(precomputedInsights);
      setIsLoading(false);
      return;
    }

    // Path B: Fallback — call backend API (for page reloads / old sessions)
    console.log('[useStory] No precomputed insights, calling /api/story for session:', sessionId);
    try {
      const res = await api.post('/api/story', { session_id: sessionId });
      console.log('[useStory] API returned', res.data?.length || 0, 'cards');
      setCards(res.data || []);
    } catch (err) {
      console.error('[useStory] API call failed:', err);
      setCards([]);
    } finally {
      setIsLoading(false);
    }
  };

  const runReport = async (prompt: string) => {
    if (!sessionId) {
      console.warn('[useStory] No sessionId for report, aborting.');
      return;
    }

    setIsReportLoading(true);
    setReportError(null);
    setReportPrompt(prompt);
    console.log('[useStory] Generating report for prompt:', prompt);

    try {
      const res = await api.post('/api/report', {
        session_id: sessionId,
        prompt: prompt,
      });
      console.log('[useStory] Report generated:', res.data);
      setReportData(res.data);
    } catch (err: any) {
      console.error('[useStory] Report generation failed:', err);
      setReportError(err.response?.data?.detail || err.message || 'Failed to generate report');
      setReportData(null);
    } finally {
      setIsReportLoading(false);
    }
  };

  const clearStory = () => {
    setCards([]);
    setReportData(null);
    setReportPrompt('');
    setReportError(null);
  };

  return {
    cards, runStory, isLoading, clearStory,
    reportData, runReport, isReportLoading, reportPrompt, reportError,
  };
};
