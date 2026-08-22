# MELEO v4.1 Release Candidate — Communication Suite

## Added
- Server-Sent Events live channel for instant in-app events.
- Browser notification permission + live notifications while the app is connected.
- Real-time refresh for booking messages and request changes.
- Calendar actions for Google, Outlook, Yahoo and standards-based Apple/.ics export.
- Help Center with FAQ, authenticated support tickets, threaded replies and Admin support operations.
- Admin Support tab.

## Production note
True background Web Push when the browser/app is fully closed requires VAPID/Web Push infrastructure (or a provider such as Firebase/OneSignal) and is intentionally not faked in this source-only RC. The current browser notifications are live while a MELEO session is connected.
