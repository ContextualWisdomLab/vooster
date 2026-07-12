# ADR-001 - Fastify Security Headers and CORS Plugins

Date: 2026-06-15
Status: ACCEPTED

## Context

The API server had no centralized HTTP security header middleware and no explicit
CORS policy. The MVP web app and API are separate deployment surfaces, so the API
needs a boring, framework-supported way to add common response hardening headers
and to avoid reflecting arbitrary browser origins.

## Decision

Add `@fastify/helmet` and `@fastify/cors` to `@vooster/api`.

Register Helmet globally with its defaults. Register CORS globally with origins
read from `VSPEC_ALLOWED_ORIGINS`, parsed as a comma-separated list. When the
environment variable is absent or empty, configure CORS with `origin: false` so
the API does not emit permissive cross-origin headers by default.

## Consequences

API responses include common security headers such as `X-Content-Type-Options`
and `X-Frame-Options`.

Browser cross-origin access must be configured explicitly for deployed frontends.
Local or production environments that need browser calls to the API must set
`VSPEC_ALLOWED_ORIGINS` to the exact allowed origins.
