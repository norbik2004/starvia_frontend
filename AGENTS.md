# Postly Frontend

Angular 21 single-page app (`postly-frontend`). Standard commands live in `README.md` and `package.json` scripts.

## Cursor Cloud specific instructions

- This repository is **frontend only**. It expects a separate backend (ASP.NET-style endpoints such as `Login/login`, `Account/register`, `Account/me`) at `http://localhost:5000/api/` (see `src/environments/environment.development.ts`). That backend is **not** in this repo.
- Because the backend is absent, the session guard (`src/app/guards/session.guard.ts`) catches the failing `/me` call and treats the user as logged out. Practical effect: `/` (home), `/login`, and `/register` render fine, but submitting login/register and reaching `/dashboard` cannot fully complete without a running backend. Client-side form validation works without the backend.
- Run the dev server with `npm start` (alias for `ng serve`, default port 4200, serves with the `development` configuration). Use `npm run build:dev` for a development build; the default `npm run build` is a production build.
- **No unit tests are configured.** There are no `*.spec.ts` files and `angular.json` has no `test` architect target, so `ng test` fails with "Cannot determine project or target for command." This is expected, not an environment break.
- **No ESLint** is configured. The only style tooling is Prettier (`npx prettier --check "src/**/*.{ts,html,scss}"`); note the existing source is not fully Prettier-clean, so the check currently reports warnings.
