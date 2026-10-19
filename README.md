# RareHandle — Username Hunter

A small hosted web app for generating 10 short (3–5 character) username ideas and checking public Instagram profile hints.

## Files

- `index.html` — page structure
- `styles.css` — responsive styling
- `app.js` — username generator and frontend behavior
- `worker.js` — low-volume Cloudflare Worker endpoint for best-effort public profile checks

## Important limitation

The checker is **not** an official Instagram availability API. A profile not being found does not prove that Instagram will allow you to register that name. Instagram can reserve handles, limit public page access, or return login/challenge pages. The interface deliberately labels results as `POSSIBLE LEAD` or `UNCONFIRMED`, not guaranteed available.

No Instagram password or cookie is used. Do not add code to bypass CAPTCHA/challenges, rotate IP addresses, or evade rate limits.

## Publish frontend with GitHub Pages

1. Create a public repository named `rare-username-hunter`.
2. Add `index.html`, `styles.css`, and `app.js` at the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, then choose branch `main` and folder `/ (root)`, and save.
5. Wait for deployment. The site URL appears on the Pages settings screen.

## Deploy backend with Cloudflare Workers

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Select **Create application → Create Worker** (wording may vary), name it `rarehandle-checker`, then deploy the starter Worker.
3. Open the new Worker and choose **Edit code**.
4. Replace the starter code with the complete contents of `worker.js` in this repository, then save/deploy.
5. Copy the Worker URL, typically ending in `.workers.dev`.
6. In GitHub, edit `app.js`, replace `PASTE_CLOUDFLARE_WORKER_URL_HERE` with the complete Worker URL, then commit the change.
7. Reload the GitHub Pages site and test the checker.

## If the checker returns `UNCONFIRMED`

That is an expected outcome if Instagram blocks or limits public-page access. Open the profile link manually, and use Instagram's own username field to confirm before trying to claim the handle.
