"""
PDF Report Generator — Uses matplotlib for charts and reportlab for PDF assembly.
Generates a professional PDF report with embedded chart images.
"""
import io
import os
import math
from datetime import datetime
from typing import Optional

import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image,
    Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY


# ── Color palette (matches frontend) ────────────────────────────────────────
CHART_COLORS = ['#7B4FAF', '#00A89A', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6']
CHART_BG_COLORS = [
    (123/255, 79/255, 175/255, 0.75),
    (0/255, 168/255, 154/255, 0.75),
    (245/255, 158/255, 11/255, 0.75),
    (239/255, 68/255, 68/255, 0.75),
    (59/255, 130/255, 246/255, 0.75),
    (139/255, 92/255, 246/255, 0.75),
]


def _render_chart_to_image(card: dict) -> Optional[bytes]:
    """Render a single chart card's data to a PNG image bytes using matplotlib."""
    chart_data = card.get("chart_data", [])
    chart_type = card.get("chart_type", "bar")

    if not chart_data or chart_type in ("none", "table"):
        return None

    keys = list(chart_data[0].keys())
    x_key = keys[0]
    y_keys = [k for k in keys[1:] if isinstance(chart_data[0].get(k), (int, float))]

    if not y_keys:
        return None

    labels = [str(d[x_key]) for d in chart_data]
    # Truncate long labels
    labels = [l[:18] + '…' if len(l) > 18 else l for l in labels]

    fig, ax = plt.subplots(figsize=(7, 3.5), dpi=150)
    fig.patch.set_facecolor('#ffffff')
    ax.set_facecolor('#fafafa')

    if chart_type == 'pie':
        values = [d.get(y_keys[0], 0) for d in chart_data]
        pie_colors = [CHART_COLORS[i % len(CHART_COLORS)] for i in range(len(values))]
        wedges, texts, autotexts = ax.pie(
            values, labels=labels, autopct='%1.1f%%',
            colors=pie_colors, startangle=90,
            textprops={'fontsize': 8}
        )
        for t in autotexts:
            t.set_fontsize(7)
            t.set_color('#333')
        ax.set_title(card.get("headline", ""), fontsize=10, fontweight='bold', pad=12, color='#1f2937')

    elif chart_type == 'line':
        x = np.arange(len(labels))
        for i, yk in enumerate(y_keys[:3]):
            values = [d.get(yk, 0) for d in chart_data]
            color = CHART_COLORS[i % len(CHART_COLORS)]
            ax.plot(x, values, marker='o', markersize=4, linewidth=2, label=yk.replace('_', ' '), color=color)

        ax.set_xticks(x)
        ax.set_xticklabels(labels, rotation=35, ha='right', fontsize=7)
        ax.tick_params(axis='y', labelsize=7)
        ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda v, _: f'{v:,.0f}'))
        ax.legend(fontsize=7, framealpha=0.8)
        ax.grid(axis='y', alpha=0.3, linestyle='--')
        ax.set_title(card.get("headline", ""), fontsize=10, fontweight='bold', pad=10, color='#1f2937')

    else:  # bar (default)
        x = np.arange(len(labels))
        width = 0.7 / len(y_keys)
        for i, yk in enumerate(y_keys[:3]):
            values = [d.get(yk, 0) for d in chart_data]
            color = CHART_COLORS[i % len(CHART_COLORS)]
            offset = (i - len(y_keys) / 2 + 0.5) * width
            bars = ax.bar(x + offset, values, width, label=yk.replace('_', ' '), color=color, alpha=0.85, edgecolor='white', linewidth=0.5)

        ax.set_xticks(x)
        ax.set_xticklabels(labels, rotation=35, ha='right', fontsize=7)
        ax.tick_params(axis='y', labelsize=7)
        ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda v, _: f'{v:,.0f}'))
        if len(y_keys) > 1:
            ax.legend(fontsize=7, framealpha=0.8)
        ax.grid(axis='y', alpha=0.3, linestyle='--')
        ax.set_title(card.get("headline", ""), fontsize=10, fontweight='bold', pad=10, color='#1f2937')

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_alpha(0.3)
    ax.spines['bottom'].set_alpha(0.3)

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight', facecolor='#ffffff')
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def _build_table_data(card: dict) -> list[list[str]]:
    """Convert chart_data to a list of lists for reportlab Table."""
    chart_data = card.get("chart_data", [])
    if not chart_data:
        return []
    keys = list(chart_data[0].keys())
    header = [k.replace('_', ' ').title() for k in keys]
    rows = [header]
    for row in chart_data[:15]:
        r = []
        for k in keys:
            v = row.get(k)
            if isinstance(v, float):
                r.append(f'{v:,.2f}')
            elif isinstance(v, int):
                r.append(f'{v:,}')
            else:
                r.append(str(v) if v is not None else '—')
        rows.append(r)
    return rows


