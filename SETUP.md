# Enabling sign-in, added venues and comments

This project supports a restricted group signing in with one shared
email+password to add new venues and comment on any venue. Everyone uses
the same account, so comments/venues aren't attributed to individuals —
that's expected. Everything is powered by [Supabase](https://supabase.com)
(free tier) and [Nominatim](https://nominatim.org/) (free OpenStreetMap
search, no key).

## 1. Create a Supabase project

Free, at https://supabase.com. Note the project's **Project URL** and
**anon public** API key (Settings > API) for step 4.

## 2. Create the tables

Open the SQL editor in the Supabase dashboard and run the contents of
`supabase/schema.sql` (in this repo). This creates `venues` and `comments`
tables with row-level security so only signed-in users can read or write them.

## 3. Create the one shared account

Supabase's login still needs an email-shaped identifier behind the scenes,
but the app hides that: people only ever see and type a plain **username**.
Pick a username, e.g. `team`, and in the Supabase dashboard go to
**Authentication > Users > Add user > Create new user**. For the email
field enter `<username>@baku-resources.local` (e.g. `team@baku-resources.local`
— it doesn't need to be real/reachable, just match that fixed domain), set
a password, and tick **Auto Confirm User** so it's usable immediately.

Also go to **Authentication > Sign In / Providers** and turn off public
sign-ups, so nobody else can self-register an account.

Share just the username (`team`) and password with your ~20 people (e.g. in
your group chat) — they never see or type the fake email. Anyone without it
can still view the original CSV-based venues (unchanged), but won't be able
to see or add community venues/comments.

If you want a different fake domain than `baku-resources.local`, change the
`USERNAME_DOMAIN` constant near the top of `js/auth.js` to match.

## 4. Add your project keys

Edit `js/supabase-config.js` and replace the placeholders with your
project's URL and anon key from step 1.

## 5. Use it

- "Sign in" in the top bar → enter the shared username + password.
- Once signed in, an "+ Add venue" button appears. Click it, then either
  click a spot on the map or search a name (via the free Nominatim
  geocoder) to place the pin, fill in the details, and save.
- Anyone signed in can add a comment to any venue (CSV-based or
  community-added) from its map popup.

No cost is expected at this scale (~20 users sharing one account) — see the
free-tier limits noted in the project chat history.
