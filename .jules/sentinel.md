## 2026-06-06 - Missing Basic Security Plugins
**Vulnerability:** The Fastify server lacked basic security protection headers (`helmet`) and explicit Cross-Origin Resource Sharing (CORS) configurations, which may leave the API susceptible to some common vulnerabilities, XSS, and Cross-Origin misconfigurations.
**Learning:** Basic security plugins are not always automatically bundled with micro-frameworks like Fastify, so they need to be manually registered during server instantiation.
**Prevention:** Always register essential security plugins like `@fastify/helmet` and `@fastify/cors` upon creating any new web or API server instances to maintain a defense-in-depth approach.
