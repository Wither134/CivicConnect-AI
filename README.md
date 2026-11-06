# CivicConnect AI — Integrated Incident Intelligence & Citizen Platform
> **Unified Master Architecture: CivicPulse AI + CommunityConnect**  
> *Tagline: Report. Collaborate. Resolve. Improve.*  
> *A high-concurrency civic infrastructure ledger with role-governed workflows, two-person resolution controls, distributed soft locking, local offline machine learning intelligence, interactive Leaflet GIS operations mapping, and an immutable audit trail.*

---

## 🏛️ Architectural Overview & Design System

CivicConnect AI combines **CommunityConnect's** citizen engagement, collaborative upvoting, and strict seven-stage role governance with **CivicPulse AI's** local offline Python machine learning incident intelligence and real-time GIS command center.

### Stack
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS (v4) + Leaflet / React-Leaflet
- **Unified Backend:** Python 3.12 + FastAPI + SQLAlchemy 2.0 (PostgreSQL with SQLite fallback)
- **Legacy Compatibility Backend:** Node.js + Express (ES Modules) preserved in `backend/`
- **Machine Learning (100% Local & Offline):** scikit-learn (DBSCAN geographic clustering, TF-IDF cosine duplicate detection, heuristic priority scoring, zero-hallucination extractive summaries)
- **GIS & Mapping:** Leaflet OpenStreetMap tiles, custom DivIcon pulsing priority markers, DBSCAN density hotspot circles (`eps=650m`), coordinate coarsening for public privacy (~1.1 km, 2 decimal places)
- **Concurrency & Locking:** Distributed 10-minute soft edit lease (`LockManager`) with optimistic version checks (`version` increments)
- **Security & MFA:** Bcrypt password hashing, JWT bearer tokens, TOTP multi-factor authentication, 15-minute idle session timeout, citizen daily submission rate limiters (5 reports/day)
- **Visual System:** Dual-experience support: CivicTrack warm ivory (`#F7F7F1`), deep forest green (`#174B38`), and vibrant civic orange (`#FF873E`), paired with executive dark dispatch styling.

---

## 🔒 Permission Matrix (Strictly Enforced)

| Capability | Visitor | Citizen | Staff | Admin | Super Admin |
|:---|:---:|:---:|:---:|:---:|:---:|
| View public dashboard & map (coarsened places) | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |
| Submit a report (text, images, location) | No | **Yes** | No | **Yes** | **Yes** |
| View status & timeline of OWN reports | No | **Yes** | n/a | **Yes** | **Yes** |
| View report details | No | **Own only** | **Assigned only** | **All** | **All** |
| Verify, categorize, set priority | No | No | No | **Yes** | **Yes** |
| Assign or reassign to department/staff | No | No | No | **Yes** | **Yes** |
| Add progress notes and proof photos | No | No | **Assigned only** | **Yes** | **Yes** |
| Mark "Work completed" | No | No | **Assigned only** | **Yes** | **Yes** |
| Set "Resolved" (final sign-off) | No | No | No | **Yes** | **Yes** |
| Merge duplicates, reject, bulk actions | No | No | No | **Yes** | **Yes** |
| See reporter identity & exact coordinates | No | Own coords | Location only | **Yes** | **Yes** |
| Manage users, roles, departments, SLAs | No | No | No | No | **Yes** |
| Read append-only audit log | No | No | No | **Yes** | **Yes** |

---

## 🔄 Controlled Status State Machine

```
Submitted (Unverified)
   │ (Admin/Super Admin triage)
   ▼
Under review
   │ (Admin verification)
   ▼
Verified
   │ (Admin dispatch)
   ▼
Assigned
   │ (Assigned Staff begins work)
   ▼
In progress
   │ (Assigned Staff with required note & proof photo)
   ▼
Work completed
   │ (Admin review with Two-Person Rule: Signer != Completer)
   ▼
Resolved (Final Sign-off)
```

### Side Exits & Safeguards:
- **Rejected:** Allowed from `submitted`, `under_review`, `verified`, or `assigned` by Admin. Requires note with $\ge 10$ characters.
- **Duplicate:** Links to an active parent report with advisory distance and similarity scoring. Merges carry a 24-hour undo window.
- **Reopened:** Returns from `work_completed` or `rejected` back to `assigned`. Requires an explanation note with $\ge 10$ characters.
- **Two-Person Rule:** If an administrator was also the technician who marked work completed, they **cannot** approve resolution. A separate officer must sign off.

---

## ⚡ Anti-Chaos Safeguards

