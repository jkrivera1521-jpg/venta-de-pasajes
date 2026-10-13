# Packages

Shared packages for frontend and cross-cutting clients.

## Modules

- `ui`: shared React components and design tokens.
- `auth-client`: frontend authentication helpers.
- `api-client`: generated or handwritten API clients.
- `shared-types`: shared TypeScript types generated from OpenAPI where useful.

Shared code must stay small and stable. Domain behavior belongs in services, not shared packages.
