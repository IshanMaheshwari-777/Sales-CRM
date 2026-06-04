# Exploratory QA Run - 2026-04-18

## Execution Log
Date: 2026-04-18  
Tester: Codex  
Environment: Local Vite app at `http://127.0.0.1:4175` with live Supabase-backed auth/data  
Roles covered:
- Super Admin: `swanandm@gmail.com`
- Team Lead: `swanandm@degreebaba.com`

Areas covered:
- auth and sign-out
- top-level navigation
- workflow automation modal validation
- admin dashboard tabs
- super admin dashboard and org switcher
- email template modal access
- lead add modal validation
- follow-ups module load

Automated smoke result:
- 6 passed, 0 failed, 0 skipped after credentials were provided

Manual exploratory summary:
- Core auth and navigation flows are working.
- Lead add modal validation is working for invalid mobile numbers.
- Workflow Automation create modal opens and validates missing workflow names.
- Admin Dashboard tabs are reachable.
- Template creation modal is reachable for the Team Lead account.

## Findings

### P1 - Super Admin Dashboard - Org switcher backdrop blocks the CRM
Module: Super Admin Dashboard  
Role: Super Admin  
Severity: P1

Repro steps:
1. Log in as super admin.
2. Open the organization switcher from the top header.
3. Dismiss it and try to click elsewhere in the CRM.

Expected result:
- The org switcher closes cleanly and the rest of the page becomes interactive again.

Actual result:
- A full-screen backdrop remains active and intercepts clicks on the rest of the app.
- The user can get stuck until the page is refreshed.

Evidence:
- Observed during the exploratory run in the org-switcher flow.

### P2 - Super Admin Dashboard - Org switcher is visible but empty
Module: Super Admin Dashboard  
Role: Super Admin  
Severity: P2

Repro steps:
1. Log in as super admin.
2. Open the organization switcher from the top header.

Expected result:
- The user sees one or more selectable organizations, or the control is hidden/disabled when only one org exists.

Actual result:
- The switcher opens with no selectable organization options.

Evidence:
- Observed during the exploratory run immediately after opening the org switcher.

### P2 - Settings/Admin - repeated failed-fetch errors while loading feature data
Module: Basic Settings, Assignment Rules, Webhook Integrations, organization-related admin data  
Role: Super Admin and Team Lead  
Severity: P2

Repro steps:
1. Log in as super admin and visit Admin Dashboard tabs including Assignment Rules and Webhook Integrations.
2. Log in as team lead and open Basic Settings / Email Templates.

Expected result:
- Supporting data loads without repeated browser-console fetch failures.

Actual result:
- The browser console repeatedly logs fetch failures such as:
  - `Error fetching template data`
  - `Error fetching webhook configs`
  - `Error fetching endpoints`
  - `Error fetching assignment rules`
  - `Error loading organizations`
- The template area in particular produced repeated fetch-error spam instead of a clean single failure path.

Evidence:
- Captured by the exploratory Playwright harness during the run.

## No Defects Observed In This Pass
- login page and forgot-password entry
- admin/super-admin sign-in and sign-out
- top-level left-nav switching
- add-lead modal open flow and mobile validation
- workflow create modal open + empty-name validation
- admin invitation screen visibility

## Notes
- This pass was exploratory, not exhaustive.
- The repeated failed-fetch console errors should be investigated next because they may indicate either broken API calls or a retry/render loop that will hurt UX and performance.
