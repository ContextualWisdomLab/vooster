## 2024-06-07 - Add Security Headers

**Vulnerability:** Fastify server lacked explicit security headers (Helmet) and a defined CORS policy.
**Learning:** Security middleware (like `fastify-helmet` and `fastify-cors`) is crucial for defense-in-depth but must be version-matched to the core framework (Fastify v4 requires older plugin versions).
**Prevention:** Always verify the framework version in `package.json` before installing security plugins to ensure compatibility.
