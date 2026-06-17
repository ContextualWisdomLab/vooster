## 2024-05-24 - [Overly Permissive CORS Default]
**Vulnerability:** Fastify API lacked any CORS configuration or security headers, meaning if deployed, it might have been open or prone to basic attacks without Helmet protection.
**Learning:** Default fastify instances do not ship with basic security protections like CORS origin validation or essential HTTP headers.
**Prevention:** Always enforce strict `allowedOrigins` via environment variables (like `VSPEC_ALLOWED_ORIGINS`) and include `@fastify/helmet` as a foundational security measure for any exposed API.
