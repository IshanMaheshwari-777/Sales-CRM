# CRM Mobile App Design Brief for Claude

## Overview

This mobile app is a fast, mobile-first CRM built for sales reps, team leads, and lightweight admin users who need to work leads quickly while on the move.

The product is centered around speed of execution:
- opening the app and immediately understanding what needs attention
- calling leads quickly
- updating lead outcomes with minimal typing
- managing follow-ups without losing momentum
- moving between leads, follow-ups, and key actions with very little friction

The current mobile app is functionally useful, but the UI and overall experience are not yet where we want them to be. The purpose of this brief is to help redesign the product visually and structurally while preserving the underlying job the app must do.

This should be treated as a UI/UX redesign brief, not a code brief.

## Core Users

### Sales Reps
Sales reps use the app to:
- log in quickly
- review their workload
- call leads aggressively
- update outcomes immediately after calls
- schedule next follow-ups
- search and filter leads on the go

### Team Leads
Team leads use the app to:
- do the same lead work as reps
- monitor team pulse and workload
- track pending actions and follow-up health
- quickly inspect and intervene when needed

### Mobile Admin / Manager Users
These users should not get full desktop admin complexity on mobile, but they should retain:
- team-level visibility
- personal lead-working capability
- access to important summary information

## Product Goals

The mobile app should feel:
- fast
- sharp
- decisive
- low-friction
- confident
- built for one-hand use

The app should help a user feel like they can:
- understand priorities immediately
- take action in one or two taps
- return to work fast after leaving the app to call someone
- trust the app when data is syncing, offline, loading, or delayed

## Product Principles

### 1. One-Hand Use
Most core actions should feel thumb-friendly. Large tap targets, bottom-aligned actions, and short gesture paths are preferred.

### 2. Minimum Taps
The app should reduce steps between:
- seeing a lead
- contacting the lead
- logging the outcome
- moving to the next action

### 3. Fast Return to Action
After a call or external action, the user should be able to return to the app and immediately continue updating the lead or moving to the next one.

### 4. Clear Priority Hierarchy
The app should always make it obvious:
- what needs attention now
- what can wait
- what is overdue
- what action is expected next

### 5. High Confidence Feedback
Users should clearly understand:
- whether an update is saved
- whether it is still syncing
- whether something failed
- whether the app is offline

### 6. Strong System States
Loading, empty, offline, success, and error states must feel intentional and trustworthy, not like broken screens.

### 7. Design Freedom With Functional Discipline
The current information architecture and workflows can be visually rethought significantly, but the app must remain highly operational and action-first.

## Current Mobile Information Architecture

The current mobile app has four main tabs:

1. `Dashboard`
2. `Leads`
3. `Follow-ups`
4. `Profile`

Claude has high freedom to rethink layout, hierarchy, and visual emphasis. However, the functional separation should remain:

- `Dashboard` = awareness, summary, priorities, and shortcuts
- `Leads` = browse, search, filter, and open leads
- `Follow-ups` = follow-up execution workspace
- `Profile` = user/account information and sign-out

## Primary Mobile Jobs to Support

The mobile app should make these workflows feel excellent:

1. Log in and understand today’s priorities
2. Find the right lead fast
3. Call / WhatsApp / email a lead immediately
4. Log a quick outcome after contact
5. Update status and sub-status
6. Add a short note
7. Schedule the next follow-up
8. Move on to the next lead with minimal friction
9. Track follow-up workload
10. Let team leads see both personal and team-level health

## Screen-by-Screen Functional Brief

## 1. Login

### Purpose
Allow a user to securely sign in with email and password and enter the mobile CRM quickly.

### Must Support
- email input
- password input
- sign-in action
- loading state while authenticating
- clear error state for bad credentials or auth failures

### UX Notes
- should feel clean, fast, and trustworthy
- should avoid heavy visual clutter
- should clearly indicate when login is in progress

## 2. Dashboard

### Purpose
This is the summary-first home screen. It should answer:
- what matters today?
- what should I do next?
- what is slipping?
- where should I jump?

It is not meant to duplicate the `Leads` tab. It should orient the user and offer fast entry into action.

### Must Support

