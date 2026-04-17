# PRD — Emergent (Bahri Contract, Recap & Clause Platform)

## Original Problem Statement
Build a shipping-industry SaaS for Bahri that helps Chartering, Legal, Operations, and Management teams manage fixture recaps, centralise contracts, govern a clause library, and maintain a full audit trail. Branded with Bahri Blue (#002856) primary and Bahri Orange (#F15A29) accents. AI-first, AI-assisted information retrieval (not legal advice).

## Architecture
- Backend: FastAPI + MongoDB (motor), JWT auth, emergentintegrations for GPT-5.2 + object storage
- Frontend: React 19 + Tailwind, Bahri theme, Chivo / IBM Plex Sans / JetBrains Mono typography, cardless/flat rounded-none layout
- Object storage: Emergent built-in (session-scoped storage key)

## User Personas
1. **Chartering Broker** — creates recaps, pastes broker emails, triggers AI parse, runs Q88 vessel lookup, submits for review
2. **Legal Counsel** — governs Clause Library: creates/approves/versions clauses, runs AI compare, links clauses to recaps
3. **Operations Manager** — reviews approved fixtures, uploads execution docs (invoices/certificates), marks Fully Fixed
4. **Admin** — manages users, seeds demo data, maintains audit trail

## Data Model
- users (id, email, password, name, role, created_at)
- recaps (id, charter_party_id, vessel_name, charterer, status, raw_text, structured, versions[], linked_clauses[], created_by, created_at, updated_at)
- clauses (id, title, category, tags[], text, versions[], is_approved, created_by, created_at, updated_at)
- approvals, comments, notices, attachments, audit_logs (all keyed to entity_id)

## Implemented (v2 — Feb 2026)
### Rebrand & UX
- Renamed to "Emergent by Bahri" with Bahri Blue navy primary + Bahri Orange accents
- Login/Register rebranded, sidebar reversed to navy header with orange logo square
### Clause Library (core requirement)
- CRUD with versioning, tagging, category classification (BIMCO/Shelltime/Asbatankvoy/Piracy/Sanctions/ETS/War Risk/General/Custom)
- Legal-only approval workflow (is_approved flag, 403 for non-legal)
- Side-by-side compare with GPT-5.2 AI analysis (differences, overlaps, summary, disclaimer)
- Link clauses to recaps via /recaps/{id}/clauses
### Q88 Vessel Lookup (MOCKED)
- Search by name or IMO across 8 seeded vessels (incl. BAHRI ABHA/TABUK/JEDDAH)
- Auto-fills vessel_name + vessel_imo in Create Recap form
### Audit Trail
- Every mutation (create/update/revise/approve/reject/fix/upload/delete/link/notice) logged with user + role + summary
- Global feed at /audit and per-recap in Audit tab
### Alerts
- Auto-derived: laycan approaching (info/warning/critical), pending approvals
- Dashboard card + dedicated page, click-through to recap
### Attachments
- Object storage via Emergent integration
- Per-recap upload with category (invoice/certificate/charter_party/approval/document)
- Soft-delete (is_deleted flag), auth via ?auth= query param for download
### Noticeboard
- Internal announcements with pinning, posted into audit trail
### Other
- Charter Party IDs (CP-YYYYMMDD-XXXXXX) linking recaps and attachments
- Stats endpoint now includes clause counts
- 8 tabs on Recap Detail: Overview, Raw Text, Versions, Linked Clauses, Attachments, Comments, Approvals, Audit
- Power BI shortcut (placeholder link)

## Test Results (iteration 2)
Backend: 30/30 · Frontend: 25/25 · Zero critical or minor bugs

## Backlog (P0 / P1 / P2)
### P0
- Real Q88 API integration (requires Bahri licence key)
- Real Power BI embed (requires Azure AD tenant config)
- Email auto-ingest of broker communications (IMAP / SendGrid inbound)
- Document-level permissions (role-based visibility on attachments)

### P1
- TCE calculator, Voyage P&L estimation
- CP (Charter Party) draft generator from approved clauses
- Full-text search across recaps + clauses + notices
- Excel export of dashboard / CP register

### P2
- Real-time collaboration (websocket presence + live edit)
- Counterparty risk scoring
- Continuous learning parser from user corrections
- Multi-tenant mode if Bahri expands to partners
