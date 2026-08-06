# Fix the 404 shown right after SSO sign-in

## What we know

- Sign-in happens on `rdhq-training.lovable.app`.
- The 404 is the app's own 404 page (the styled "404 / Page not found" screen in `__root.tsx`), which means the browser landed on a URL the app has no route for.
- The app currently defines only three routes: `/`, `/login`, `/manager`. There is no route to receive an OAuth return URL.
- Checked the live site: the platform-side endpoints `/~oauth/initiate` and `/~oauth/callback` both correctly redirect to Lovable's OAuth broker, so the platform half of the flow is healthy.

Sign-in passes `redirect_uri: window.location.origin`. In the normal popup flow the tokens come back through the popup, but when the browser falls back to a full-page redirect (popup blocked, in-app browser, Safari, mobile), the browser is returned to a URL that the app has no matching route for, so the router renders its 404 — even though authentication itself succeeded. This is the most likely cause but is not yet proven, so verifying it is the first step.

## Plan

1. **Confirm the landing URL.** Reproduce a sign-in and capture the exact URL in the address bar when the 404 appears (including any `?code=`/`#access_token=` parameters). This confirms which path needs a route.

2. **Add a dedicated public callback route** at `/auth/callback`:
   - Renders a lightweight "Signing you in…" screen.
   - Waits for the auth session to be established, then redirects to `/` (or `/login` with an error message if sign-in failed).
   - Public — no auth guard, so it never bounces the user mid-flow.

3. **Point sign-in at that route.** Change `redirect_uri` in the auth helper from `window.location.origin` to `${window.location.origin}/auth/callback`. The popup flow keeps working unchanged; the redirect fallback now lands on a real page.

4. **Add a safety net for auth returns.** If step 1 shows the browser landing somewhere else (e.g. `/` with OAuth params, or another path), handle that path too so no auth return can hit the 404 screen.

5. **Register the new callback URL** in the project's Google sign-in settings alongside the existing ones, so the redirect URI is accepted.

6. **Verify** end to end on the published site, plus a popup-blocked run to exercise the redirect path.

## Technical notes

- Files touched: new `src/routes/auth.callback.tsx` (route id `/auth/callback`), and `src/lib/auth.tsx` for the `redirect_uri`.
- No database or RLS changes.
- The callback page relies on the existing `onAuthStateChange` listener in `AuthProvider`; it does not call `supabase.auth.signIn*` itself.
