SANGAT CAFE — ORDER SAVE / CONFIRM / DELETE / TODAY'S ORDERS FIX

This package contains:
- server.js: waits for the Supabase write after order status changes and deletes; reports a cloud-save error instead of falsely reporting success; compares numeric/string order IDs safely; calculates Today's Orders using the Pakistan business day from 4:00 PM to 3:59 PM.
- admin.html: refreshes order and Today's Orders views after status/delete actions, compares order IDs safely in the browser, and counts today's orders using the same 4 PM Pakistan business-day window.

SAFE DEPLOY STEPS
1. Back up the current server.js and admin.html.
2. Replace ONLY server.js and admin.html with these two files.
3. Do NOT replace data.json or change the Supabase table/credentials.
4. In the project terminal run: node --check server.js
5. Commit/push both files and wait for Render deployment to finish.
6. In the admin panel, confirm one pending test order. Wait for the success message and reload: it should remain Confirmed and Today's Orders should count it if it was created after 4 PM Pakistan time's current business-day start.
7. Delete a test order. The server now waits for the Supabase save before showing success. Reload the admin panel: the order should remain removed from active orders and be available in Deleted Orders backup.

If an action returns a cloud-save error, do not repeatedly delete/confirm orders. Open Render Logs and look for “Supabase save failed”; the error message will identify the persistence failure. This package was syntax-checked but cannot be live-tested against your Render/Supabase account from here.
