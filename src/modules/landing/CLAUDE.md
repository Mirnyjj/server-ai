# Landing

The landing module owns the public root page served by the Fastify application.

- Route: `GET /`
- Response: self-contained responsive HTML/CSS/SVG.
- The animated atlas is implemented without external assets.
- `/api/*`, `/mcp`, and existing application routes remain registered separately.
- Motion respects `prefers-reduced-motion: reduce`.
- HTTPS termination is handled by the external reverse proxy; the application itself listens on its configured HTTP port.
