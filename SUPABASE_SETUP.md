# Enable shared public vote totals

The website works immediately in local/demo mode. In that mode, each browser has its own sample ticket counts. Complete these steps before public launch so everyone sees one shared pool.

## 1. Create the database

1. Create a free Supabase project.
2. Open **SQL Editor**.
3. Paste and run the complete contents of `supabase-schema.sql`.

The SQL creates a private vote table and two public functions. Visitors can read totals and cast one vote, but they cannot list the stored voter hashes.

## 2. Connect the page

1. Open **Project Settings → API** in Supabase.
2. Copy the **Project URL**.
3. Copy the public **anon/publishable key**. Never paste the service-role secret into the website.
4. Open `supabase-config.js` and enter the two values:

```js
window.DERBY_SUPABASE = {
  url: "https://YOUR-PROJECT.supabase.co",
  anonKey: "YOUR-PUBLIC-ANON-KEY",
  contestId: "bitcoin-bottom-derby-2026"
};
```

5. Republish the website.

The Bookie Board should then say **Shared public pool** instead of **Local demo pool**.

## What “one vote” means

The browser creates a random device token, hashes it with SHA-256, and submits only the hash. Supabase enforces one accepted vote per token for the contest.

This deters ordinary duplicate voting but is not identity-grade: someone can clear site data or use another browser/device. A real-money or regulated promotion should add sign-in, official eligibility rules, server-side rate limiting, and fraud review.
