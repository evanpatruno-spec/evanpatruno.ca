import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_email():
    # Configuration
    smtp_server = "smtp.gmail.com"
    smtp_port = 587
    sender_email = os.getenv("SMTP_USERNAME")
    sender_password = os.getenv("SMTP_PASSWORD") # App Password required
    receiver_email = "evanpatruno@gmail.com" # Updated to Evan's email
    
    if not sender_email or not sender_password:
        print("[Error] SMTP_USERNAME or SMTP_PASSWORD not configured.")
        return

    # Create Message
    message = MIMEMultipart("alternative")
    message["Subject"] = "[ACTION REQUISE] Aperçu de votre Newsletter Hypothécaire"
    message["From"] = f"Evan Patruno Automation <{sender_email}>"
    message["To"] = receiver_email

    # Read the HTML preview file
    try:
        with open("newsletter_preview.html", "r", encoding="utf-8") as f:
            html_content = f.read()
    except FileNotFoundError:
        print("[Error] newsletter_preview.html not found.")
        return

    # Add HTML body
    part = MIMEText(html_content, "html")
    message.attach(part)

    # Send Email
    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, receiver_email, message.as_string())
        print(f"E-mail d'aperçu envoyé avec succès à {receiver_email} !")
    except Exception as e:
        print(f"[Error] Failed to send email: {e}")

if __name__ == "__main__":
    send_email()
