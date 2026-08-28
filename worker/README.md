# fanta-cron

Cloudflare Worker whose only job is to be a clock for Fanta, which stays hosted
on Vercel. Vercel's Hobby plan allows two cron jobs at daily granularity; the
hourly watch needs more than that, and this is the cheapest way to get it
without moving the app off a Node runtime that `firebase-admin` requires.

## Setup

```
cd worker
npm install
npx wrangler secret put CRON_SECRET   # same value as the Vercel env var
npx wrangler deploy
```

Set `FANTA_ORIGIN` in `wrangler.toml` to the deployed app's origin.

## Test before deploying

```
npx wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled?cron=5+*+*+*+*"
```

## Watch it in production

```
npx wrangler tail
```
