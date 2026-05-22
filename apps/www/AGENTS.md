# AGENTS.md — apps/www

Korean landing page (`@vooster/www`, Astro 5).

## Production URL

- Canonical: **https://v2.vooster.ai**
- All SEO/OG metadata (`canonical`, `og:url`, `og:image`) must resolve under this origin.
- `site` in `astro.config.mjs` must stay in sync — Astro uses it for absolute URL emission (sitemap, RSS, etc.).
- If the domain changes, update three places together: `astro.config.mjs`, the `siteUrl` constant in `src/pages/index.astro`, and this file.

## OG / social card

- `public/og.svg` — 1200×630 social card, generated to match the dark canvas + teal accent design system.
- SVG works on previewers that fetch the resource directly (e.g. Discord, Slack). **X (Twitter) and Facebook scrapers commonly reject SVG.** If preview images are missing on those platforms, rasterize to `public/og.png` (1200×630) and swap `og:image` / `twitter:image` in `src/pages/index.astro`.

## Copy source of truth

- Hero/section copy lives in the Astro components under `src/components/sections/`. The `<title>` and `description` in `src/pages/index.astro` must stay aligned with the Hero positioning ("AI 에이전트를 위한 기획·하네스 도구").
