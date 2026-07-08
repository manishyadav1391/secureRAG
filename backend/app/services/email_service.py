import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SMTP_SERVER = os.getenv("SMTP_SERVER")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def send_email(receiver: str, subject: str, html: str) -> bool:
    """Send an HTML email. Returns True on success, False on failure."""
    if not all([SMTP_SERVER, SMTP_EMAIL, SMTP_PASSWORD, receiver]):
        logger.warning("Email not sent: missing SMTP configuration or receiver address")
        return False

    msg = MIMEMultipart()
    msg["From"] = SMTP_EMAIL
    msg["To"] = receiver
    msg["Subject"] = subject
    msg.attach(MIMEText(html, "html"))

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(SMTP_EMAIL, receiver, msg.as_string())
        server.quit()
        logger.info(f"Email sent successfully to {receiver}: {subject}")
        return True
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP Authentication failed: {e}")
        return False
    except smtplib.SMTPRecipientsRefused as e:
        logger.error(f"Recipient refused: {e}")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error sending email to {receiver}: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending email to {receiver}: {e}")
        return False


EMAIL_STYLES = """
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; }
        .header p { color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 13px; }
        .body { padding: 32px 24px; }
        .body h2 { margin: 0 0 16px 0; font-size: 18px; color: #1f2937; }
        .body p { color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0; }
        .detail-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .detail-box p { margin: 4px 0; }
        .detail-box strong { color: #1f2937; }
        .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-top: 16px; }
        .btn:hover { background: #4338ca; }
        .btn-success { background: #059669; }
        .btn-success:hover { background: #047857; }
        .footer { padding: 20px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; }
        .footer p { color: #9ca3af; font-size: 12px; margin: 0; }
        .status-approved { color: #059669; font-weight: 700; }
        .status-denied { color: #dc2626; font-weight: 700; }
    </style>
"""


def send_access_request_email_to_admin(user_name: str, document_title: str, reason: str) -> bool:
    """Send notification email to admin when a new access request is submitted."""
    if not ADMIN_EMAIL:
        logger.warning("Admin email not configured, skipping notification")
        return False

    subject = f"🔒 New Access Request — {document_title}"

    body = f"""
    <html>
    <head>{EMAIL_STYLES}</head>
    <body>
        <div class="container">
            <div class="header">
                <h1>SecurRAG</h1>
                <p>Document Access Request</p>
            </div>
            <div class="body">
                <h2>New Access Request Received</h2>
                <p>A user has requested access to a restricted document.</p>
                <div class="detail-box">
                    <p><strong>Requested by:</strong> {user_name}</p>
                    <p><strong>Document:</strong> {document_title}</p>
                    <p><strong>Reason:</strong></p>
                    <p><em>{reason}</em></p>
                </div>
                <a href="{FRONTEND_URL}/admin" class="btn">Review in Dashboard</a>
            </div>
            <div class="footer">
                <p>SecurRAG — Internal Knowledge Base System</p>
            </div>
        </div>
    </body>
    </html>
    """

    return send_email(ADMIN_EMAIL, subject, body)


def send_decision_email_to_user(user_email: str, document_title: str, status: str) -> bool:
    """Send approval/denial notification to the user who requested access."""
    if not user_email:
        logger.warning("User email is empty, skipping decision notification")
        return False

    is_approved = status == "approved"
    status_class = "status-approved" if is_approved else "status-denied"
    status_emoji = "✅" if is_approved else "❌"

    subject = f"{status_emoji} Access Request {status.title()} — {document_title}"

    approved_section = ""
    if is_approved:
        approved_section = f"""
            <p>You now have access to this document through the SecurRAG chatbot. 
               Ask questions about it in your next chat session!</p>
            <a href="{FRONTEND_URL}/chat" class="btn btn-success">Open Chatbot</a>
        """
    else:
        approved_section = """
            <p>If you believe this was a mistake, you can submit a new request with additional justification.</p>
        """

    body = f"""
    <html>
    <head>{EMAIL_STYLES}</head>
    <body>
        <div class="container">
            <div class="header">
                <h1>SecurRAG</h1>
                <p>Access Request Update</p>
            </div>
            <div class="body">
                <h2>Your Request Has Been <span class="{status_class}">{status.title()}</span></h2>
                <div class="detail-box">
                    <p><strong>Document:</strong> {document_title}</p>
                    <p><strong>Decision:</strong> <span class="{status_class}">{status.upper()}</span></p>
                </div>
                {approved_section}
            </div>
            <div class="footer">
                <p>SecurRAG — Internal Knowledge Base System</p>
            </div>
        </div>
    </body>
    </html>
    """

    return send_email(user_email, subject, body)
