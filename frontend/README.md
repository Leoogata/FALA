# frontend — Interfaces Web

Agrupa as telas do Ponte, divididas por função.

## Subpastas

- `campaigns/` — Interface de gestão de campanhas (US-06)
- `analytics/` — Tela de métricas por campanha (US-10)
- `dashboard/` — Mapa de regiões sensíveis (US-03-front, stretch)

## Separação por página vs. app único

As três telas podem ser um único app com três rotas, ou apps separados. Para o MVP é mais simples um único app com rotas internas (`/campanhas`, `/analytics`, `/dashboard`), reaproveitando componentes e estilos.

## Decisões técnicas em aberto

- Framework: React/Next.js? Vue? Svelte?
- Biblioteca de componentes: shadcn, Chakra, Mantine, custom?
- Estratégia de autenticação (ou ausência dela no MVP?)

Definir junto com a stack de backend para evitar surpresas.

## Design

Seguir a identidade visual definida em `design/`. Paleta sugerida vem da apresentação: navy, coral, teal, yellow.
