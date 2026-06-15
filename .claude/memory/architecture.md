# Architecture

## Current Architecture Status

Current status:

Functional Premium MVP

Transitioning into:

Stabilization + Risk Core Completion

The current architecture is approved and should be preserved.

Major architectural changes require strong justification.

---

# System Overview

Google Sheets

↓

Apps Script

↓

JSON API

↓

React Frontend

↓

Vercel Deployment

---

# Data Source

Primary source of truth:

Google Sheets

The spreadsheet contains:

* portfolio positions
* allocations
* reserve data
* futures data
* scenarios
* decision data
* portfolio metrics

Google Sheets is currently an accepted solution.

Do not propose database migrations unless specifically requested.

---

# Backend Layer

Current backend:

Google Apps Script

Purpose:

* data normalization
* calculations
* API generation
* frontend delivery

Output:

JSON API

---

# API Layer

Current endpoints:

/api/investor

/api/fear-greed

The API contract is critical infrastructure.

Avoid introducing breaking changes.

---

# Frontend Stack

Current stack:

* React
* TypeScript
* Vite
* CSS

Current frontend is functional.

Priority is stabilization.

Not rewriting.

---

# Deployment

Current deployment:

Vercel

Deployment workflow should remain simple.

Avoid unnecessary infrastructure complexity.

---

# Current Product Pages

Overview

Portfolio

Risk

Decisions

Scenarios

---

# Current Product Modules

Portfolio Overview

Portfolio Table

Allocation System

Reserve Tracking

Futures Tracking

Health Factor

Fear & Greed

Decision Engine

Scenario Engine

Market Psychology Engine

---

# Architecture Priorities

Priority 1

Stabilization

Priority 2

Risk Engine Completion

Priority 3

Modularization

Priority 4

Analytics

Priority 5

Decision Engine Expansion

Priority 6

Automation

Priority 7

AI Layer

Priority 8

Backend Migration

Priority 9

Mobile Application

---

# Engineering Rules

Prefer:

* refactoring
* modularization
* maintainability
* simplicity

Avoid:

* unnecessary rewrites
* technology churn
* premature optimization
* architecture overengineering

---

# Frontend Rules

Preserve current UI geometry.

Preserve approved layouts.

Preserve approved navigation.

Preserve visual consistency.

Do not redesign working screens without explicit instruction.

---

# API Rules

All calculations should have a single source of truth.

Avoid duplicated calculations.

Avoid duplicated business logic.

Normalize:

* categories
* status values
* units
* portfolio metrics

---

# Future Direction

Current architecture is sufficient for MVP and early growth.

Expected evolution:

Google Sheets

→ Apps Script

→ Dedicated Backend

→ Multi-user SaaS

→ Mobile Application

Migration should happen only after current architecture becomes a bottleneck.

Not before.

---

# Architectural Principle

The goal is not technical perfection.

The goal is delivering a reliable investor operating system with strong risk management and decision support.
