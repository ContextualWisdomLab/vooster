## 2024-06-11 - [Added Fastify Helmet and secure CORS configuration]
**Vulnerability:** Fastify server was missing basic security headers (helmet) and restricted CORS origins (preventing cross-origin attacks).
**Learning:** Security plugins like `@fastify/helmet` and `@fastify/cors` must be explicitly configured in Fastify, and it's essential to match the plugin version with the Fastify version (e.g. `fastify@4` requires `@fastify/helmet@11` and `@fastify/cors@8`). Also, `origin: true` must be strictly avoided.
**Prevention:** Always install and register `fastify-helmet` and properly configured `fastify-cors` when initializing a Fastify server. Ensure dependency versions match the target Fastify runtime.
