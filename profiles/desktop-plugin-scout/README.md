# Desktop Plugin Scout profile

Clone Hermes Atlas, then install this local distribution:

```sh
hermes profile install ./profiles/desktop-plugin-scout --alias
```

The profile guides read-only discovery, immutable source verification, authority-surface review, deterministic catalog refresh, reviewable diffs, tests, and pull request preparation. It carries no secrets and does not execute third-party plugin content. A Hermes profile is not a security sandbox.

Because the installer records a local source, update the Atlas clone first, then update the profile:

```sh
git pull
hermes profile update desktop-plugin-scout
```

Run the profile from the Atlas clone so it can read the catalog and methodology. Validate the committed cutoff baseline offline, then compare it with current default branches without writing:

```sh
node scripts/refresh-desktop-plugins.js --validate
GITHUB_TOKEN="$(gh auth token)" node scripts/refresh-desktop-plugins.js --check
```

Git history preserves prior cutoff baselines. No unattended mutating cron is included.
