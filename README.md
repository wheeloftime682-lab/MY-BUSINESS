# MY BUSINESS

Responsive personal business bookkeeping app (Bangladesh Taka / BDT), including sales, purchases, expenses, parties, products, reports, backup/restore and Samiti member/payout tracking, and separate I Owe / They Owe Me due-account tracking, plus separate I Owe / They Owe Me ledgers. It starts with blank business data. No bank, bKash or Nagad integration is included.

## Run locally
1. Install Node.js (LTS).
2. Run `npm install`.
3. Run `npm run dev`.

Without Supabase credentials, the app runs in Local Mode and stores data in the current browser only.

## Enable Login + Cloud Sync (Supabase)
1. Create a project at https://supabase.com/.
2. In Supabase SQL Editor, run the complete contents of `supabase/schema.sql`.
3. In Supabase Project Settings / API, copy the Project URL and anon/publishable key.
4. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. In Supabase Authentication settings, configure the allowed site URL and email confirmation as you prefer.
6. Run `npm install` then `npm run dev` again (restart Vite after changing `.env`).
7. Create an account in MY BUSINESS and sign in on your other devices with the same account.

### Google / Gmail sign-in setup

The app now shows a **Continue with Google** button in the account/login screen. To activate it:
1. In Supabase Dashboard, open **Authentication → Providers → Google** and enable Google.
2. Create a Google OAuth Client ID and Client Secret in Google Cloud Console (OAuth consent screen / OAuth client).
3. Copy the Supabase callback URL shown in the Google provider settings (usually `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`) into Google Cloud Console → Authorized redirect URIs.
4. Paste the Google Client ID and Client Secret into Supabase's Google provider settings and save.
5. In Supabase **Authentication → URL Configuration**, add your app URL to Site URL / Redirect URLs (for local development add `http://localhost:5173`; for production add your HTTPS domain).
6. Restart the Vite app after `.env` changes. Click the **আমার ব্যবসা / বিজনেস অ্যাকাউন্ট** card to open account options.

Google OAuth credentials are configured in Supabase Dashboard, not in the frontend `.env` file. Never put a Google Client Secret or Supabase service-role key in frontend code. Without valid Supabase URL/key and Google provider configuration, the Google button can display but authentication cannot complete.

The app stores each user's bookkeeping data in a private JSONB row protected by Supabase Row Level Security. The browser keeps a local copy and syncs changes periodically; Realtime updates are used to refresh data changed on another signed-in device. Keep JSON backups too. Never share your Supabase service-role key; only use the anon/publishable key in this frontend app.

## Included features
- Dashboard, transaction ledger (sales, purchases, expenses, collections and payments), customer/supplier directory, product stock, basic reports, and JSON backup/restore.
- Add, edit and delete for transactions, customers/suppliers, products, Samiti members, and due accounts.
- Separate “আমার দেনা” and “আমার পাওনা” accounts with opening balances, additional due entries, partial/full settlements, history, and remaining-balance calculations.
- Samiti records the entered deposit principal and actual monthly payouts; it does not calculate profit, interest, maturity or capital refunds.
- Blank first-run data; no demo products or business information are preloaded.
- No bank, bKash, or Nagad account/payment integration.

## Important limitations
- Cloud sync requires the owner to create/configure a Supabase project and add the two environment values. This archive does not contain private credentials and cannot activate a cloud account by itself.
- Cloud sync currently uses a simple last-write-wins approach. Avoid simultaneous edits to the same account from multiple devices and keep regular JSON backups.
- The source package is not an installed Android APK or deployed public website. Build/deployment steps are required.
- Basic sales/profit summaries are not audited financial statements or tax reports. See `TEST_REPORT.md` for what was and was not verified.
