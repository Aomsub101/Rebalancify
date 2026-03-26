# STORY-004 — Vercel Deployment & CI Pipeline

**Epic:** EPIC-01 — Foundation
**Phase:** 0
**Estimate:** XS (< 1 day)
**Status:** 🔲 Not started
**Depends on:** STORY-002
**Blocks:** Nothing (but should be done early to establish the deployment pipeline)

---

## User Story

As a developer, every push to the `main` branch automatically deploys to Vercel production and every pull request creates a preview deployment, giving me confidence that the build is always in a deployable state.

---

## Acceptance Criteria

1. GitHub repo is connected to Vercel project.
2. `pnpm build` passes with zero errors locally.
3. Push to `main` triggers a Vercel production deployment that succeeds.
4. Pull request to `main` creates a Vercel preview deployment with a unique URL.
5. All environment variables from `docs/development/01-dev-environment.md` are set in Vercel project settings (production environment).
6. `ENCRYPTION_KEY` in Vercel is set to a cryptographically random 32-byte hex value different from `.env.local`.
7. Production deployment: signup flow works end-to-end (creates Supabase Auth user + user_profiles row).

---

## Tasks

- [ ] Connect GitHub repo to Vercel
- [ ] Add all environment variables to Vercel production settings
- [ ] Generate production `ENCRYPTION_KEY` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- [ ] Push to main → confirm build succeeds
- [ ] Open a test PR → confirm preview URL is generated
- [ ] Verify signup works on production URL

---

## Definition of Done

- [ ] All 7 acceptance criteria verified
- [ ] Production URL shared with team
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-004 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
