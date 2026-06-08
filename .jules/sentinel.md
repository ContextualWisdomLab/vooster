## 2025-06-08 - Added Security Headers and CORS to Fastify
**Vulnerability:** Fastify server lacked security headers (like Content-Security-Policy, Strict-Transport-Security) and CORS protection, exposing it to common web vulnerabilities and unauthorized cross-origin requests.
**Learning:** Basic security middleware is not included by default in Fastify. It needs to be explicitly added via plugins.
**Prevention:** Always ensure standard security plugins like `@fastify/helmet` and `@fastify/cors` are configured at the application initialization layer.
