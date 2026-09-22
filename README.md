# Balloon Maths Showdown

A dependency-free, touch-first addition, subtraction and missing-number game for young learners.

## Play locally

Serve this folder with any static web server, then open `index.html` through that server. The game has no backend, account, external font, or runtime network dependency.

## Verify

Run `npm test` from this folder. Tests cover the maths generators, turn engine, scoring, timeouts, sudden death, and saved settings.

## Publish

The repository workflow at `.github/workflows/deploy-pages.yml` tests and publishes the game to GitHub Pages. In the repository settings, set Pages to use **GitHub Actions**.
