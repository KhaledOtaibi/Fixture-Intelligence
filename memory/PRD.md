# PRD — Fixture Intelligence Platform

## Original Problem Statement
Build a web-based SaaS platform for the shipping industry that helps chartering, operations, and legal teams manage fixture recaps, automate data extraction from broker communications, track deal versions, and generate structured commercial insights. AI-first — the recap parser is the hero feature.

## Architecture
- **Backend**: FastAPI + MongoDB (motor), JWT auth (bcrypt + pyjwt), emergentintegrations library for GPT-5.2 parsing.
- **Frontend**: React 19 + React Router 7, Tailwind, lucide-react, sonner toasts, shadcn components available.
- **Design**: Swiss / High-Contrast light theme (zinc + blue-600), Chivo / IBM Plex Sans / JetBrains Mono, cardless flat borders, rounded-none.

## Data Model
- `users`: id, email, password (bcrypt), name, role (chartering | operations | legal | admin), created_at
- `recaps`: id, vessel_name, charterer, status (draft | under_review | approved | fixed), raw_text, structured (12 fields), versions[ {version_label, raw_text, structured, created_by, created_by_name, created_at, note} ], created_by, created_by_name, created_at, updated_at
- `comments`: id, recap_id, user_id, user_name, user_role, text, created_at
- `approvals`: id, recap_id, user_id, user_name, user_role, action (submitted|approved|rejected|fixed), comment, created_at

## User Personas
1. **Chartering Broker** — creates recaps, pastes broker emails, hits AI parse, saves drafts and submits for review.
2. **Operations Manager** — reviews, approves, marks fixtures as Fixed when loading confirmed.
3. **Legal Counsel** — approves/rejects based on terms and clause review.
4. **Admin** — manages users, seeds demo data, deletes recaps.

## Implemented (v1 — Feb 2026)
- JWT register/login/me endpoints with roles
- AI Parser endpoint using GPT-5.2 via Emergent LLM Key
- Recap CRUD (create, list with filters, get, patch with auto-version bump, delete admin-only)
- Approval workflow: submit → approve / reject / fix with server-side state & role enforcement
- Comments thread per recap
- Stats endpoint (total + by_status)
- Seed endpoint loading 5 demo fixtures in varied statuses
- Login / Register pages (split 50/50 with cargo ship imagery)
- Dashboard: stats strip, search, status filters, sortable fixture table, empty state
- Create Recap page with 50/50 split pane (raw text + structured form) and "Parse with AI" action
- Recap Detail with 5 tabs (Overview, Raw Text, Versions, Comments, Approvals)
- Version diff viewer (red=removed / green=added) with history sidebar
- Copy-formatted-text to clipboard
- Print-friendly PDF export via window.print()
- 28/30 backend + 16/16 frontend tests passing (2 false positives on _id substring check)

## Prioritised Backlog
### P0 (next)
- Email integration (auto-ingest broker emails via IMAP or SendGrid inbound parse)
- Dashboard charts (fixtures over time, freight trend)

### P1
- TCE (Time Charter Equivalent) calculator module
- Voyage P&L estimation
- CP (Charter Party) draft generator
- Clause library (Shelltime, Asbatankvoy)

### P2
- Counterparty risk scoring
- Real-time collaboration (websocket) — Notion-style presence
- Continuous learning: fine-tune parser from user corrections
- Mobile-optimised layout refinements
