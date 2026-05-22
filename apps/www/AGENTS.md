# AGENTS.md — apps/www

Korean landing page (`@vooster/www`, Astro 5).

## Production URL

- Canonical: **https://v2.vooster.ai**
- All SEO/OG metadata (`canonical`, `og:url`, `og:image`) must resolve under this origin.
- `site` in `astro.config.mjs` must stay in sync — Astro uses it for absolute URL emission (sitemap, RSS, etc.).
- If the domain changes, update three places together: `astro.config.mjs`, the `siteUrl` constant in `src/pages/index.astro`, and this file.

## OG / social card

- `public/og.png` — 1200×630 PNG, the canonical social card referenced by `og:image` / `twitter:image` in `src/pages/index.astro`.
- `public/og.svg` — editable design source (dark canvas + teal accent). After editing, regenerate the PNG and commit both:
  ```
  pnpm --filter @vooster/www exec npx -y sharp-cli --input public/og.svg --output public/ --format png resize 1200 630
  ```
- PNG is the only published `og:image` because X (Twitter) and Facebook scrapers reject SVG. Discord/Slack accept SVG, but PNG works everywhere.

## Copy source of truth

- Hero/section copy lives in the Astro components under `src/components/sections/`. The `<title>` and `description` in `src/pages/index.astro` must stay aligned with the Hero positioning ("AI 에이전트를 위한 기획·하네스 도구").
