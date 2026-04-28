"""
Email service — supports two providers:
  1. Resend (preferred, API-key based, no SMTP fiddling)
  2. SMTP fallback (Gmail, etc.)

Setup for Resend (recommended):
  1. Sign up at https://resend.com — it's free (100 emails/day)
  2. Get your API key from the dashboard
  3. Add to backend/.env:
       RESEND_API_KEY=re_xxxxxxxxxxxx
       EMAIL_FROM=onboarding@resend.dev   ← use this until you verify a domain

Setup for SMTP fallback:
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your@gmail.com
  SMTP_PASSWORD=your-app-password
  SMTP_FROM=your@gmail.com
"""
import os
import re
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()


def _render_inline(text: str) -> str:
    """Convert inline markdown (**bold**, *italic*) to HTML."""
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    return text


def _markdown_to_html(text: str) -> str:
    """Convert LLM markdown narrative to clean HTML for email/PDF."""
    if not text:
        return ''
    paragraphs = re.split(r'\n\n+', text.strip())
    html_parts = []
    for para in paragraphs:
        lines = para.split('\n')
        bullet_lines = [l for l in lines if l.strip().startswith('* ') or l.strip().startswith('- ')]
        if bullet_lines and all(
            l.strip().startswith('* ') or l.strip().startswith('- ') or l.strip() == ''
            for l in lines
        ):
            items = ''.join(
                f'<li style="margin-bottom:6px;">{_render_inline(l.strip()[2:])}</li>'
                for l in bullet_lines
            )
            html_parts.append(f'<ul style="margin:0 0 8px 0;padding-left:20px;">{items}</ul>')
        else:
            joined = ' '.join(lines)
            heading_pattern = re.compile(
                r'^(Key Findings|Actionable Insights|Executive Summary|Summary|'
                r'Recommendations?|Overview|Analysis|Key Metrics|Conclusion):?\s*$',
                re.IGNORECASE
            )
            if heading_pattern.match(joined.strip()):
                html_parts.append(
                    f'<p style="font-weight:700;color:#42145f;margin:14px 0 4px;font-size:13px;">'
                    f'{_render_inline(joined)}</p>'
                )
            else:
                html_parts.append(f'<p style="margin:0 0 10px;">{_render_inline(joined)}</p>')
    return ''.join(html_parts)


def send_report_email(recipient: str, subject: str, html_body: str) -> dict:
    """
    Send an HTML email. Tries Resend first, falls back to SMTP.
    Returns {"success": True/False, "message": "..."}.
    """
    resend_key = os.getenv("RESEND_API_KEY")

    if resend_key:
        return _send_via_resend(resend_key, recipient, subject, html_body)
    else:
        return _send_via_smtp(recipient, subject, html_body)


# ── Resend (API-key based, no SMTP) ──────────────────────────────────────────

def _send_via_resend(api_key: str, recipient: str, subject: str, html_body: str) -> dict:
    try:
        import resend
        resend.api_key = api_key
        from_addr = os.getenv("EMAIL_FROM", "DataLens <onboarding@resend.dev>")

        params = {
            "from": from_addr,
            "to": [recipient],
            "subject": subject,
            "html": html_body,
        }
        email = resend.Emails.send(params)
        print(f"[EmailService] Resend: sent to {recipient} → id={email.get('id')}")
        return {"success": True, "message": f"Report sent to {recipient}"}

    except Exception as e:
        error_msg = str(e)
        print(f"[EmailService] Resend failed: {error_msg}")
        # Fall through to SMTP if Resend fails
        return _send_via_smtp(recipient, subject, html_body, resend_error=error_msg)


# ── SMTP Fallback ─────────────────────────────────────────────────────────────