#### Personal KPI Summary
For all users:
- number of owned leads
- pending follow-ups
- follow-ups due today
- recent updates / recent activity count

#### Team Pulse for Team Leads / Admin Roles
For lead managers / admins:
- team-level visibility
- lightweight team performance or workload indicators
- team pending follow-up health

#### Action-Needed Section
A visible section for:
- overdue items
- urgent leads
- high-priority next actions

#### Quick Shortcuts
Shortcut entry points into:
- `Leads`
- `Follow-ups`
- the next lead detail screen, if applicable

#### Resume Calling / Next Lead
A compact secondary widget that helps the user continue lead work quickly, without making the whole screen feel like a duplicate of the Leads tab.

#### Offline Sync Warning
If updates are queued locally and not yet synced, the dashboard should surface that clearly.

### UX Notes
- summary-first, not queue-first
- should feel like a sharp operational home screen
- should present information in a very scannable way
- should not feel like a miniature desktop dashboard

## 3. Leads

### Purpose
This is the main operational browsing and searching screen for working leads.

### Must Support

#### Browse Leads
Users should be able to scroll through their lead list or org-scoped lead list based on role.

#### Search
Users should be able to quickly search leads by relevant text input.

#### Filters
The current mobile filters include:
- owner
- campaign
- channel
- source
- main status
- sub-status
- city
- date added
- date edited
- call count

These filters should remain available in the redesign, though the UI can be reimagined.

#### Active Filter Visibility
The app should make it obvious:
- how many filters are active
- which filters are active
- how to clear them

#### Lead Cards / Lead Rows
Each lead in the list should support fast actions such as:
- call
- WhatsApp
- email
- open lead detail

### UX Notes
- this screen should feel operational and fast
- it should support both scanning and precise narrowing
- list cards should help a rep act immediately without always needing full lead detail

## 4. Lead Detail

### Purpose
This is the primary action screen for a single lead. It should make it fast to contact the lead and log what happened.

### Must Support

#### Core Lead Snapshot
The lead detail screen should show:
- full name
- mobile number
- email
- relevant high-level lead context
- status/sub-status visibility

#### Fast Communication Actions
The screen must support immediate:
- phone call
- WhatsApp
- email

Important:
- phone calls use the external device dialer
- WhatsApp and email use deep-link style actions

#### One-Tap Outcomes
The app currently supports quick post-contact outcomes such as:
- no answer
- connected
- callback
- wrong number
- converted
- junk

These should remain fast and prominent.

#### Manual Status and Sub-Status Update
Users should be able to manually change:
- main status
- sub-status

#### Notes
Users should be able to add short notes quickly after contact.

#### Next Follow-Up Scheduling
Users should be able to set the next follow-up date/time quickly.

#### Save / Confirm Update
The user should receive strong feedback that the update is saved, syncing, or failed.

### UX Notes
- this is one of the most important screens in the product
- it should feel extremely efficient
- it should support aggressive outbound lead work with minimal hesitation
- typing should be minimized where possible

## 5. Follow-ups

### Purpose
This is the dedicated follow-up execution workspace.

### Must Support

#### Follow-up Segmentation
The current experience includes:
- pending
- today
- all

This can be visually redesigned, but the user must still be able to move through these categories clearly.

#### Follow-up Cards
Each follow-up should help the user understand:
- who the lead is
- what follow-up is due
- when it is due
- whether it is overdue

#### Open Related Lead
Users should be able to jump from a follow-up into the related lead quickly.

#### Mark Follow-up Complete
Users should be able to complete a follow-up with little friction.

#### Overdue Highlighting
Overdue items should be visually distinct.

### UX Notes
- this screen should feel focused and execution-oriented
- it should reduce the chance of missed follow-ups
- it should work well for both reps and team leads

## 6. Profile

### Purpose
Provide identity/account context and sign-out access.

### Must Support
- user name
- email
- mobile number
- role
- organization
- sign-out

### UX Notes
- simple and clean
- should not become a settings-heavy screen in this version

## Cross-Screen Behaviors and States

These behaviors should be preserved and handled thoughtfully in the redesign.

### Role-Aware Views
The app behaves differently depending on user type:
- sales reps primarily see personal work
- team leads and admins should also see team-level summary/pulse data

