# Terraform Remote State

## Required Design

Real staging operations must use an S3 backend created and governed outside this root module. The state bucket must have:

- server-side encryption;
- versioning;
- complete public access blocking;
- a bucket policy limited to the deployment role;
- access logging or CloudTrail data events according to the platform policy;
- lifecycle retention that preserves rollback history;
- native S3 lock files enabled.

The backend bucket must not be created by the same state it stores. Use a distinct key per environment and a distinct deployment role boundary.

## Configuration

`infra/environments/staging/backend.hcl.example` contains placeholders only. Copy it to an ignored `backend.hcl`, replace the bucket and region, and add this empty block to an operator-managed backend configuration file:

```hcl
terraform {
  backend "s3" {}
}
```

Initialize with:

```bash
terraform -chdir=infra/environments/staging init -reconfigure -backend-config=backend.hcl
```

Do not commit `backend.hcl`, local state, plans, lock files created by state locking, account identifiers or role session material. `.terraform.lock.hcl` is different: it pins provider checksums and is versioned.

## Sensitive State

Terraform sensitive markers protect console output, not the state payload. The foundation avoids secret versions entirely. If optional Redis authentication is introduced through `redis_auth_token`, its value enters encrypted state; require an approved remote backend, restricted state access and a documented rotation before using that input.

## Recovery

If a lock remains after a failed operation, confirm no other run is active before an authorized force-unlock. Recover state from S3 version history, verify its checksum and run a read-only plan before resuming changes. Never repair shared state by editing the JSON manually.
