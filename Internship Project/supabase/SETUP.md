# Supabase setup

1. Open the Supabase project dashboard, go to **SQL Editor**, paste the contents of `schema.sql`, and run it. This creates the portal tables, row-level security policies, and the private `portal-files` storage bucket. In **Storage**, confirm a private bucket named `portal-files` exists. If the bucket is missing, run the following in SQL Editor:

   ```sql
   insert into storage.buckets (id, name, public)
   values ('portal-files', 'portal-files', false)
   on conflict (id) do update set public = false;
   ```

   The storage policies at the end of `schema.sql` must also have run for authenticated uploads and downloads to work.
2. In **Authentication → Providers → Email**, disable Supabase email confirmation. Student email ownership is checked using the portal's EmailJS OTP step.
3. In EmailJS **Account → Security**, allow the published origin `https://warlock247.github.io`. Test signup using the published HTTPS site or a local HTTP server, not by opening the `.html` file directly. A `file://` page has no browser origin and EmailJS rejects it. Do not enable non-browser API access just to test a local file.
4. In **Authentication → Users**, create or update the lecturer Auth user using the lecturer's real email and password `lecturer2026`; mark the email as confirmed.
5. Promote that user by running this in **SQL Editor**, replacing the example email with the same real email used for that Auth user:

   ```sql
   update public.profiles
   set role = 'lecturer'
   where lower(email) = lower('lecturer@university.edu');
   ```

6. Push the updated project files and confirm the GitHub Pages deployment finishes. New student accounts are stored online in Supabase. Old browser-local data is not imported automatically.

The Supabase publishable key is used by the browser. Never put a Supabase service-role key or database password in the website. Lecturer login uses the lecturer's email and the passcode; Supabase authenticates that account and applies lecturer-only row-level security.

Students enter their surname as their password. Internally, the app combines the surname with their matric number to meet Supabase's six-character minimum; students still log in with the surname and matric number fields. Accounts created by an older version are also accepted with their original surname-only Auth password. Surnames and the shared lecturer passcode are weak credentials; anyone who learns `lecturer2026` and the lecturer email can access the lecturer dashboard.

EmailJS OTP sending requires the deployed origin to be allowed in EmailJS **Account → Security**. Ensure the EmailJS template uses `{{to_email}}`, `{{otp_code}}`, and `{{to_name}}`, and the configured service is active. The OTP check currently runs in the browser, so it is not a server-enforced identity check. For official records, validate matric numbers against a trusted roster and move verification into a trusted server function.
