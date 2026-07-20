# @kokecore/config Alpha artifact

- Package: `@kokecore/config`
- Version: `0.2.0`
- KOKE CORE source commit: `cf1acdb6f6bfc3487a5af3b0d1b6f5b1da044c34`
- SHA-256: `bc7d748217b7f9de70cb32280e7fa39e82a9e7a3a8040cb3280c2af9cb854f99`
- Distribution: internal, proprietary, and not published to a public registry

The tarball is versioned because Kaklen requires an immutable, machine-independent
Alpha dependency while no private package registry has been approved. It is the
dependency artifact itself, not generated test evidence. Build logs and temporary
integration copies remain outside the repository.

Regenerate only from the recorded KOKE CORE commit:

```bash
pnpm config:artifact -- --output /path/to/controlled-output
shasum -a 256 /path/to/controlled-output/kokecore-config-0.2.0.tgz
```

The checksum must match this file before changing the dependency lockfile.
