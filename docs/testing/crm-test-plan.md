# CRM Hybrid Test Plan

## Purpose
This project uses a hybrid QA approach:

- manual QA for broad, decision-complete surface coverage
- Playwright smoke automation for the highest-risk regression paths
- local-first execution against the Codex workspace and the connected Supabase project

This is intentionally not an attempt to automate every possible click in v1. The first goal is dependable coverage over the business-critical paths and a repeatable process for finding, fixing, and re-testing defects quickly.

## Test Scope
Coverage spans these modules:

- auth and invitation acceptance
- lead manager and lead detail workflows
- follow-ups manager
- bulk actions and filtered bulk operations
- basic settings and message templates
- admin dashboard modules
- super admin dashboard modules
- workflow automation
- cross-module navigation and performance smoke

## Role Matrix
| Role | Core Scope | High-Risk Permissions |
| --- | --- | --- |
| Regular user | login, leads, follow-ups, assigned templates, day-to-day CRM workflows | cannot access admin-only or super-admin-only modules |
| Admin | all regular-user flows plus templates, invitations, user management, assignment rules, workflow automation | must see admin surfaces and must not see super-admin-only functions unless also super admin |
| Super admin | org switching, organization-level controls, cross-org visibility, all admin flows | must retain org-isolated correctness while switching organization context |

## Test Data Contract
Use stable local credentials and seeded data before executing the suite:

- `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`
- `E2E_SUPER_ADMIN_EMAIL` / `E2E_SUPER_ADMIN_PASSWORD`

Recommended seeded data:

- at least 20 leads across multiple statuses, owners, sources, channels, and campaign names
- at least 1 approved email template and 1 draft template
- at least 1 pending invitation
- at least 1 workflow with conditions and actions
- enough records to validate destructive and non-destructive behavior without using production data

## Module Inventory
### Auth and session
- login
- logout
- forgot password entry
- invitation acceptance while logged out
- invitation acceptance while another user is logged in
- permission-gated redirects

### Lead workflows
- create lead
- edit lead
- stage and sub-stage changes
- notes, calls, email, WhatsApp interactions
- lead search
- filter modal behavior
- server-side pagination
- exports and bulk actions

### Follow-ups
- create, edit, complete, reassign, and filter follow-ups
- due-date and owner visibility
- follow-up list refresh after state changes

### Bulk actions
- selected-only actions
- all-filtered actions
- assign owner
- stage change
- referral
- delete behavior and confirmations

### Settings and templates
- create template
- save draft
- submit for approval
- approve or reject
- active or inactive visibility
- assigned-user visibility

### Admin dashboard
- user invitations
- invited-user acceptance outcomes
- user list and permissions
- role visibility
- assignment rules and team management

### Super admin dashboard
- organization switching
- organization management
- cross-org isolation
- permission denial for non-super-admin roles

### Workflow automation
- create workflow
- edit workflow
- duplicate workflow
- delete workflow
- active toggle
- multi-condition `AND` / `OR`
- action configuration
- validation and template selection

### Performance and regression smoke
- first-load latency of major modules
- repeat navigation across modules
- lead list load at large data volume
- no obvious broken modals, spinner stalls, or dead buttons

## Severity Rubric
| Severity | Definition | Example |
| --- | --- | --- |
| P0 Critical | Business-stopping defect with no workaround | login broken, leads fail to load, destructive data corruption |
| P1 High | Core workflow broken but partial workaround exists | cannot create invite, templates fail to save, bulk action fails |
| P2 Medium | Important but non-blocking issue | validation bug, stale counts, role mismatch on secondary screen |
| P3 Low | Cosmetic or minor UX defect | copy mismatch, spacing issue, non-blocking console noise |

## Execution Rules
- Test locally first, not against the published Bolt site.
- Run smoke automation before manual exploratory testing when possible.
- Re-test fixes in the same role and module where the defect was discovered.
- Any admin or destructive action should be verified in a safe test-data context.
- When performance is under review, record actual timings and dataset context instead of subjective language alone.

## Defect Logging
Use the defect template in [defect-report-template.md](/Users/swanand/Documents/Codex/2026-04-17-hi-i-have-built-a-sales/sales-crm/docs/testing/defect-report-template.md).

## Automated Coverage Strategy
Playwright covers the highest-risk smoke paths first:

- auth entry and sign-out
- major module navigation
- add-lead modal smoke
- template creation modal smoke
- admin invitation management smoke
- workflow automation modal smoke

The initial automation is deliberately light on data mutation. Expand toward create-edit-delete regression flows only after the seeded test dataset is stable enough to support repeatable runs.
