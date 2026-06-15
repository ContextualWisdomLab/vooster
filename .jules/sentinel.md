## 2024-06-15 - Add missing security headers and CORS
**Vulnerability:** The Fastify API server lacked essential security configurations (`helmet` for security headers and `cors` for cross-origin access control). Additionally, if CORS was to be configured, there was a risk of insecurely setting `origin: true` instead of explicitly managing trusted origins.
**Learning:** Monorepo API setups often default to open cross-origin access or missing headers if standard security plugins are not explicitly added.
**Prevention:** Always register standard security plugins (`@fastify/helmet` and `@fastify/cors`) in Fastify and enforce explicit allowlists for `origin` rather than `true`.
