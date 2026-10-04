# Releasing

Versions and the changelog are cut by [release-please](https://github.com/googleapis/release-please),
configured in [release-please-config.json](../../release-please-config.json) and
[.release-please-manifest.json](../../.release-please-manifest.json).

1. Conventional-commit merges land on `main`.
2. The `release-please` workflow ([.github/workflows/release-please.yml](../../.github/workflows/release-please.yml))
   keeps a release PR open on the `release-please--branches--main--components--moodle-local-js`
   branch. It bumps `package.json`, `.release-please-manifest.json`, and `CHANGELOG.md`. Nobody
   hand-edits those versions.
3. Merging the release PR creates a GitHub release (tag without a `v` prefix).
4. The release being **published** triggers
   [github-actions-deploy-staging-cdn.yml](../../.github/workflows/github-actions-deploy-staging-cdn.yml)
   (`environment: staging`), which builds with `npm run build:staging` and syncs to
   `https://cdn.annoto.net/staging/moodle-local-js/latest/annoto.js`.
5. The release being **released** triggers
   [github-actions-deploy-cdn.yml](../../.github/workflows/github-actions-deploy-cdn.yml)
   (`environment: production`), which builds with `npm run build` and syncs to
   `https://cdn.annoto.net/moodle-local-js/<version>/annoto.js` and `.../latest/annoto.js`.
   The `production` environment needs a reviewer's approval, so the prod CDN publish waits until
   someone approves it in GitHub Actions — a merged release PR is not yet live.

Check what is actually live with `curl` against the CDN URL before reporting a version as
shipped.