def _send_via_smtp(recipient: str, subject: str, html_body: str, resend_error: str = "") -> dict:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)

    if not all([smtp_host, smtp_user, smtp_pass]):
        hint = ""
        if resend_error:
            hint = f" (Resend also failed: {resend_error})"
        return {
            "success": False,
            "message": f"Email not configured.{hint} Add RESEND_API_KEY to .env (get free key at resend.com) or set SMTP_HOST/SMTP_USER/SMTP_PASSWORD."
        }

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"DataLens Reports <{smtp_from}>"
    msg["To"] = recipient
    msg.attach(MIMEText("Your DataLens report is ready. Please view in an HTML-capable client.", "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, recipient, msg.as_string())

        print(f"[EmailService] SMTP: sent to {recipient}")
        return {"success": True, "message": f"Report sent to {recipient}"}

    except smtplib.SMTPAuthenticationError:
        return {
            "success": False,
            "message": "SMTP authentication failed. For Gmail: go to myaccount.google.com/apppasswords and generate an App Password. Alternatively, add RESEND_API_KEY to .env (free at resend.com)."
        }
    except smtplib.SMTPException as e:
        return {"success": False, "message": f"Email sending failed: {str(e)}"}
    except Exception as e:
        return {"success": False, "message": f"Unexpected error: {str(e)}"}


# ── HTML Report Builder ───────────────────────────────────────────────────────

def build_report_html(report: dict) -> str:
    """Convert a report payload into a styled, professional HTML email body."""
    from datetime import datetime
    metadata = report.get("metadata", {})
    summary = report.get("summary", [])
    anomalies = report.get("anomalies", [])
    narrative = report.get("narrative", "")


    date_str = datetime.now().strftime("%d %B %Y")
    total_rows = metadata.get("total_rows", 0)
    total_cols = metadata.get("total_columns", 0)
    anomaly_count = len(anomalies)

    # ── Anomaly rows ──
    anomaly_rows_html = ""
    for a in anomalies:
        if a["severity"] == "high":
            badge_bg = "#dc2626"
            row_bg = "#fef2f2"
        else:
            badge_bg = "#d97706"
            row_bg = "#fffbeb"
        sev = a["severity"].upper()
        col = a["column"]
        msg = a["message"]
        method = a["method"]
        anomaly_rows_html += (
            f'<tr style="background:{row_bg};">'
            f'<td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;">'
            f'<span style="background:{badge_bg};color:#fff;padding:2px 9px;border-radius:99px;font-size:10px;font-weight:700;">{sev}</span>'
            f'</td>'
            f'<td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#1f2937;">{col}</td>'
            f'<td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;color:#374151;">{msg}</td>'
            f'<td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#6b7280;">{method}</td>'
            f'</tr>'
        )

    # ── Stats rows ──
    stats_rows_html = ""
    for i, s in enumerate([x for x in summary if x.get("type") == "numeric"]):
        bg = "#fff" if i % 2 == 0 else "#f9fafb"
        null_color = "#dc2626" if (s.get("null_pct") or 0) > 10 else "#6b7280"
        dn = s.get("display_name", s.get("column", ""))
        mn = s.get("min", "—")
        mx = s.get("max", "—")
        me = s.get("mean", "—")
        md = s.get("median", "—")
        sd = s.get("std_dev", "—")
        np_ = s.get("null_pct", 0)
        stats_rows_html += (
            f'<tr style="background:{bg};">'
            f'<td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;">{dn}</td>'
            f'<td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;text-align:right;">{mn}</td>'
            f'<td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;text-align:right;">{mx}</td>'
            f'<td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#4f46e5;">{me}</td>'
            f'<td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;text-align:right;">{md}</td>'
            f'<td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;text-align:right;">{sd}</td>'
            f'<td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;text-align:right;color:{null_color};">{np_}%</td>'
            f'</tr>'
        )

    # ── Anomaly section ──
    if anomalies:
        anomaly_section = (
            '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">'
            '<div style="background:#fef2f2;padding:14px 20px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;">'
            '<span style="margin-right:10px;font-size:16px;">⚠️</span>'
            f'<span style="font-size:14px;font-weight:700;color:#dc2626;">Anomaly Detection — {anomaly_count} issue{"s" if anomaly_count > 1 else ""} found</span>'
            '</div>'
            '<div style="padding:0;">'
            '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
            '<thead><tr>'
            '<th style="width:90px;padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e5e7eb;background:#f8fafc;">Severity</th>'
            '<th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e5e7eb;background:#f8fafc;">Column</th>'
            '<th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e5e7eb;background:#f8fafc;">Finding</th>'
            '<th style="width:150px;padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e5e7eb;background:#f8fafc;">Method</th>'
            '</tr></thead>'
            f'<tbody>{anomaly_rows_html}</tbody>'
            '</table></div></div>'
        )
    else:
        anomaly_section = (
            '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">'
            '<div style="background:#f0fdf4;padding:14px 20px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;">'
            '<span style="margin-right:10px;font-size:16px;">✅</span>'
            '<span style="font-size:14px;font-weight:700;color:#166534;">Anomaly Detection — All Clear</span>'
            '</div>'
            '<div style="padding:20px;">'
            '<p style="color:#166534;font-weight:500;font-size:13px;margin:0;">No anomalies detected — data looks clean and consistent.</p>'
            '</div></div>'
        )

    html = (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        "<style>"
        "body{margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;color:#111827;font-size:13px;line-height:1.6;}"
        ".narrative p{margin:0 0 10px;color:#374151;}"
        ".narrative ul{margin:0 0 10px 0;padding-left:20px;}"
        ".narrative li{margin-bottom:6px;color:#374151;}"
        ".narrative strong{color:#3b0764;font-weight:600;}"
        ".narrative p:last-child{margin-bottom:0;}"
        "</style>"
        "</head>"
        '<body style="font-family:\'Segoe UI\',Arial,sans-serif;background:#f1f5f9;padding:32px 24px;">'
        '<div style="max-width:860px;margin:0 auto;">'

        # Header
        '<div style="background:linear-gradient(135deg,#42145f 0%,#6d28d9 60%,#0d9488 100%);border-radius:14px;color:#fff;padding:32px 36px;margin-bottom:24px;">'
        '<div style="font-size:26px;font-weight:700;margin-bottom:10px;">📊 DataLens AI Report</div>'
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        f'<span style="background:rgba(255,255,255,0.18);border-radius:8px;padding:4px 14px;font-size:11px;font-weight:600;">'
        f'{total_rows:,} Rows</span>'
        f'<span style="background:rgba(255,255,255,0.18);border-radius:8px;padding:4px 14px;font-size:11px;font-weight:600;">'
        f'{total_cols} Columns</span>'
        f'<span style="background:rgba(255,255,255,0.18);border-radius:8px;padding:4px 14px;font-size:11px;font-weight:600;">'
        f'{anomaly_count} Anomalies</span>'
        f'<span style="background:rgba(255,255,255,0.18);border-radius:8px;padding:4px 14px;font-size:11px;font-weight:600;">'
        f'{date_str}</span>'
        '</div></div>'

        # Executive Summary
        '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">'
        '<div style="background:#f5f3ff;padding:14px 20px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;">'
        '<span style="margin-right:10px;font-size:16px;">✨</span>'
        '<span style="font-size:14px;font-weight:700;color:#6d28d9;">Executive Summary</span>'
        '</div>'
        '<div class="narrative" style="padding:20px;">'
        f'{_markdown_to_html(narrative)}</div></div>'

        # Anomalies
        + anomaly_section +

        # Statistical Summary
        '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">'
        '<div style="background:#eff6ff;padding:14px 20px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;">'
        '<span style="margin-right:10px;font-size:16px;">📈</span>'
        '<span style="font-size:14px;font-weight:700;color:#1d4ed8;">Statistical Summary</span>'
        '</div>'
        '<div style="padding:0;">'
        '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
        '<thead><tr>'
        '<th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e5e7eb;background:#f8fafc;">Column</th>'
        '<th style="padding:9px 12px;text-align:right;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e5e7eb;background:#f8fafc;">Min</th>'
        '<th style="padding:9px 12px;text-align:right;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e5e7eb;background:#f8fafc;">Max</th>'
        '<th style="padding:9px 12px;text-align:right;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e5e7eb;background:#f8fafc;">Mean</th>'
        '<th style="padding:9px 12px;text-align:right;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e5e7eb;background:#f8fafc;">Median</th>'
        '<th style="padding:9px 12px;text-align:right;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e5e7eb;background:#f8fafc;">Std Dev</th>'
        '<th style="padding:9px 12px;text-align:right;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #e5e7eb;background:#f8fafc;">Nulls %</th>'
        f'</tr></thead><tbody>{stats_rows_html or "<tr><td colspan=7 style=padding:16px;text-align:center;color:#9ca3af;>No numeric columns</td></tr>"}</tbody>'
        '</table></div></div>'

        # Footer
        '<div style="text-align:center;padding:20px 0 4px;color:#94a3b8;font-size:11px;">'
        'Generated by DataLens &middot; AI-Powered Analytics Platform &middot; '
        f'{date_str}</div>'
        '</div></body></html>'
    )
    return html

