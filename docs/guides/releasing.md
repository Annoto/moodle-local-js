# Releasing

Versions and the changelog are cut by [release-please](https://github.com/googleapis/release-please),
configured in [release-please-config.json](../../release-please-config.json) and
[.release-please-manifest.json](../../.release-please-manifest.json). Nobody bumps a version or
creates a release by hand.

1. Conventional-commit merges land on `main`. Their types pick the bump: `feat` minor, `fix`
   patch, a `!` or a `BREAKING CHANGE:` footer major.
2. On every push to `main`, the `release-please` workflow
   ([.github/workflows/release-please.yml](../../.github/workflows/release-please.yml)) keeps a
   release PR open from the `release-please--branches--main--components--moodle-local-js` branch.
   It bumps `package.json`, `package-lock.json`, `.release-please-manifest.json` and
   `CHANGELOG.md`. Nobody commits to that branch by hand.
3. Merging the release PR makes release-please create a GitHub release, tagged with the bare
   version (no `v` prefix).
4. The release fires both deploy workflows:
    - **published** →
      [github-actions-deploy-staging-cdn.yml](../../.github/workflows/github-actions-deploy-staging-cdn.yml)
      (`environment: staging`) builds with `npm run build:staging` and syncs to
      `https://cdn.annoto.net/staging/moodle-local-js/latest/annoto.js`.
    - **released** →
      [github-actions-deploy-cdn.yml](../../.github/workflows/github-actions-deploy-cdn.yml)
      (`environment: production`) builds with `npm run build` and syncs to
      `https://cdn.annoto.net/moodle-local-js/<version>/annoto.js` and
      `https://cdn.annoto.net/moodle-local-js/latest/annoto.js`, then invalidates CloudFront.
5. The `production` environment needs a reviewer's approval, so the prod deploy waits until
   someone approves it in GitHub Actions. A merged release PR is not yet live.

Before reporting a version as shipped, fetch the CDN URL and check that it serves that version.
Every installed Moodle plugin loads the `latest` path by default, so a prod deploy reaches every
site at once.
