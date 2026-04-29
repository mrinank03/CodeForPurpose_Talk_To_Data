import React, { useState } from 'react';
import { ReportData, AnomalyAlert, ColumnStat, StoryCard as StoryCardType } from '../../types/index';
import { MiniChart } from '../Charts/MiniChart';
import { EmailModal } from './EmailModal';
import api from '../../services/api';

interface Props {
  report: ReportData;
  sessionId: string;
  prompt: string;
  onClose: () => void;
}

const ACCENT_COLORS = [
  'from-purple-500 to-indigo-600',
  'from-teal-400 to-emerald-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
  'from-sky-400 to-blue-500',
];

export const ReportView: React.FC<Props> = ({ report, sessionId, prompt, onClose }) => {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleDownload = () => {
    const htmlContent = buildPrintHtml(report);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(htmlContent);
    win.document.close();
    win.addEventListener('load', () => {
      setTimeout(() => {
        win.focus();
        win.print();
      }, 500);
    });
  };

  const handleEmail = async (email: string) => {
    setIsSending(true);
    setEmailStatus(null);
    try {
      await api.post('/api/report/email', {
        session_id: sessionId,
        prompt: prompt,
        recipient_email: email,
      });
      setEmailStatus({ type: 'success', msg: `Report sent to ${email}` });
      setTimeout(() => setShowEmailModal(false), 1500);
    } catch (e: any) {
      setEmailStatus({ type: 'error', msg: e.response?.data?.detail || 'Failed to send email' });
    } finally {
      setIsSending(false);
    }
  };

  const highAnomalies = report.anomalies.filter(a => a.severity === 'high');
  const mediumAnomalies = report.anomalies.filter(a => a.severity === 'medium');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-natwest-primary to-natwest-teal flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold font-display text-base text-white">AI Report</h3>
            <p className="text-white/30 text-[10px]">{report.metadata.total_rows.toLocaleString()} rows · {report.metadata.total_columns} columns</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white/60 hover:text-white transition-all flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download
          </button>
          {/* Email Button */}
          <button
            onClick={() => setShowEmailModal(true)}
            className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-all flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email
          </button>
          {/* Close */}
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors ml-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pb-6 pr-1">

        {/* ── Anomaly Alerts ── */}
        {report.anomalies.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-red-400 text-xs font-bold">⚠️ {report.anomalies.length} Anomal{report.anomalies.length === 1 ? 'y' : 'ies'} Detected</span>
            </div>
            {highAnomalies.map((a, i) => (
              <AnomalyCard key={`h-${i}`} alert={a} />
            ))}
            {mediumAnomalies.map((a, i) => (
              <AnomalyCard key={`m-${i}`} alert={a} />
            ))}
          </div>
        )}

        {report.anomalies.length === 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2">
            <span className="text-emerald-400 text-sm">✅</span>
            <span className="text-emerald-300 text-xs font-medium">No anomalies detected — data looks clean</span>
          </div>
        )}

        {/* ── Executive Summary ── */}
        <div className="bg-[#151020] border border-white/10 rounded-xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-natwest-primary to-natwest-teal" />
          <div className="p-4">
            <h4 className="font-bold font-display text-white text-sm mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-natwest-tealLight" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Executive Summary
            </h4>
            <p className="text-white/60 text-[12px] leading-relaxed [&_strong]:text-white [&_strong]:font-semibold [&_ul]:pl-4 [&_li]:mb-1 [&_p]:mb-2"
               dangerouslySetInnerHTML={{ __html: markdownToHtml(report.narrative) }} />
          </div>
        </div>

        {/* ── Statistical Summary ── */}
        <div className="bg-[#151020] border border-white/10 rounded-xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-sky-400 to-blue-500" />
          <div className="p-4">
            <h4 className="font-bold font-display text-white text-sm mb-3">📈 Statistical Summary</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-white/40 border-b border-white/5">
                    <th className="text-left py-2 px-2 font-medium">Column</th>
                    <th className="text-right py-2 px-2 font-medium">Min</th>
                    <th className="text-right py-2 px-2 font-medium">Max</th>
                    <th className="text-right py-2 px-2 font-medium">Mean</th>
                    <th className="text-right py-2 px-2 font-medium">Median</th>
                    <th className="text-right py-2 px-2 font-medium">Nulls</th>
                  </tr>
                </thead>
                <tbody>
                  {report.summary.filter(s => s.type === 'numeric').map((s, i) => (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="py-2 px-2 text-white font-medium">{s.display_name}</td>
                      <td className="py-2 px-2 text-right text-white/50">{s.min?.toLocaleString() ?? '—'}</td>
                      <td className="py-2 px-2 text-right text-white/50">{s.max?.toLocaleString() ?? '—'}</td>
                      <td className="py-2 px-2 text-right text-white/50">{s.mean?.toLocaleString() ?? '—'}</td>
                      <td className="py-2 px-2 text-right text-white/50">{s.median?.toLocaleString() ?? '—'}</td>
                      <td className="py-2 px-2 text-right text-white/30">{s.null_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Categorical columns */}
            {report.summary.filter(s => s.type === 'categorical').length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Categorical Columns</p>
                {report.summary.filter(s => s.type === 'categorical').map((s, i) => (
                  <div key={i} className="bg-white/[0.02] rounded-lg p-2.5">
                    <span className="text-white text-[11px] font-medium">{s.display_name}</span>
                    <span className="text-white/30 text-[10px] ml-2">{s.unique_count} unique values</span>
                    {s.top_values && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {Object.entries(s.top_values).slice(0, 5).map(([val, count]) => (
                          <span key={val} className="text-[9px] bg-white/5 text-white/40 px-1.5 py-0.5 rounded">
                            {val} ({count})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Chart Insights ── */}
        {report.insights.map((card, i) => (
          <div key={i} className="bg-[#151020] border border-white/10 rounded-xl overflow-hidden">
            <div className={`h-1 w-full bg-gradient-to-r ${ACCENT_COLORS[i % ACCENT_COLORS.length]}`} />
            <div className="p-4">
              <h4 className="font-bold font-display text-white text-sm mb-1">{card.headline}</h4>
              <p className="text-[11px] text-white/50 mb-3">{card.explanation}</p>
              <div className="bg-black/20 rounded-lg p-2 min-h-[120px] flex items-center justify-center">
                <MiniChart type={card.chart_type} data={card.chart_data} />
              </div>
            </div>
          </div>
        ))}


      </div>

      {/* Email success/error toast */}
      {emailStatus && (
        <div className={`fixed bottom-6 right-6 z-[70] px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          emailStatus.type === 'success'
            ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
            : 'bg-red-500/20 border border-red-500/30 text-red-300'
        }`}>
          {emailStatus.msg}
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <EmailModal
          onClose={() => { setShowEmailModal(false); setEmailStatus(null); }}
          onSend={handleEmail}
          isSending={isSending}
        />
      )}
    </div>
  );
};


/* ── Anomaly Card Sub-component ── */
const AnomalyCard: React.FC<{ alert: AnomalyAlert }> = ({ alert }) => {
  const isHigh = alert.severity === 'high';
  return (
    <div className={`rounded-xl p-3 border ${
      isHigh
        ? 'bg-red-500/[0.07] border-red-500/20'
        : 'bg-amber-500/[0.07] border-amber-500/20'
    }`}>
      <div className="flex items-start gap-2">
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
          isHigh ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
        }`}>
          {isHigh ? '🔴 HIGH' : '🟡 MEDIUM'}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium ${isHigh ? 'text-red-300' : 'text-amber-300'}`}>
            {alert.message}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">
            {alert.method} · Column: {alert.column}
          </p>
        </div>
      </div>
    </div>
  );
};


/* ── Beautiful Print/PDF Builder ── */

function markdownToHtml(text: string): string {
  if (!text) return '';
  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map(para => {
    const lines = para.split('\n');
    const isBulletBlock = lines.every(l => l.trim().startsWith('* ') || l.trim().startsWith('- ') || l.trim() === '');
    if (isBulletBlock && lines.some(l => l.trim().startsWith('* ') || l.trim().startsWith('- '))) {
      const items = lines
        .filter(l => l.trim().startsWith('* ') || l.trim().startsWith('- '))
        .map(l => {
          const content = l.trim().slice(2);
          return `<li style="margin-bottom:6px;">${renderInline(content)}</li>`;
        }).join('');
      return `<ul style="margin:0 0 4px 0;padding-left:20px;">${items}</ul>`;
    }
    const joined = lines.join(' ');
    // Section headings like "Key Findings:"
    if (/^[A-Z][^a-z]*:$/.test(joined.trim()) || /^(Key Findings|Actionable Insights|Executive Summary|Summary|Recommendations?|Overview|Analysis):?$/i.test(joined.trim())) {
      return `<p style="font-weight:700;color:#42145f;margin:12px 0 4px;font-size:13px;">${renderInline(joined)}</p>`;
    }
    return `<p style="margin:0 0 10px;">${renderInline(joined)}</p>`;
  }).join('');
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f3f4f6;padding:1px 4px;border-radius:3px;font-family:monospace;">$1</code>');
}

function buildPrintHtml(report: ReportData): string {
  const date = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

  const anomalyRows = report.anomalies.map(a => {
    const color = a.severity === 'high' ? '#dc2626' : '#d97706';
    const bg = a.severity === 'high' ? '#fef2f2' : '#fffbeb';
    return `<tr style="background:${bg};">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
        <span style="background:${color};color:#fff;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;text-transform:uppercase;">${a.severity}</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${a.column}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${a.message}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:11px;">${a.method}</td>
    </tr>`;
  }).join('');

  const statsRows = report.summary.filter(s => s.type === 'numeric').map(s => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#1f2937;">${s.display_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${s.min?.toLocaleString() ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${s.max?.toLocaleString() ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#4f46e5;">${s.mean?.toLocaleString() ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${s.median?.toLocaleString() ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${s.std_dev?.toLocaleString() ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:${(s.null_pct ?? 0) > 10 ? '#dc2626':'#6b7280'};">${s.null_pct}%</td>
    </tr>`).join('');



  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>DataLens AI Report — ${date}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #111827; background: #f1f5f9; font-size:13px; line-height:1.6; }
  .page { max-width: 860px; margin: 0 auto; padding: 32px 24px; }
  .page-header { background: linear-gradient(135deg,#42145f 0%,#6d28d9 60%,#0d9488 100%);
    border-radius:14px; color:white; padding:32px 36px; margin-bottom:24px; }
  .page-header h1 { font-size:26px; font-weight:700; margin-bottom:10px; }
  .badges { display:flex; gap:8px; flex-wrap:wrap; }
  .badge { background:rgba(255,255,255,0.18); border-radius:8px; padding:4px 14px;
    font-size:11px; font-weight:600; }
  .card { background:#fff; border:1px solid #e2e8f0; border-radius:12px;
    overflow:hidden; margin-bottom:20px; page-break-inside:avoid;
    box-shadow:0 1px 4px rgba(0,0,0,0.06); }
  .card-head { padding:14px 20px; border-bottom:1px solid #e2e8f0;
    display:flex; align-items:center; gap:10px; }
  .card-head.purple { background:#f5f3ff; }
  .card-head.red    { background:#fef2f2; }
  .card-head.blue   { background:#eff6ff; }
  .card-head.violet { background:#faf5ff; }
  .card-head.green  { background:#f0fdf4; }
  .card-title { font-size:14px; font-weight:700; }
  .card-title.purple { color:#6d28d9; }
  .card-title.red    { color:#dc2626; }
  .card-title.blue   { color:#1d4ed8; }
  .card-title.violet { color:#7c3aed; }
  .card-title.green  { color:#166534; }
  .card-body { padding:20px; }
  .narrative p { margin:0 0 10px; color:#374151; }
  .narrative ul { margin:0 0 10px 0; padding-left:20px; }
  .narrative li { margin-bottom:6px; color:#374151; }
  .narrative strong { color:#3b0764; font-weight:600; }
  .narrative p:last-child { margin-bottom:0; }
  .clean-table { width:100%; border-collapse:collapse; font-size:12px; }
  .clean-table thead th { padding:9px 12px; text-align:left; font-size:10px;
    font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.06em;
    border-bottom:2px solid #e5e7eb; background:#f8fafc; }
  .clean-table tbody td { padding:9px 12px; border-bottom:1px solid #f1f5f9; }
  .clean-table tbody tr:nth-child(even) td { background:#f8fafc; }
  .no-issue { color:#166534; font-weight:500; font-size:13px; }
  .footer { text-align:center; padding:20px 0 4px; color:#94a3b8; font-size:11px; }
  @media print {
    body { background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page { padding:0; max-width:100%; }
    .card { box-shadow:none; }
    .page-header,.card-head { -webkit-print-color-adjust:exact; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="page-header">
    <h1>📊 DataLens AI Report</h1>
    <div class="badges">
      <span class="badge">${report.metadata.total_rows.toLocaleString()} Rows</span>
      <span class="badge">${report.metadata.total_columns} Columns Analysed</span>
      <span class="badge">${report.anomalies.length} Anomalies</span>
      <span class="badge">${date}</span>
    </div>
  </div>

  <!-- Executive Summary Card -->
  <div class="card">
    <div class="card-head purple">
      <span>✨</span>
      <span class="card-title purple">Executive Summary</span>
    </div>
    <div class="card-body narrative">${markdownToHtml(report.narrative)}</div>
  </div>

  <!-- Anomaly Detection Card -->
  <div class="card">
    <div class="card-head ${report.anomalies.length > 0 ? 'red' : 'green'}">
      <span>${report.anomalies.length > 0 ? '⚠️' : '✅'}</span>
      <span class="card-title ${report.anomalies.length > 0 ? 'red' : 'green'}">
        Anomaly Detection — ${report.anomalies.length > 0
          ? report.anomalies.length + ' issue' + (report.anomalies.length > 1 ? 's' : '') + ' found'
          : 'All Clear'}
      </span>
    </div>
    <div class="card-body" style="padding:${report.anomalies.length > 0 ? '0' : '20px'};">
      ${report.anomalies.length > 0 ? `
      <table class="clean-table">
        <thead><tr>
          <th style="width:90px;">Severity</th>
          <th>Column / Metric</th>
          <th>Finding</th>
          <th style="width:150px;">Method</th>
        </tr></thead>
        <tbody>${anomalyRows}</tbody>
      </table>` : `<p class="no-issue">No anomalies detected — data looks clean and consistent.</p>`}
    </div>
  </div>

  <!-- Statistical Summary Card -->
  <div class="card">
    <div class="card-head blue">
      <span>📈</span>
      <span class="card-title blue">Statistical Summary</span>
    </div>
    <div class="card-body" style="padding:0;">
      <table class="clean-table">
        <thead><tr>
          <th>Column</th>
          <th style="text-align:right">Min</th><th style="text-align:right">Max</th>
          <th style="text-align:right">Mean</th><th style="text-align:right">Median</th>
          <th style="text-align:right">Std Dev</th><th style="text-align:right">Nulls %</th>
        </tr></thead>
        <tbody>${statsRows || '<tr><td colspan="7" style="padding:16px;text-align:center;color:#9ca3af;">No numeric columns selected</td></tr>'}</tbody>
      </table>
    </div>
  </div>

  <div class="footer">Generated by DataLens · AI-Powered Analytics Platform · ${date}</div>
</div>
</body>
</html>`;
}
