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
    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) return;
    win.document.write(htmlContent);
    win.document.close();
    // Wait for Chart.js CDN to load + charts to render, then print
    win.addEventListener('load', () => {
      setTimeout(() => {
        win.focus();
        win.print();
      }, 2000); // 2s delay to ensure Chart.js renders all canvases
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



        {/* ── Chart Insights ── */}
        {report.insights.filter(card => !card.headline?.includes('No data to narrate') && !card.explanation?.includes('No data to narrate')).map((card, i) => (
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

function buildChartJsConfig(card: any): { type: string; config: string } | null {
  if (!card.chart_data || card.chart_data.length === 0 || card.chart_type === 'none') return null;

  const keys = Object.keys(card.chart_data[0]);
  const xKey = keys[0];
  const yKeys = keys.slice(1).filter(k => typeof card.chart_data[0][k] === 'number');
  if (yKeys.length === 0 && card.chart_type !== 'table') return null;

  const labels = card.chart_data.map((d: any) => String(d[xKey]));
  const COLORS = ['#7B4FAF', '#00A89A', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];
  const BG_COLORS = ['rgba(123,79,175,0.7)', 'rgba(0,168,154,0.7)', 'rgba(245,158,11,0.7)', 'rgba(239,68,68,0.7)', 'rgba(59,130,246,0.7)', 'rgba(139,92,246,0.7)'];

  if (card.chart_type === 'table') {
    return { type: 'table', config: '' };
  }

  if (card.chart_type === 'pie') {
    const yKey = yKeys[0];
    const data = card.chart_data.map((d: any) => d[yKey]);
    const config = JSON.stringify({
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: BG_COLORS.slice(0, data.length),
          borderColor: COLORS.slice(0, data.length),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 11, family: 'Inter' }, color: '#374151' } }
        }
      }
    });
    return { type: 'pie', config };
  }

  // bar or line
  const datasets = yKeys.map((yKey, i) => ({
    label: yKey.replace(/_/g, ' '),
    data: card.chart_data.map((d: any) => d[yKey]),
    backgroundColor: BG_COLORS[i % BG_COLORS.length],
    borderColor: COLORS[i % COLORS.length],
    borderWidth: 2,
    borderRadius: card.chart_type === 'bar' ? 4 : 0,
    tension: 0.3,
    fill: false,
    pointRadius: card.chart_type === 'line' ? 4 : 0,
    pointBackgroundColor: '#fff',
  }));

  const config = JSON.stringify({
    type: card.chart_type === 'line' ? 'line' : 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { font: { size: 10, family: 'Inter' }, color: '#6b7280', maxRotation: 45 }, grid: { display: false } },
        y: { ticks: { font: { size: 10, family: 'Inter' }, color: '#6b7280' }, grid: { color: '#f1f5f9' }, beginAtZero: true }
      },
      plugins: {
        legend: { labels: { font: { size: 11, family: 'Inter' }, color: '#374151' } }
      }
    }
  });
  return { type: card.chart_type, config };
}

function buildTableHtml(card: any): string {
  if (!card.chart_data || card.chart_data.length === 0) return '';
  const keys = Object.keys(card.chart_data[0]);
  const headerCells = keys.map(k => `<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e5e7eb;background:#f8fafc;">${k.replace(/_/g, ' ')}</th>`).join('');
  const bodyRows = card.chart_data.slice(0, 20).map((row: any, i: number) => {
    const cells = keys.map(k => `<td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;${typeof row[k] === 'number' ? 'text-align:right;' : ''}">${row[k] != null ? (typeof row[k] === 'number' ? Number(row[k]).toLocaleString() : String(row[k])) : '—'}</td>`).join('');
    return `<tr${i % 2 === 1 ? ' style="background:#f8fafc;"' : ''}>${cells}</tr>`;
  }).join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:12px;font-family:'Inter',Arial,sans-serif;"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function buildPrintHtml(report: ReportData): string {
  const date = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

  // Build insight chart cards
  const ACCENT_BORDERS = ['#7B4FAF', '#00A89A', '#F59E0B', '#EF4444', '#3B82F6'];
  const validInsights = report.insights.filter(card => !card.headline?.includes('No data to narrate') && !card.explanation?.includes('No data to narrate'));
  
  const chartCards = validInsights.map((card, i) => {
    const chartInfo = buildChartJsConfig(card);
    const borderColor = ACCENT_BORDERS[i % ACCENT_BORDERS.length];

    let chartContent = '';
    if (chartInfo && chartInfo.type === 'table') {
      chartContent = buildTableHtml(card);
    } else if (chartInfo) {
      chartContent = `<div style="height:280px;padding:8px;"><canvas id="chart-${i}"></canvas></div>`;
    } else {
      chartContent = '<p style="color:#9ca3af;text-align:center;padding:20px;">No chart data available</p>';
    }

    return `
    <div class="card">
      <div style="height:4px;background:${borderColor};"></div>
      <div class="card-head" style="background:#faf5ff;">
        <span>📊</span>
        <span class="card-title" style="color:${borderColor};">${card.headline || 'Chart Insight'}</span>
      </div>
      <div class="card-body">
        ${card.explanation ? `<p style="font-size:12px;color:#6b7280;margin-bottom:12px;">${card.explanation}</p>` : ''}
        ${chartContent}
      </div>
    </div>`;
  }).join('');

  // Build Chart.js initialization script
  const chartScripts = validInsights.map((card, i) => {
    const chartInfo = buildChartJsConfig(card);
    if (!chartInfo || chartInfo.type === 'table') return '';
    return `
      (function() {
        var ctx = document.getElementById('chart-${i}');
        if (ctx) { new Chart(ctx, ${chartInfo.config}); }
      })();`;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>DataLens AI Report — ${date}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"><\/script>
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
  .card-head.green  { background:#f0fdf4; }
  .card-title { font-size:14px; font-weight:700; }
  .card-title.purple { color:#6d28d9; }
  .card-title.green  { color:#166534; }
  .card-body { padding:20px; }
  .narrative p { margin:0 0 10px; color:#374151; }
  .narrative ul { margin:0 0 10px 0; padding-left:20px; }
  .narrative li { margin-bottom:6px; color:#374151; }
  .narrative strong { color:#3b0764; font-weight:600; }
  .narrative p:last-child { margin-bottom:0; }
  .no-issue { color:#166534; font-weight:500; font-size:13px; }
  .footer { text-align:center; padding:20px 0 4px; color:#94a3b8; font-size:11px; }
  @media print {
    body { background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page { padding:0; max-width:100%; }
    .card { box-shadow:none; }
    .page-header,.card-head { -webkit-print-color-adjust:exact; }
    canvas { max-width:100% !important; }
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
      <span class="badge">${report.insights.length} Charts</span>
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

  <!-- Chart Insight Cards -->
  ${chartCards}

  <div class="footer">Generated by DataLens · AI-Powered Analytics Platform · ${date}</div>
</div>

<script>
  window.addEventListener('load', function() {
    ${chartScripts}
  });
<\/script>
</body>
</html>`;
}
