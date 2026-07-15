# Kaklen First Tag Checklist

Usar este checklist antes de crear el primer tag pre-MVP. No crear tag si algun punto automatizado falla o si aparece un bloqueante no documentado.

- [ ] lint
- [ ] unit tests
- [ ] integration tests
- [ ] E2E
- [ ] API build
- [ ] API start
- [ ] DB migrations
- [ ] seed
- [ ] i18n es
- [ ] i18n en
- [ ] i18n pt-BR
- [ ] health
- [ ] auth
- [ ] multi-tenant
- [ ] RBAC
- [ ] clients
- [ ] catalog
- [ ] quotations
- [ ] events
- [ ] logout
- [ ] version
- [ ] cache
- [ ] Docker
- [ ] security scan
- [ ] no secrets
- [ ] docs
- [ ] AWS staging checklist

Comando automatizado principal:

```bash
pnpm release:check
```

Validacion manual minima:

```bash
pnpm --filter @kaklen/api start
curl -I http://localhost:3000/api/health
curl -I http://localhost:3000/api/health/live
curl -I http://localhost:3000/api/health/ready
curl -I http://localhost:3000/docs
pnpm dev:full:i18n
curl -I http://localhost:4200/es/login
curl -I http://localhost:4200/en/login
curl -I http://localhost:4200/pt-BR/login
```
