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

## Delegated builds (headless)

When you are invoked headless as a delegated build (the goal's `.md` has a
`## Delegation` section, `owner: claude` — see `docs/claude/delegation.md`):

- You are completing **one step** of the goal, not the whole goal. The step is
  in the prompt; acceptance is the goal's gate suite.
- **Commit your step**: one commit per step, Conventional Commits format (e.g.
  `feat(www): hero copy revision`), then stop. Follow the root `/commit` skill
  for message format and the pre-commit boundary.
- **Stay inside `apps/www`.** Never edit `apps/api`, `apps/app`, `domain`,
  `scripts/`, or `goals/` — they are off-limits for this app's delegation.
- Design/copy consistency across separate invocations comes from this file
  plus the section copy; keep tone and positioning aligned with the above.
