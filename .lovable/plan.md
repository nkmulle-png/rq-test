Revert the login page's desktop split back to 50/50.

In `src/routes/login.tsx`:
- Change grid from `md:grid-cols-5` back to `md:grid-cols-2`
- Remove `md:col-span-3` from the left panel
- Remove `md:col-span-2` from the right panel (keep `md:px-16`)