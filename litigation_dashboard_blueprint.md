# Indian Litigation & Case Tracking Dashboard Specifications

## Project Overview
A standalone, pure-litigation tracking dashboard optimized for the Indian judiciary system (High Courts, Commercial Courts, District Courts). It strips out generic taskboards and finance tools, focusing entirely on matter progression, statutory milestones, and procedural document vaulting. The system relies on the **Case Code** (e.g., CNR Number, High Court Filing Number) as the primary key.

---

## 1. Core Interface & UI Modules

### A. The Litigation Master Docket
A high-level view of active court matters replacing standard task lists.
*   **Columns Required:** Case Code (CNR / Suit No.), Cause Title, Forum / Bench, Current Stage, Linked IP.
*   **Key Feature:** Visual indicator/link to external IP assets.

### B. Daily Status Entry (eCourts Mirror)
A manual data entry block used after every hearing, designed to match the official eCourts interface exactly.
*   **Static Header:**
    *   In the court of (e.g., CCH-83 LXXXII ADDL CITY CIVIL AND SESSIONS JUDGE)
    *   CNR Number (e.g., KABC170015212026)
    *   Case Number (e.g., Com.O.S./0000735/2026)
    *   Cause Title (e.g., VISHWANATHA K versus PRIYA INDUSTRIES)
*   **Data Entry Form:**
    *   **Business Date:** Calendar picker.
    *   **Business (Rich Text):** Large text area to paste exact daily orders, proceeding summaries, and complex legal developments (e.g., filing of counter claims, jurisdictional transfers).
    *   **Next Purpose:** Editable combobox (HEARING, ORDERS, SUMMONS, etc.).
    *   **Next Hearing Date:** Calendar picker.

### C. Case History Timeline
A reverse-chronological ledger that automatically populates based on the "Daily Status" entries.
*   **Columns:** Judge | Business Date | Next Hearing Date | Purpose of Hearing.
*   **Expansion Modules (Bottom Toggles):**
    *   *Interim Orders:* Section to log and attach intermediate rulings.
    *   *Processes:* Section to track the issuance and service of notices/summons.

### D. The IP Bridge (Case Description Panel)
A relational bridge connecting court cases to a separate, external IP Prosecution dashboard.
*   **Workflow:** When adding a new litigation entry, an optional "Attach IP Code" field is provided.
*   **Action:** If an IP Code (e.g., `IP-PAT-2024`) is entered, the dashboard queries the IP system and injects an "Asset Origin" block into the litigation view.
*   **Display:** Shows Asset Type, Status in Registry, Prosecuting Agent, and a direct link to the full prosecution history.

### E. Document Vault & E-Signature Tracking
An encrypted, privilege-sorted vault tracking the status of procedural filings.
*   **Categories:** 
    *   *Waiting on Client Signature:* (e.g., Form 26, Affidavits)
    *   *Ready for Filing:* (e.g., Rejoinders, Written Statements)

### F. Client Portal & Ethical Walls
*   **Client View:** Filters out internal notes; alerts team if a client hasn't viewed updates or is holding up approvals.
*   **Ethical Walls:** Strict server-level access control. Matters are flagged as "Global" (visible to all staff) or "Walled" (restricted to specific designated counsel/strategists).

---

## 2. Database Schema & Integrations

### A. Calendar Sync Schema (Table: `Litigation_Events`)
Required to future-proof two-way synchronization with Google Calendar and Zoho Calendar via API.

| Field Name | Data Type | Purpose |
| :--- | :--- | :--- |
| `event_id` | UUID (PK) | Internal unique identifier for the hearing date. |
| `case_code` | String (FK) | Links event to the litigation matter. |
| `title` | String | Event name pushed to calendar (e.g., "Hearing: Jalio Tech v. Global IoT"). |
| `start_datetime` | Timestamp | Start time in UTC (ISO 8601). |
| `end_datetime` | Timestamp | End time in UTC. |
| `timezone` | String | Local timezone (e.g., `Asia/Kolkata`). |
| `google_event_id`| String (Null) | Google's unique `id` for updates/deletions. |
| `zoho_event_id` | String (Null) | Zoho's unique `eid` for updates/deletions. |
| `last_synced_at` | Timestamp | Tracks last successful API handshake (conflict resolution). |
| `etag` | String (Null) | Version control to prevent accidental data overwrite. |

*Architecture Note:* Use event-driven webhooks for sync (Outbound: Server posts to Calendar API; Inbound: Calendar webhooks alert server to drag-and-drop changes).

### B. Zoho Cliq Notifications
Automated alerts pushed to the litigation team whenever a Next Hearing Date is updated.
*   **Trigger:** Post-submission of the "Daily Status" form.
*   **Endpoint:** Zoho Cliq Incoming Webhook URL or `/api/v3/messages`.
*   **Format:** `modern-inline` message card.
*   **Routing:** Dynamic routing to specific channels (e.g., `#litigation-updates`), direct ZUIDs, or forcing push notifications using `@` mentions.

**Payload Template:**
```json
{
  "text": "The Next Hearing Date for **[Cause Title]** has been updated. Please review the requirements.",
  "card": {
    "theme": "modern-inline",
    "title": "🏛️ Court Status Updated: [Case Number]",
    "sections": [
      {
        "title": "Procedural Milestones",
        "fields": [
          { "title": "Business Date", "value": "[Business Date Variable]" },
          { "title": "Next Hearing Date", "value": "[Next Hearing Variable]" },
          { "title": "Next Purpose", "value": "[Next Purpose Variable]" }
        ]
      },
      {
        "title": "Team Assignments",
        "fields": [
          { "title": "Lead Strategist", "value": "[Lead Name]" },
          { "title": "Notify", "value": "[@Mention Tag]" }
        ]
      }
    ]
  }
}
```