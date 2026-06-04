# Manual QA Checklist

## How To Use This Checklist
For each module:

- verify the page can be opened from its intended entry point
- click every visible button, tab, toggle, menu action, and close control
- classify each control as `critical workflow action`, `secondary UX action`, `destructive/admin action`, or `dead/placeholder/non-functional`
- confirm expected state changes, validation, permissions, and refresh behavior

Record issues using the defect template.

## Auth and Session
- Open login page and confirm email, password, submit, forgot-password, and sign-up switch render correctly.
- Trigger forgot password and confirm reset form renders.
- Log in as regular user and verify admin-only nav items are hidden.
- Log in as admin and verify admin-only nav items are visible.
- Log in as super admin and verify super-admin dashboard plus organization switcher are visible.
- Open invitation link while logged out and confirm invitation flow loads.
- Open invitation link while another user is logged in and confirm sign-out-to-continue behavior appears.
- Sign out from the header menu and confirm session returns to login.

## Lead Manager
- Open lead list and confirm list, search, tabs, filters, and pagination load.
- Search by name, mobile, and email.
- Open filters and verify owner, source, channel, campaign, status, sub-status, city, and country filters behave correctly.
- Open add-lead modal and verify all required-field validations.
- Create or stage a test lead if safe test data exists.
- Open a lead detail record and click all action tabs and interaction buttons.
- Verify notes, call, email, and WhatsApp actions do not leave the UI in a stuck state.

## Follow-ups
- Open follow-ups page and test filters, sorting, completion, and reassignment.
- Verify counts and row refresh after update.
- Confirm overdue and completed states are visually distinct and consistent.

## Bulk Actions
- Select a few leads and open each bulk action menu.
- Run non-destructive validations first.
- Verify “selected leads” and “all matching leads” flows both behave correctly.
- Confirm destructive actions show confirmation and recover cleanly after cancel.

## Basic Settings and Templates
- Open Email Templates and WhatsApp Templates tabs.
- Create template modal:
  - click variable picker buttons
  - toggle preview
  - assign users
  - save as draft
  - submit for approval
- Verify assigned users can see approved active templates and cannot see unapproved ones.
- If approval roles are available, approve and reject a template and re-check visibility.

## Admin Dashboard
- Open Invitations and click invite, cancel, resend, and copy-link actions.
- Verify invite capacity banner behavior if org seats are near limit.
- Open user-management surfaces and check role visibility, permission gating, and edit flows.
- Validate assignment-rule and team-management actions if available.

## Super Admin Dashboard
- Switch organization context and verify the rest of the app refreshes into the selected organization.
- Confirm org-scoped pages reflect the new org and do not leak previous-org data.
- Validate non-super-admin users cannot reach these controls.

## Workflow Automation
- Open workflow list and verify create, refresh, edit, duplicate, toggle, and delete controls.
- Create a workflow with one condition and one action.
- Create a workflow with 2 or more conditions and verify `AND` / `OR` gate controls appear.
- Validate action types:
  - update field
  - create follow-up
  - send email
- Confirm invalid or incomplete forms surface clear validation.

## Performance Smoke
- Measure first load time for Lead Manager, Admin Dashboard, Basic Settings, and Workflow Automation.
- Switch quickly across multiple modules and confirm no spinner stalls or white-screen transitions.
- With a large filtered lead set, verify list performance, pagination, and search responsiveness remain acceptable.
