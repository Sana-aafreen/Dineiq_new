# DineIQ Integration Summary

This branch contains the SQLite-first and Android-packaged DineIQ integration built on top of `pre_main`.

## What Changed

- Moved the runtime flow toward SQLite-first data handling for backend, local-server, Webapp, and Dashboard.
- Added local Wi-Fi / LAN ordering mode so customers can continue ordering through the local server when internet is unavailable.
- Added sync-aware local order storage with `pending_sync`, `synced`, `failed`, and `conflict` states.
- Updated the manager Dashboard to surface both online and offline/local orders from SQLite-backed APIs.
- Added Google Sheets backup and one-time import tooling so historical Google data can be preserved in SQLite.
- Added migration status visibility for checking whether Google Sheets history has been brought into SQLite.
- Improved customer Webapp mobile usability, sticky header behavior, offline prompts, payment/cart reset flow, and order-history handling.
- Added offline media caching for menu images and offer assets using IndexedDB so the menu can still render with images in PWA/local mode.
- Added Android packaging via Capacitor for both the customer Webapp and the manager Dashboard.

## Main Architecture

### Online mode

- Customer app talks to the backend API.
- Orders are stored directly in backend SQLite.
- Dashboard reads backend SQLite-backed dashboard endpoints.

### Local Wi-Fi / offline LAN mode

- Customer app talks to the local server over the restaurant LAN.
- Orders are stored locally first in local SQLite.
- Dashboard can surface local orders with sync state.
- Sync pushes local orders into backend SQLite when connectivity returns.

## Key Areas Updated

### Backend

- CORS and local testing support improved.
- Guest checkout, guest history, upsell serialization, and order item resolution issues were fixed.
- Added SQLite-backed dashboard APIs.
- Added Google Sheets menu refresh into backend SQLite.
- Added backup/import scripts for Google Sheets historical data.

### Local server

- Expanded local SQLite schema for orders and menu data.
- Stores local order IDs in `Ord_0001` style.
- Saves menu data locally and serves it in local mode.
- Supports sync status tracking and manual refresh/sync endpoints.

### Customer Webapp

- Added network mode switching between online and local Wi-Fi mode.
- Improved offline/local prompts and local-server opening flow.
- Added offline order persistence and IndexedDB media caching.
- Improved mobile friendliness on login and home experiences.
- Added Capacitor Android packaging.

### Manager Dashboard

- Reads SQLite-backed APIs rather than depending on live Google Sheets for the migrated pages.
- Surfaces offline/local order visibility and sync status more clearly.
- Added Capacitor Android packaging.

## Android Builds

Debug APKs have been generated for both apps:

- Customer Webapp APK:
  - `Frontend/Webapp/android/app/build/outputs/apk/debug/app-debug.apk`
- Manager Dashboard APK:
  - `Frontend/Dashboard/android/app/build/outputs/apk/debug/app-debug.apk`

## Before Pushing

- Review and stage only the intended source changes.
- Do not commit local `.env` files.
- Do not commit SQLite WAL/SHM runtime files or backup exports.
- Decide whether the main SQLite database file should be committed or treated as local runtime data.
- Create a new branch from `pre_main` before committing and pushing.

## Suggested Next Step

Create a new feature branch from `pre_main`, review the staged file list carefully, and then push the cleaned integration branch to GitHub.
