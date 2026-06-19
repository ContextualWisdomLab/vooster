## 2024-06-19 - [Missing Security Headers & Strict CORS]
**Vulnerability:** Fastify API server lacked security headers (Helmet) and a strict CORS policy, leaving it vulnerable to XSS, Clickjacking, and cross-origin attacks.
**Learning:** Default Fastify setups are un-opinionated about security headers. `cors` must not be set to `origin: true`.
**Prevention:** Always ensure new or existing Fastify applications explicitly configure `@fastify/helmet` globally and strictly define `@fastify/cors` using allowed origins from environment variables.
