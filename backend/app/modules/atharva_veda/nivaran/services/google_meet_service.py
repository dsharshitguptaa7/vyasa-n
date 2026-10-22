import logging
from datetime import datetime
from typing import Dict, List, Optional
import httpx

from app.core.config import settings

logger = logging.getLogger("vyasa.atharva.google_meet")


class GoogleMeetService:
    CALENDAR_API_SCOPES = [
        "https://www.googleapis.com/auth/calendar.events",
    ]

    @classmethod
    def is_configured(cls) -> bool:
        """
        Returns True only if Google credentials are fully present in configuration.
        """
        has_oauth = bool(
            settings.GOOGLE_MEET_CLIENT_ID
            and settings.GOOGLE_MEET_CLIENT_SECRET
            and settings.GOOGLE_MEET_REFRESH_TOKEN
        )
        has_service_account = bool(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
        return has_oauth or has_service_account

    @classmethod
    def get_integration_status(cls) -> Dict:
        """
        Returns authoritative status and setup guide for Google Meet integration.
        Does not misrepresent unconfigured state as operational.
        """
        configured = cls.is_configured()
        if configured:
            return {
                "configured": True,
                "status": "OPERATIONAL",
                "provider": "Google Calendar & Meet API (Google Workspace)",
                "required_scopes": cls.CALENDAR_API_SCOPES,
                "message": "Google Meet integration is operational and ready for calendar meeting generation.",
                "setup_instructions": None,
            }

        return {
            "configured": False,
            "status": "CREDENTIALS_REQUIRED",
            "provider": "Google Calendar & Meet API (Google Workspace)",
            "required_scopes": cls.CALENDAR_API_SCOPES,
            "message": "Google Workspace / Meet API credentials are not configured on this server.",
            "setup_instructions": (
                "### Google Meet & Calendar Setup Instructions\n\n"
                "To enable automatic Google Meet room creation for CSJMU committees:\n\n"
                "1. **Google Cloud Console**:\n"
                "   - Navigate to [Google Cloud Console](https://console.cloud.google.com/).\n"
                "   - Select or create the **CSJMU VYASA Governance** project.\n"
                "   - Enable the **Google Calendar API** under APIs & Services.\n\n"
                "2. **OAuth 2.0 Credentials**:\n"
                "   - Create OAuth 2.0 Client Credentials (Web Application).\n"
                "   - Authorized Redirect URI: `https://vyasa.csjmu.ac.in/api/modules/atharva-veda/nivaran/google/oauth/callback`.\n"
                "   - Scopes required: `https://www.googleapis.com/auth/calendar.events`.\n\n"
                "3. **Environment Configuration**:\n"
                "   - Add the following keys to your backend `.env` file:\n"
                "     ```env\n"
                "     GOOGLE_MEET_CLIENT_ID=\"your-client-id.apps.googleusercontent.com\"\n"
                "     GOOGLE_MEET_CLIENT_SECRET=\"your-client-secret\"\n"
                "     GOOGLE_MEET_REFRESH_TOKEN=\"your-authorized-refresh-token\"\n"
                "     ```\n"
                "   - Alternatively, configure `GOOGLE_SERVICE_ACCOUNT_JSON` for domain-wide delegated service accounts.\n\n"
                "4. **Verification**:\n"
                "   - Restart the VYASA backend service. Meetings scheduled will automatically generate authenticated Google Meet links."
            ),
        }

    @classmethod
    def create_meeting_room(
        cls,
        title: str,
        start_time: datetime,
        end_time: datetime,
        agenda: Optional[str] = None,
        attendee_emails: Optional[List[str]] = None,
    ) -> Optional[str]:
        """
        Calls Google Calendar API to create an event with conferenceData (Google Meet).
        Returns the genuine hangoutLink if Google API responds successfully.
        Never generates or invents fake links.
        If unconfigured, returns None.
        """
        if not cls.is_configured():
            logger.info(
                "[GoogleMeetService] Google Meet integration not configured. Skipping automated Meet generation."
            )
            return None

        try:
            # Refresh access token
            token_url = "https://oauth2.googleapis.com/token"
            token_payload = {
                "client_id": settings.GOOGLE_MEET_CLIENT_ID,
                "client_secret": settings.GOOGLE_MEET_CLIENT_SECRET,
                "refresh_token": settings.GOOGLE_MEET_REFRESH_TOKEN,
                "grant_type": "refresh_token",
            }
            with httpx.Client(timeout=10.0) as http_client:
                token_resp = http_client.post(token_url, data=token_payload)
                if token_resp.status_code != 200:
                    logger.error(
                        f"[GoogleMeetService] Failed to obtain access token: {token_resp.text}"
                    )
                    return None
                access_token = token_resp.json().get("access_token")

                # Create Calendar event with ConferenceData
                calendar_url = (
                    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1"
                )
                headers = {
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                }
                event_body = {
                    "summary": title,
                    "description": agenda or "NIVARAN Committee Meeting",
                    "start": {"dateTime": start_time.isoformat()},
                    "end": {"dateTime": end_time.isoformat()},
                    "conferenceData": {
                        "createRequest": {
                            "requestId": f"comm_meet_{int(datetime.now().timestamp())}",
                            "conferenceSolutionKey": {"type": "hangoutsMeet"},
                        }
                    },
                }
                if attendee_emails:
                    event_body["attendees"] = [{"email": email} for email in attendee_emails]

                create_resp = http_client.post(calendar_url, json=event_body, headers=headers)
                if create_resp.status_code in (200, 201):
                    event_data = create_resp.json()
                    meet_link = event_data.get("hangoutLink")
                    if meet_link:
                        logger.info(f"[GoogleMeetService] Successfully created Google Meet link: {meet_link}")
                        return meet_link

                logger.error(f"[GoogleMeetService] Google Calendar API error: {create_resp.text}")
                return None
        except Exception as e:
            logger.exception(f"[GoogleMeetService] Exception creating Google Meet room: {e}")
            return None