1. **Ownership & Soft Locking:** Opening a report acquires a 10-minute lease (`"Priya N. is reviewing this"`). Other users are relegated to read-only view. Optimistic concurrency (`version` token) rejects stale overwrites with HTTP 409.
2. **One Owner at a Time:** Exactly one field assignee and one reviewing admin. Reassignment requires a logged reason ($\ge 10$ chars).
3. **SLA Timers & Escalations:**
   - **Critical:** 4h response / 24h resolution
   - **High:** 24h response / 72h resolution
   - **Medium:** 72h response / 7 days resolution
   - **Low:** 7 days response / 14 days resolution
   Overdue items trigger red **SLA breach** pills and populate dedicated filter queues.
4. **Bulk Action Limits:** Batches capped at 25 reports with a confirmation modal and undo link.
5. **Citizen Abuse Controls:** 5 submissions per day rate limit, EXIF metadata stripped on upload, spam/profanity filters.
6. **Privacy Protection:** Public map markers round coordinates to 3 decimal places (~110m). Citizen reporter identity is never exposed publicly. Staff see exact coordinates of their assigned jobs only.

---

## 🚀 Quick Start & Run Instructions

### 1. Requirements
- Node.js $\ge 20$ (Tested on Node.js v24)
- Python 3.12+ (for Unified FastAPI Core)

