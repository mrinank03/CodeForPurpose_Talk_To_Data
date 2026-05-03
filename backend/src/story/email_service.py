"""
Email service — supports two providers:
  1. SMTP (primary — Gmail App Password based, works for all recipients)
  2. Resend (fallback — API-key based)

Setup for SMTP (recommended for sending to any email):
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your@gmail.com
  SMTP_PASSWORD=your-app-password  (from myaccount.google.com/apppasswords)
  SMTP_FROM=your@gmail.com

Setup for Resend:
  RESEND_API_KEY=re_xxxxxxxxxxxx
  EMAIL_FROM=onboarding@resend.dev
"""
import os
import re
import base64
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
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


def send_report_email(recipient: str, subject: str, html_body: str, pdf_bytes: bytes = None) -> dict:
    """
    Send an HTML email with optional PDF attachment.
    Tries Resend first, falls back to SMTP.
    Returns {"success": True/False, "message": "..."}.
    """
    resend_key = os.getenv("RESEND_API_KEY")
    errors = []

    # Try Resend first (works for the account owner's email)
    if resend_key:
        resend_result = _send_via_resend(resend_key, recipient, subject, html_body, pdf_bytes=pdf_bytes)
        if resend_result["success"]:
            return resend_result
        errors.append(f"Resend: {resend_result['message']}")

    # Try SMTP as fallback
    smtp_result = _send_via_smtp(recipient, subject, html_body, pdf_bytes=pdf_bytes)
    if smtp_result["success"]:
        return smtp_result
    errors.append(f"SMTP: {smtp_result['message']}")

    # Both failed — give a helpful error
    combined = " | ".join(errors)
    
    # Check if it's a Resend "own email only" issue  
    is_resend_domain_issue = "only send testing emails" in combined.lower() or "verify a domain" in combined.lower()
    
    if is_resend_domain_issue:
        return {
            "success": False,
            "message": (
                f"Cannot send to {recipient}. "
                "Resend free tier only allows sending to the account owner's email. "
                "To send to any email: either verify a custom domain at resend.com/domains, "
                "or set up Gmail SMTP with an App Password in .env "
                "(SMTP_HOST, SMTP_USER, SMTP_PASSWORD from myaccount.google.com/apppasswords)."
            )
        }
    
    return {"success": False, "message": combined}


# ── SMTP (Primary) ───────────────────────────────────────────────────────────

def _send_via_smtp(recipient: str, subject: str, html_body: str, pdf_bytes: bytes = None) -> dict:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)

    if not all([smtp_host, smtp_user, smtp_pass]):
        return {
            "success": False,
            "message": "SMTP not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASSWORD in .env."
        }

    # Build multipart message
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = f"DataLens Reports <{smtp_from}>"
    msg["To"] = recipient

    # HTML body as alternative part
    alt_part = MIMEMultipart("alternative")
    alt_part.attach(MIMEText("Your DataLens AI report is ready. Please view in an HTML-capable client.", "plain"))
    alt_part.attach(MIMEText(html_body, "html"))
    msg.attach(alt_part)

    # Attach PDF if provided
    if pdf_bytes:
        pdf_attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
        pdf_attachment.add_header("Content-Disposition", "attachment", filename="DataLens_AI_Report.pdf")
        msg.attach(pdf_attachment)

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_pass)
            recipients_list = [r.strip() for r in recipient.split(",")] if "," in recipient else [recipient]
            server.sendmail(smtp_from, recipients_list, msg.as_string())

        print(f"[EmailService] SMTP: sent to {recipient}")
        return {"success": True, "message": f"Report sent to {recipient}"}

    except smtplib.SMTPAuthenticationError:
        return {
            "success": False,
            "message": "SMTP authentication failed. For Gmail: go to myaccount.google.com/apppasswords and generate an App Password."
        }
    except smtplib.SMTPException as e:
        return {"success": False, "message": f"Email sending failed: {str(e)}"}
    except Exception as e:
        return {"success": False, "message": f"Unexpected error: {str(e)}"}


# ── Resend (Fallback) ────────────────────────────────────────────────────────

def _send_via_resend(api_key: str, recipient: str, subject: str, html_body: str, pdf_bytes: bytes = None) -> dict:
    try:
        import resend
        resend.api_key = api_key
        from_addr = os.getenv("EMAIL_FROM", "DataLens <onboarding@resend.dev>")

        recipients_list = [r.strip() for r in recipient.split(",")] if "," in recipient else [recipient]
        params = {
            "from": from_addr,
            "to": recipients_list,
            "subject": subject,
            "html": html_body,
        }

        # Attach PDF via Resend's attachment API
        if pdf_bytes:
            params["attachments"] = [{
                "filename": "DataLens_AI_Report.pdf",
                "content": list(pdf_bytes),  # Resend expects a list of byte values
            }]

        email = resend.Emails.send(params)
        print(f"[EmailService] Resend: sent to {recipient} → id={email.get('id')}")
        return {"success": True, "message": f"Report sent to {recipient}"}

    except Exception as e:
        error_msg = str(e)
        print(f"[EmailService] Resend failed: {error_msg}")
        return {"success": False, "message": f"Resend error: {error_msg}"}


# ── HTML Report Builder (email body — summary only, charts in PDF) ───────────

def build_report_html(report: dict) -> str:
    """Convert a report payload into a styled HTML email body with summary text.
    Charts are NOT included here — they go in the attached PDF."""
    from datetime import datetime
    metadata = report.get("metadata", {})
    narrative = report.get("narrative", "")
    insights = report.get("insights", [])

    date_str = datetime.now().strftime("%d %B %Y")
    total_rows = metadata.get("total_rows", 0)
    total_cols = metadata.get("total_columns", 0)
    chart_count = len(insights)

    # Chart headlines list
    chart_list_html = ""
    if insights:
        items = "".join(
            f'<li style="margin-bottom:6px;color:#374151;">📊 {card.get("headline", "Insight")}</li>'
            for card in insights
        )
        chart_list_html = (
            '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">'
            '<div style="background:#f5f3ff;padding:14px 20px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;">'
            '<span style="margin-right:10px;font-size:16px;">📊</span>'
            f'<span style="font-size:14px;font-weight:700;color:#6d28d9;">Charts Included ({chart_count})</span>'
            '</div>'
            '<div style="padding:16px 20px;">'
            '<p style="font-size:12px;color:#6b7280;margin:0 0 10px;">The following charts are included in the attached PDF report:</p>'
            f'<ul style="margin:0;padding-left:20px;">{items}</ul>'
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
        f'{chart_count} Charts</span>'
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

        # Chart list
        + chart_list_html +

        # PDF notice
        '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">'
        '<div style="background:#f0fdf4;padding:14px 20px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;">'
        '<span style="margin-right:10px;font-size:16px;">📎</span>'
        '<span style="font-size:14px;font-weight:700;color:#166534;">Full Report Attached</span>'
        '</div>'
        '<div style="padding:20px;">'
        '<p style="color:#374151;margin:0;font-size:13px;">The complete report with all charts and graphs is attached as a PDF file. Please download <strong>DataLens_AI_Report.pdf</strong> to view the full visual analysis.</p>'
        '</div></div>'

        # Footer
        '<div style="text-align:center;padding:20px 0 4px;color:#94a3b8;font-size:11px;">'
        'Generated by DataLens &middot; AI-Powered Analytics Platform &middot; '
        f'{date_str}</div>'
        '</div></body></html>'
    )
    return html
