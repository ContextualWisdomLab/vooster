# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into the Vooster landing page (`apps/www`). A PostHog snippet component was created and embedded in the page `<head>`, with client-side event tracking added to the three key sections of the landing page that contain user-action touchpoints. All PostHog keys are read from environment variables (`.env`).

## Files changed

| File | Change |
|------|--------|
| `src/components/posthog.astro` | Created — PostHog web snippet component using `is:inline` and `define:vars` |
| `src/pages/index.astro` | Added `<PostHog />` import and render in `<head>` |
| `src/components/sections/Hero.astro` | Added `<script is:inline>` tracking three events |
| `src/components/sections/Onboarding.astro` | Added `prompt_copied` capture inside existing copy function |
| `src/components/sections/EndCTA.astro` | Added `<script is:inline>` tracking end CTA click |
| `.env` | Created with `PUBLIC_POSTHOG_PROJECT_TOKEN` and `PUBLIC_POSTHOG_HOST` |

## Events tracked

| Event | Description | File |
|-------|-------------|------|
| `cta_clicked` | Primary CTA button click (hero nav and hero section). Includes `location` property: `hero_nav` or `hero_section` | `src/components/sections/Hero.astro` |
| `workflow_link_clicked` | Click on "워크플로우 보기" secondary CTA in the hero section | `src/components/sections/Hero.astro` |
| `github_clicked` | Click on the GitHub repo link in the navigation. Includes `location: hero_nav` | `src/components/sections/Hero.astro` |
| `prompt_copied` | User copies the onboarding prompt in the Get Started section | `src/components/sections/Onboarding.astro` |
| `end_cta_clicked` | Click on the final "지금 시작하기" CTA in the EndCTA section | `src/components/sections/EndCTA.astro` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1614728)
- [CTA Clicks Over Time](/insights/Aaoc2j7Q) — hero + end CTA clicks side by side
- [Prompt Copy Rate](/insights/5re5i3TQ) — hands-on onboarding engagement
- [GitHub Clicks](/insights/us6LegdR) — developer / open-source interest signal
- [Engagement → CTA Conversion Funnel](/insights/oN8A71PI) — workflow-link-to-CTA conversion rate
- [All Key Actions](/insights/awzOMLCf) — every tracked action in one chart

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