### Offline Queue / Deferred Sync
The app supports offline or pending updates.

This means:
- lead updates may be queued temporarily
- the user should know when updates are pending
- the user should be reassured that work is not lost
- retry or sync feedback should be clear

### Loading States
Every major screen needs a deliberate loading experience:
- initial screen load
- pull-to-refresh
- loading filtered data
- saving updates

### Empty States
The app should distinguish between:
- truly no data
- no results after filters/search
- no follow-ups due
- no urgent actions currently needed

### Error States
The app should display human-friendly error states for:
- auth failures
- lead loading failures
- update failures
- follow-up loading failures
- sync failures

### Pull-to-Refresh
Refresh interactions should feel natural and reliable on the core operational screens.

### Deep Navigation Into Lead Detail
The app should support direct entry into lead detail from:
- Dashboard
- Leads
- Follow-ups

## Data and Functional Constraints Claude Must Preserve

These constraints are important. The redesign should improve the experience without removing them.

### Fast Lead Updates Must Remain Core
The mobile app exists primarily to help teams work leads quickly. The UI must not slow down post-call updates.

### Phone Calls Use the Device Dialer
The app does not contain built-in VoIP. Calling a lead launches the external phone dialer.

### WhatsApp and Email Are Deep-Link Actions
These actions are external handoffs and should still feel fast and intentional.

### Mobile Lead Filtering Must Stay Available
The `Leads` tab currently supports filtering by:
- owner
- campaign
- channel
- source
- main status
- sub-status
- city
- date added
- date edited
- call count

These can be redesigned visually, but they should not be removed.

### Follow-Ups Must Stay First-Class
This cannot become a purely lead-list app. Follow-up execution is a major part of the product.

### Team Leads / Admins Must Keep Team Visibility
Managerial users should retain a team pulse or team summary view on mobile, even if the UI is simplified.

### Dashboard, Leads, Follow-Ups, and Profile Must Remain
The app can be visually restructured, but these core product areas should remain functionally present.

## What Claude Can Rethink Freely

Claude has high freedom to redesign:
- visual hierarchy
- screen composition
- card layout
- spacing and density
- navigation emphasis
- typography
- color system
- visual language
- iconography
- motion and transitions
- dashboard structure
- list/card behavior
- filters presentation
- action-sheet or bottom-sheet patterns
- prioritization of content within each screen

Claude can also propose:
- a more modern tab structure visually
- better large-action patterns
- better one-hand ergonomics
- stronger empty/loading/offline states
- more elegant post-call workflows

## What Claude Should Not Remove

Claude should not remove these functional capabilities:
- Dashboard
- Leads
- Follow-ups
- Profile
- lead detail update capability
- mobile lead filters
- fast call / WhatsApp / email actions
- notes and follow-up scheduling
- role-aware team visibility for manager/admin users
- offline/pending-sync awareness

## Desired UI/UX Outcome

We want the redesigned app to feel:
- premium
- modern
- fast
- decisive
- sales-first
- highly usable in the field

It should feel like a mobile product designed specifically for high-speed lead handling, not a compressed version of a desktop CRM.

## Requested Deliverables From Claude

Please produce:

1. A clear visual direction for the mobile app
2. A refined navigation proposal
3. High-fidelity mockups for the key screens:
   - Login
   - Dashboard
   - Leads
   - Lead Detail
   - Follow-ups
   - Profile
4. Interaction notes for the most important workflows:
   - opening the app and understanding priorities
   - finding and contacting a lead
   - logging a quick outcome
   - scheduling the next follow-up
   - moving between dashboard, leads, and follow-ups
5. Explicit designs for:
   - loading states
   - empty states
   - error states
   - offline / pending sync states
6. Optional alternative concepts if there is a strong case for more than one direction

## Final Guidance for Claude

Please treat this as a functional redesign brief, not a request to preserve the existing visual design.

You have broad freedom to rethink the UI and interaction design, as long as the mobile app still clearly supports:
- fast lead handling
- fast communication actions
- post-call updates
- follow-up execution
- team-aware visibility for managers

The current app works, but it does not yet feel visually strong or operationally elegant. The goal is to redesign it into something that feels intentionally crafted for aggressive, high-speed sales work on mobile.
