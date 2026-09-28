# Development Guide

## Commands

| Command | Description |
|---|---|
| `pnpm install` | Install all dependencies |
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test` | Run all tests |
| `pnpm format` | Format code with Prettier |
| `pnpm clean` | Remove all build artifacts |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:studio` | Open Prisma Studio |

## Working with Packages

All packages use workspace protocol for cross-dependencies:
```json
"@ai-mos/types": "workspace:*"
```

## Adding a New Module (Future)

1. Create `apps/backend-api/src/modules/<name>/` directory
2. Create `<name>.module.ts`, `<name>.service.ts`, `<name>.controller.ts`
3. Import the module in `app.module.ts`
4. Add shared types to `packages/types/src/`
5. Add constants to `packages/constants/src/`

## Conventional Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: fix bug
docs: update documentation
refactor: code refactoring
test: add tests
chore: maintenance tasks
```

## Code Quality

- ESLint enforces code quality rules
- Prettier ensures consistent formatting
- TypeScript strict mode is enabled
- Husky runs lint-staged on pre-commit

## Docker Services

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Stop services
docker-compose down

# Reset database
docker-compose down -v
docker-compose up -d
```
