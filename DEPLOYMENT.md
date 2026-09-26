# Put Accounting Mastery Hub online — easiest method

You do **not** need to know coding, GitHub, a terminal, React, or hosting.

## Easiest: Vercel Drop

1. Download `Accounting-Mastery-Hub-Deploy.zip` from ChatGPT.
2. In your web browser, go to: https://vercel.com/drop
3. Drag the **ZIP file itself** onto the Vercel Drop page.
4. Choose/name the project and click **Deploy**.
5. Vercel will give you a public link ending in `.vercel.app`. Bookmark it.

That link is your everyday website. You do not need to use the ZIP again unless you want to update the site.

## Alternative: Netlify Drop

1. Unzip `Accounting-Mastery-Hub-Deploy.zip` so you have a folder containing `index.html`, `app.js`, `styles.css`, etc.
2. Go to: https://app.netlify.com/drop
3. Drag that unzipped folder into the deploy area.
4. Netlify will give you a link ending in `.netlify.app`.

## Important about saved progress

Version 1 stores your study progress in the browser using `localStorage`.

- Your progress remains after normal refreshes and revisits on the same browser/device.
- If you clear site/browser data, the saved progress can be removed.
- Use **Settings → Export backup** regularly.
- If you move to another browser/device, use **Settings → Import backup** there.

A future cloud-sync version can add accounts/database so phone and laptop share the same progress automatically.

## AI Tutor

The site includes the AI Tutor UI and provider architecture but no real API key. This is deliberate: secret API keys must not be placed in public frontend code. A future version can connect Claude/OpenAI through a secure server-side endpoint.