### 2. Run the Unified FastAPI Application (Recommended)
Build the frontend, seed demo data, and start the FastAPI core on port 5000:
```powershell
# 1. Build frontend
npm run build

# 2. Seed database (creates demo users, categories, departments, and reports)
npm run seed:py

# 3. Start unified FastAPI backend server (serves API & SPA on port 5000)
npm run backend:py
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser.
Interactive API Documentation (Swagger UI): **[http://localhost:5000/docs](http://localhost:5000/docs)**

> *For frontend hot-reloading during development:*  
> Terminal 1: `npm run backend:py` (FastAPI core on port 5000)  
> Terminal 2: `npm run client` (Vite dev server with automatic /api proxy)

### 3. Run Automated Test Suites
Runs all 44 unit, governance, and end-to-end API integration tests:
```powershell
npm run test:py
```
All 44 tests pass in ~3.0s.

To run the legacy Node.js tests:
```powershell
npm test
```

---

## 🎬 3-Minute Live Evaluation Script

Use the **Demo Role Switcher** at the top of the app or click **"Launch 3-Min Demo Tour"** in the bottom-left corner to follow this scenario:

### ⏱️ Minute 0:00 – Citizen Submits an Incident
1. Switch role to **Citizen (Ramesh)** or visit `/report`.
2. Select **Streetlight**, title `"Streetlight out on 5th Main"`.
3. Notice the amber advisory hint:  
   `"Similar report 40 m away. Dark road near bus stop."`
4. Toggle approximate location. Notice the privacy badge: *Photo GPS removed, coordinates coarsened*.
5. Click **"Continue & Submit Report"**. The issue is filed with initial status `Submitted` labeled **Unverified**.

### ⏱️ Minute 0:45 – Admin Triage & Assignment
1. Switch role to **Admin (Priya · Moderator)** or open `/admin/review-queue`.
2. Notice the KPI cards (Pending review 37, SLA breaches 9 in red).
3. Click report **CPR-2026-000123**:
   - Notice the **10-minute soft lock** acquired by Priya.
   - Inspect the segmented **Score Bar** (68 of 100: Safety risk 25, Supporters 20, Main road 15, Age 8).
   - Under *Possible Duplicate*, see the **91% match** pill comparing CPR-000123 and CPR-000131 side-by-side.
4. In *Update Status*, select **Verified** and enter a note.
5. In *Assign*, choose **Arun K. (Electrical Dept)** with reason `"Dispatching ladder truck for luminaire replacement."`. Click **Save Assignment**.

### ⏱️ Minute 1:30 – Staff Performs Repair & Uploads Proof
1. Switch role to **Staff (Arun · Elec)** or open `/staff/assignments`.
2. Notice Arun sees **only** jobs assigned to him (8 jobs) and sees **exact coordinates** with a map link.
3. Observe that Arun **cannot** verify, reassign, merge, or resolve issues (those buttons do not exist).
4. Click **Start Work** (status changes to `In Progress`).
5. Click **Mark Work Completed**:
   - Enter note: `"Replaced faulty LED luminaire and tested circuit ground."`
   - Upload/attach the completion proof photo.
   - Click submit. Status is now `Work completed` (awaiting admin sign-off).

### ⏱️ Minute 2:15 – Two-Person Resolution Sign-Off
1. Switch back to **Admin (Priya)** and click the **Awaiting sign-off** tab.
2. Open the work completed ticket:
   - Priya sees the staff's proof photo side-by-side with original report.
   - Enter sign-off note: `"Inspected photo proof; streetlight verified operational."`
   - Click **Approve and Resolve**. Status transitions to `Resolved`.
3. *(Test Anti-Chaos Two-Person Rule)*: If Arun attempts to sign off on his own work, the server rejects it immediately with a 400 error.

### ⏱️ Minute 2:45 – Super Admin Inspects Immutable Audit Log
1. Switch role to **Super Admin (Vikram)** or open `/superadmin/settings`.
2. Click the **Audit Log** tab:
   - Observe the append-only ledger recording Priya's assignment, Arun's completion, and Priya's sign-off, complete with IP addresses, timestamps, and JSON diffs.
3. Click **Export CSV** to download the official audit ledger.
4. Open **User Management** to demonstrate role invitations (Staff/Admin) with enforced MFA enrollment.

---

## 📁 Repository Structure
```
civictrack/
├── backend/
│   ├── src/
│   │   ├── auth/                # JWT, Bcrypt, TOTP MFA service, middleware
│   │   ├── db/                  # In-memory database, spatial math, seed data
│   │   ├── safeguards/          # Soft-lock manager, SLA engine, abuse prevention, audit logger
│   │   ├── workflow/            # StateMachine engine (allowed/forbidden transitions)
│   │   ├── routes/              # REST endpoints (auth, public, reports, staff, admin, superadmin, audit, locks)
│   │   ├── tests/               # Automated test suites (state machine, permissions, concurrency)
│   │   └── server.ts            # Express server entry point
├── src/
│   ├── api/client.ts            # Typed HTTP client with token handling
│   ├── components/
│   │   ├── common/              # Button, Pill, RoleBadge, Card, StatTile, ScoreBar, MapPreview, LockBanner, SlaTimer, Icons
│   │   ├── guards/              # RoleGate component
│   │   └── layout/              # Navbar, Footer, MobileNav
│   ├── context/                 # AuthContext (with demo switcher) & ToastContext
│   ├── screens/
│   │   ├── Screen0_Auth/        # LoginScreen & StaffLoginScreen (MFA step)
│   │   ├── Screen1_CitizenReport/# Mobile 390x844 responsive report form
│   │   ├── Screen2_CitizenTracking/# My reports & read-only timeline
│   │   ├── Screen3_PublicDashboard/# Fluid desktop dashboard, map & charts
│   │   ├── Screen4_StaffAssignments/# Staff queue & proof upload
│   │   ├── Screen5_AdminReviewQueue/# Admin triage, duplicate comparator, sign-off
│   │   ├── Screen6_SuperAdmin/  # Users table, SLA policies & audit log
│   │   └── Screen7_ErrorStates/ # 403 Forbidden & Session Expired modal
│   ├── tokens/                  # Design tokens JSON & TypeScript constants
│   ├── App.tsx                  # Client router & global dialogs
│   ├── main.tsx                 # React DOM root
│   └── index.css                # Tailwind CSS v4 directives & font imports
├── db/
│   └── migrations/
│       ├── 001_initial_schema.sql # Complete PostgreSQL DDL
│       └── 002_postgis_setup.sql   # PostGIS geography columns, spatial indexes, triggers
├── openapi.yaml                 # Complete OpenAPI 3.0 specification
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🏆 Summary of Hackathon PS-14 Acceptance Criteria
- [x] **Citizen Self-Service:** Citizens register, submit issues, and see only their own reports. 403 on all unauthorized routes.
- [x] **Staff Visibility:** Field workers see only assigned tickets, can upload proof and mark work completed; cannot self-resolve or triage.
- [x] **Two-Person Resolution Rule:** Admin resolution requires separate review of staff proof. Same user cannot complete and resolve.
- [x] **Anti-Chaos Soft Locking:** 10-minute lease prevents dual edits; version checking blocks stale overwrites.
- [x] **Audit Ledger:** Append-only logging with actor, IP, timestamp, and CSV export. No edit or delete capabilities.
- [x] **Strict Design Tokens:** Cream `#FBF6EF`, Ink `#1E1B18`, Rust `#B03A0C`, Teal `#0F766E`, Fraunces 600 serif headings, flat 1px borders, custom 2px stroke SVG icons, zero emoji, zero gradients, zero shadows.