def _strip_markdown(text: str) -> str:
    """Strip markdown formatting for plain paragraph text."""
    import re
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'`(.+?)`', r'\1', text)
    return text


def generate_report_pdf(report: dict) -> bytes:
    """Generate a professional PDF report with charts and return as bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=20*mm,
        bottomMargin=15*mm,
        leftMargin=18*mm,
        rightMargin=18*mm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'ReportTitle', parent=styles['Title'],
        fontSize=22, leading=26,
        textColor=colors.HexColor('#42145f'),
        spaceAfter=6,
        fontName='Helvetica-Bold',
    )
    subtitle_style = ParagraphStyle(
        'ReportSubtitle', parent=styles['Normal'],
        fontSize=10, leading=14,
        textColor=colors.HexColor('#6b7280'),
        spaceAfter=16,
    )
    section_style = ParagraphStyle(
        'SectionHead', parent=styles['Heading2'],
        fontSize=14, leading=18,
        textColor=colors.HexColor('#6d28d9'),
        spaceAfter=8, spaceBefore=16,
        fontName='Helvetica-Bold',
    )
    body_style = ParagraphStyle(
        'ReportBody', parent=styles['Normal'],
        fontSize=10, leading=15,
        textColor=colors.HexColor('#374151'),
        spaceAfter=8,
        alignment=TA_JUSTIFY,
    )
    chart_title_style = ParagraphStyle(
        'ChartTitle', parent=styles['Heading3'],
        fontSize=11, leading=14,
        textColor=colors.HexColor('#1f2937'),
        spaceAfter=4, spaceBefore=12,
        fontName='Helvetica-Bold',
    )

    elements = []
    metadata = report.get("metadata", {})
    date_str = datetime.now().strftime("%d %B %Y")

    # ── Title ──
    elements.append(Paragraph("📊 DataLens AI Report", title_style))
    meta_text = (
        f'{metadata.get("total_rows", 0):,} Rows · '
        f'{metadata.get("total_columns", 0)} Columns · '
        f'{len(report.get("insights", []))} Charts · '
        f'{date_str}'
    )
    elements.append(Paragraph(meta_text, subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceAfter=12))

    # ── Executive Summary ──
    elements.append(Paragraph("✨ Executive Summary", section_style))
    narrative = report.get("narrative", "")
    if narrative:
        # Split into paragraphs
        for para in narrative.split('\n\n'):
            clean = _strip_markdown(para.strip())
            if clean:
                elements.append(Paragraph(clean, body_style))
    else:
        elements.append(Paragraph("No executive summary available.", body_style))

    elements.append(Spacer(1, 8))

    # ── Chart Insights ──
    insights = report.get("insights", [])
    if insights:
        elements.append(Paragraph("📊 Analytical Insights", section_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e2e8f0'), spaceAfter=8))

        for i, card in enumerate(insights):
            headline = card.get("headline", f"Insight {i+1}")
            explanation = card.get("explanation", "")
            chart_type = card.get("chart_type", "bar")

            elements.append(Paragraph(f"{'▸'} {headline}", chart_title_style))
            if explanation:
                elements.append(Paragraph(explanation, body_style))

            if chart_type == 'table':
                table_data = _build_table_data(card)
                if table_data:
                    t = Table(table_data, repeatRows=1)
                    t.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f8fafc')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#374151')),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, -1), 8),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
                        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
                        ('TOPPADDING', (0, 0), (-1, -1), 4),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ]))
                    elements.append(t)
            else:
                # Render chart as image
                img_bytes = _render_chart_to_image(card)
                if img_bytes:
                    img_buf = io.BytesIO(img_bytes)
                    img = Image(img_buf, width=6.5*inch, height=3.0*inch)
                    elements.append(img)

            elements.append(Spacer(1, 10))

    # ── Footer ──
    elements.append(Spacer(1, 16))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e2e8f0'), spaceAfter=8))
    footer_style = ParagraphStyle(
        'Footer', parent=styles['Normal'],
        fontSize=8, textColor=colors.HexColor('#94a3b8'),
        alignment=TA_CENTER,
    )
    elements.append(Paragraph(f"Generated by DataLens · AI-Powered Analytics Platform · {date_str}", footer_style))

    doc.build(elements)
    buf.seek(0)
    return buf.read()
