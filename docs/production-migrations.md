# Production Prisma migrations

Production database migrations use `DIRECT_URL` from `prisma.config.ts`. `DATABASE_URL` is the transaction-mode pooler and is not the migration target.

## Check

```bash
npx prisma migrate status
```

The command must be run with the production `DIRECT_URL` available in the environment.

## Existing database with the baseline schema

This repository's first migration is:

```
20260924062747_add_instagram_media_id_to_media_asset
```

It currently contains the complete baseline schema, despite the historical migration name. If the production database already contains this schema because it was created with `prisma db push`, do not run `migrate deploy` immediately: Prisma will try to execute the baseline CREATE statements.

After a backup, compare the live database with `prisma/schema.prisma`. If the live schema is confirmed to represent the baseline migration, mark that exact migration as applied:

```bash
npx prisma migrate resolve --applied 20260924062747_add_instagram_media_id_to_media_asset
```

Then inspect and apply the subsequent migrations:

```bash
npx prisma migrate status
npx prisma migrate deploy
```

Do not use `prisma db push` for production schema changes.

## If the baseline does not match

Do not mark the migration as applied blindly. First create a backup and generate/inspect a schema diff against the actual production database. Resolve differences explicitly, then continue with migration history.

## Deployment order

```bash
git pull origin fix/instagram-api-db-sync
npm ci
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
npm run build
docker compose build
docker compose up -d
docker compose ps
```

The application must not be switched to the new image until the migration result is known.

## Rules

- `DIRECT_URL` is the migration connection.
- `DATABASE_URL` is the runtime application connection.
- Never delete or edit an already-applied migration to make it fit the live database.
- Never use `migrate resolve --applied` without first verifying the live schema matches that migration.
- Never use `db push` as the production deployment mechanism.
