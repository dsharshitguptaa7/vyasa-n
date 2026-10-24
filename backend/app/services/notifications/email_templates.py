"""
VYASAᴺ Institutional Email Template System.

Strict Branding Standards:
- Official wordmark: VYASA<sup>N</sup> in HTML, VYASAᴺ in plain-text.
- University Identity: Chhatrapati Shahu Ji Maharaj University (CSJMU), Kanpur.
  Hindi: छत्रपति शाहू जी महाराज विश्वविद्यालय, कानपुर.
- Institutional Palette:
  - Navy Blue: #0f2b48 (primary), #0a192f (dark header/footer)
  - Restrained Gold: #ecdfba (light border/subline), #b45309 / #d97706 (accent/badges)
  - Clean White: #ffffff
  - Background Gray: #f8fafc
  - Body Text: #1e293b, #475569
- Accessible, client-compatible inline HTML tables + plain-text fallback.
- Secure HTML escaping on all dynamic data.
"""

import html
from typing import Dict, List, Optional, Tuple


def _escape(text: Optional[str]) -> str:
    """Escapes HTML entities safely, replacing None with empty string."""
    if text is None:
        return ""
    return html.escape(str(text))


def render_email_layout(
    title: str,
    preheader: str,
    headline: str,
    body_paragraphs: List[str],
    key_values: Optional[List[Tuple[str, str]]] = None,
    action_button: Optional[Tuple[str, str]] = None,  # (label, url)
    security_notice: Optional[str] = None,
    pillar_label: str = "NIVARAN-AI",
    is_alert: bool = False,
    support_email: str = "grievance.support@csjmu.ac.in",
) -> Tuple[str, str]:
    """
    Renders an institutional email returning (html_body, text_body).
    Enforces VYASA<sup>N</sup> branding, CSJMU institutional headers/footers,
    navy/gold colorways, table layouts, and plain-text fallbacks.
    """
    safe_title = _escape(title)
    safe_preheader = _escape(preheader)
    safe_headline = _escape(headline)
    safe_pillar = _escape(pillar_label)
    safe_support_email = _escape(support_email)

    header_border_color = "#b45309" if is_alert else "#ecdfba"
    badge_bg = "#fef3c7" if is_alert else "#e0e7ff"
    badge_text_color = "#92400e" if is_alert else "#1e3a8a"

    # -------------------------------------------------------------------------
    # HTML Layout Generation
    # -------------------------------------------------------------------------
    kv_rows_html = ""
    if key_values:
        kv_items = []
        for k, v in key_values:
            kv_items.append(
                f"""<tr>
                    <td style="padding: 8px 12px; font-weight: 600; color: #0f2b48; font-size: 13px; width: 35%; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
                        {_escape(k)}
                    </td>
                    <td style="padding: 8px 12px; color: #334155; font-size: 13px; border-bottom: 1px solid #e2e8f0; word-break: break-word;">
                        {_escape(v)}
                    </td>
                </tr>"""
            )
        kv_rows_html = f"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; border: 1px solid #cbd5e1; border-radius: 6px; background-color: #f8fafc; border-collapse: collapse;">
            <tbody>
                {''.join(kv_items)}
            </tbody>
        </table>
        """

    paragraphs_html = ""
    for p in body_paragraphs:
        paragraphs_html += f'<p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">{_escape(p)}</p>'

    button_html = ""
    if action_button and action_button[0] and action_button[1]:
        btn_label = _escape(action_button[0])
        btn_url = _escape(action_button[1])
        btn_bg = "#b45309" if is_alert else "#0f2b48"
        button_html = f"""
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
            <tr>
                <td align="center" style="border-radius: 6px; background-color: {btn_bg};">
                    <a href="{btn_url}" target="_blank" style="display: inline-block; padding: 12px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                        {btn_label} &rarr;
                    </a>
                </td>
            </tr>
        </table>
        """

    security_notice_html = ""
    if security_notice:
        notice_bg = "#fffbeb" if is_alert else "#f1f5f9"
        notice_border = "#f59e0b" if is_alert else "#94a3b8"
        notice_color = "#92400e" if is_alert else "#475569"
        security_notice_html = f"""
        <div style="margin: 24px 0 16px 0; padding: 12px 16px; background-color: {notice_bg}; border-left: 4px solid {notice_border}; border-radius: 4px; font-size: 12px; line-height: 1.5; color: {notice_color};">
            <strong>Security Notice:</strong> {_escape(security_notice)}
        </div>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>{safe_title}</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <!-- Preheader preview text -->
    <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #f1f5f9;">
        {safe_preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 24px 12px;">
        <tr>
            <td align="center">
                <!-- Main Container (600px) -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
                    <!-- Institutional Header -->
                    <tr>
                        <td style="background-color: #0f2b48; padding: 24px 28px; border-bottom: 3px solid {header_border_color}; text-align: left;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td valign="middle">
                                        <div style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px;">
                                            VYASA<sup style="font-size: 12px; font-weight: 700; vertical-align: super; line-height: 0;">N</sup>
                                            <span style="font-size: 14px; font-weight: 400; color: #ecdfba; margin-left: 8px;">| {safe_pillar}</span>
                                        </div>
                                        <div style="font-size: 12px; font-weight: 500; color: #ffffff; margin-top: 4px; letter-spacing: 0.2px;">
                                            Chhatrapati Shahu Ji Maharaj University (CSJMU), Kanpur
                                        </div>
                                        <div style="font-size: 11px; color: #ecdfba; margin-top: 2px;">
                                            छत्रपति शाहू जी महाराज विश्वविद्यालय, कानपुर
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 32px 28px 24px 28px;">
                            <!-- Pillar / Context Badge -->
                            <div style="display: inline-block; padding: 4px 10px; background-color: {badge_bg}; color: {badge_text_color}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 4px; margin-bottom: 16px;">
                                {safe_pillar} &bull; Official Notification
                            </div>

                            <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f2b48; line-height: 1.3;">
                                {safe_headline}
                            </h1>

                            {paragraphs_html}

                            {kv_rows_html}

                            {button_html}

                            {security_notice_html}
                        </td>
                    </tr>

                    <!-- Institutional Footer -->
                    <tr>
                        <td style="background-color: #0a192f; padding: 24px 28px; border-top: 1px solid #1e3a8a; text-align: left; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                            <div style="font-size: 13px; font-weight: 600; color: #ffffff; margin-bottom: 6px;">
                                Chhatrapati Shahu Ji Maharaj University, Kanpur
                            </div>
                            <div style="color: #ecdfba; font-size: 11px; margin-bottom: 12px;">
                                VYASA<sup style="font-size: 9px; vertical-align: super; line-height: 0;">N</sup> Institutional Governance &amp; Grievance Redressal Ecosystem
                            </div>
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #94a3b8;">
                                This is an automated institutional administrative communication. If you have questions or require verification, contact the Grievance Redressal Cell at <a href="mailto:{safe_support_email}" style="color: #ecdfba; text-decoration: none;">{safe_support_email}</a>.
                            </p>
                            <div style="padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 10px; color: #64748b;">
                                Kalyanpur, Kanpur, Uttar Pradesh 208024 &bull; <a href="https://csjmu.ac.in" style="color: #94a3b8; text-decoration: none;">csjmu.ac.in</a>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

    # -------------------------------------------------------------------------
    # Plain-Text Fallback Generation
    # -------------------------------------------------------------------------
    text_lines = [
        f"VYASAᴺ | {pillar_label}",
        "Chhatrapati Shahu Ji Maharaj University (CSJMU), Kanpur",
        "छत्रपति शाहू जी महाराज विश्वविद्यालय, कानपुर",
        "=" * 60,
        "",
        headline.upper(),
        "-" * len(headline),
        "",
    ]

    for p in body_paragraphs:
        text_lines.append(p)
        text_lines.append("")

    if key_values:
        text_lines.append("DETAILS:")
        for k, v in key_values:
            text_lines.append(f"  * {k}: {v}")
        text_lines.append("")

    if action_button and action_button[0] and action_button[1]:
        text_lines.append(f"ACTION REQUIRED: {action_button[0]}")
        text_lines.append(f"Link: {action_button[1]}")
        text_lines.append("")

    if security_notice:
        text_lines.append(f"SECURITY NOTICE: {security_notice}")
        text_lines.append("")

    text_lines.extend([
        "=" * 60,
        "Chhatrapati Shahu Ji Maharaj University, Kanpur",
        "VYASAᴺ Institutional Governance & Grievance Redressal Ecosystem",
        f"Support: {support_email}",
        "Kalyanpur, Kanpur, Uttar Pradesh 208024 | https://csjmu.ac.in",
    ])

    text_content = "\n".join(text_lines)
    return html_content, text_content


# =============================================================================
# Specialized Template Builders for Core Ecosystem Events
# =============================================================================

def build_authority_login_email(
    account_identifier: str,
    login_time_str: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    portal_url: str = "https://vyasa.csjmu.ac.in/governance",
    support_email: str = "grievance.support@csjmu.ac.in",
) -> Tuple[str, str, str]:
    """
    Authority dashboard login confirmation.
    Returns (subject, html_body, text_body).
    """
    subject = "VYASAᴺ Security Notice: Successful Authority Dashboard Login"
    headline = "Authority Dashboard Login Confirmed"
    preheader = f"Login confirmed for authority {account_identifier} on {login_time_str}."

    paragraphs = [
        f"Hello {account_identifier},",
        "This is an automated institutional security confirmation that your VYASAᴺ Authority Dashboard account was successfully accessed.",
    ]

    key_values = [
        ("Account Identifier", account_identifier),
        ("Date & Time", login_time_str),
        ("IP Address", ip_address or "Not available (secure proxy)"),
        ("Device / Browser", user_agent or "Standard Web Client"),
    ]

    security_notice = (
        "If you performed this login, no further action is required. "
        "If you did NOT initiate this session, your credentials may be compromised. "
        f"Please notify the University Computer Centre and Grievance Cell immediately at {support_email}."
    )

    action_button = ("Access Authority Dashboard", portal_url)

    html_body, text_body = render_email_layout(
        title=subject,
        preheader=preheader,
        headline=headline,
        body_paragraphs=paragraphs,
        key_values=key_values,
        action_button=action_button,
        security_notice=security_notice,
        pillar_label="Institutional Security",
        is_alert=False,
        support_email=support_email,
    )
    return subject, html_body, text_body


def build_authority_unusual_login_email(
    account_identifier: str,
    login_time_str: str,
    reason: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    portal_url: str = "https://vyasa.csjmu.ac.in/governance",
    support_email: str = "grievance.support@csjmu.ac.in",
) -> Tuple[str, str, str]:
    """
    New-device or unusual-login security alert.
    Returns (subject, html_body, text_body).
    """
    subject = "VYASAᴺ Security Alert: Unusual Login Detected on Authority Account"
    headline = "Security Alert: Unusual Authority Login"
    preheader = f"Security alert: {reason} for account {account_identifier}."

    paragraphs = [
        f"Attention {account_identifier},",
        "The VYASAᴺ Automated Security Monitor detected a login event that diverges from your standard institutional access profile.",
        f"Detection Rule Signal: {reason}",
    ]

    key_values = [
        ("Account Identifier", account_identifier),
        ("Date & Time", login_time_str),
        ("Risk Signal", reason),
        ("IP Address", ip_address or "Unresolved client"),
        ("Detected Device / Client", user_agent or "Unrecognized User-Agent"),
    ]

    security_notice = (
        "CRITICAL ACTION REQUIRED IF UNRECOGNIZED: "
        "If you do not recognize this activity, please terminate active sessions, change your institutional password immediately, "
        f"and alert the CSJMU Systems Administration team at {support_email}."
    )

    action_button = ("Review Account Security", portal_url)

    html_body, text_body = render_email_layout(
        title=subject,
        preheader=preheader,
        headline=headline,
        body_paragraphs=paragraphs,
        key_values=key_values,
        action_button=action_button,
        security_notice=security_notice,
        pillar_label="Institutional Security",
        is_alert=True,
        support_email=support_email,
    )
    return subject, html_body, text_body


def build_document_request_email(
    tracking_id: str,
    requested_documents: List[str],
    instructions: Optional[str] = None,
    deadline_str: Optional[str] = None,
    portal_link: str = "https://vyasa.csjmu.ac.in",
    support_email: str = "grievance.support@csjmu.ac.in",
) -> Tuple[str, str, str]:
    """
    Applicant notification for Document Request.
    Does NOT expose sensitive grievance details in subject line.
    """
    subject = f"VYASAᴺ Grievance Redressal: Additional Documentation Requested [{tracking_id}]"
    headline = "Action Required: Additional Documents Requested"
    preheader = f"Supporting documents requested for case reference {tracking_id}."

    docs_formatted = ", ".join(requested_documents) if requested_documents else "Supporting documentation"
    inst_text = instructions.strip() if instructions else "Please upload the requested materials via your applicant portal."

    paragraphs = [
        "Dear Applicant,",
        f"The adjudicating authority reviewing your grievance ({tracking_id}) has requested additional information or supporting documentation to proceed with the formal investigation.",
        f"Instructions from Authority: {inst_text}",
    ]

    key_values = [
        ("Tracking Reference", tracking_id),
        ("Requested Items", docs_formatted),
    ]
    if deadline_str:
        key_values.append(("Submission Deadline", deadline_str))

    action_button = ("Upload Documents Securely", portal_link)
    security_notice = (
        "Never send confidential documents or passwords over unencrypted email. "
        "Always upload official evidentiary records directly through the secure VYASAᴺ portal."
    )

    html_body, text_body = render_email_layout(
        title=subject,
        preheader=preheader,
        headline=headline,
        body_paragraphs=paragraphs,
        key_values=key_values,
        action_button=action_button,
        security_notice=security_notice,
        pillar_label="NIVARAN-AI",
        is_alert=False,
        support_email=support_email,
    )
    return subject, html_body, text_body


def build_grievance_resolved_email(
    tracking_id: str,
    resolution_summary: str,
    feedback_link: str,
    support_email: str = "grievance.support@csjmu.ac.in",
) -> Tuple[str, str, str]:
    """
    Applicant notification for Grievance Resolved & Feedback Request.
    """
    subject = f"VYASAᴺ Grievance Redressal: Resolution Notice & Feedback [{tracking_id}]"
    headline = "Grievance Formally Resolved"
    preheader = f"Resolution recorded for case reference {tracking_id}. Please submit your feedback."

    paragraphs = [
        "Dear Applicant,",
        f"Your grievance (tracking reference {tracking_id}) has been formally reviewed and marked as RESOLVED by the designated university authority.",
        f"Resolution Summary: {resolution_summary.strip()}",
        "In accordance with CSJMU governance guidelines, your evaluation of this resolution is essential to maintain institutional accountability.",
    ]

    key_values = [
        ("Tracking Reference", tracking_id),
        ("Current Status", "RESOLVED"),
        ("Action", "Applicant Feedback Requested"),
    ]

    action_button = ("Submit Feedback & Review Order", feedback_link)
    security_notice = (
        "Note: Submitting feedback does not overturn or reopen a case, but provides formal audit record for the Grievance Redressal Cell. "
        f"If you require further guidance, contact {support_email}."
    )

    html_body, text_body = render_email_layout(
        title=subject,
        preheader=preheader,
        headline=headline,
        body_paragraphs=paragraphs,
        key_values=key_values,
        action_button=action_button,
        security_notice=security_notice,
        pillar_label="NIVARAN-AI",
        is_alert=False,
        support_email=support_email,
    )
    return subject, html_body, text_body


def build_grievance_closed_email(
    tracking_id: str,
    closure_date_str: str,
    closure_summary: Optional[str] = None,
    dossier_link: str = "https://vyasa.csjmu.ac.in",
    support_email: str = "grievance.support@csjmu.ac.in",
) -> Tuple[str, str, str]:
    """
    Applicant notification for Grievance Formal Closure.
    """
    subject = f"VYASAᴺ Grievance Redressal: Formal Closure Notice [{tracking_id}]"
    headline = "Grievance Record Formally Closed"
    preheader = f"Case reference {tracking_id} has been formally closed and sealed."

    summary_text = closure_summary.strip() if closure_summary else "Administrative review completed and official proceedings concluded."

    paragraphs = [
        "Dear Applicant,",
        f"This official notice confirms that grievance {tracking_id} has completed all procedural stages and is now formally CLOSED.",
        f"Closure Summary: {summary_text}",
        "The electronic grievance dossier (E-File) has been archived in the university records.",
    ]

    key_values = [
        ("Tracking Reference", tracking_id),
        ("Final Status", "CLOSED"),
        ("Closure Date", closure_date_str),
    ]

    action_button = ("View Final Grievance Dossier", dossier_link)

    html_body, text_body = render_email_layout(
        title=subject,
        preheader=preheader,
        headline=headline,
        body_paragraphs=paragraphs,
        key_values=key_values,
        action_button=action_button,
        security_notice=None,
        pillar_label="NIVARAN-AI",
        is_alert=False,
        support_email=support_email,
    )
    return subject, html_body, text_body
