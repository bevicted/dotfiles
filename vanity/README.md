# Go vanity import host (`go.bevicted.dev`)

Cloudflare Worker that serves `go-import` meta tags so Go modules can be
fetched as `go.bevicted.dev/<repo>` while the canonical repo lives at
`codeberg.org/bevicted/<repo>`.

## How it works

Go's toolchain hits `https://go.bevicted.dev/<repo>?go-get=1` during
`go install` / `go get`. The Worker returns HTML containing:

```html
<meta name="go-import" content="go.bevicted.dev/<repo> git https://codeberg.org/bevicted/<repo>">
```

Go parses that and clones the real repo from Codeberg. Browsers hitting the
same URL get a meta-refresh to the Codeberg page.

## Deploy

Prerequisites: Cloudflare account with `bevicted.dev` zone.

```sh
cd vanity
bun install        # installs wrangler from package.json (or: npm install)
bunx wrangler login    # one-time browser auth
bunx wrangler deploy
```

(`wrangler` is pinned in `package.json` so every deploy uses the same
version. Substitute `npx` for `bunx` if you prefer npm.)

The route in `wrangler.toml` (`go.bevicted.dev/*`) binds the Worker to the
subdomain. Make sure a DNS record exists for `go.bevicted.dev`:

- Type: `AAAA`, name: `go`, target: `100::`, proxy: **on** (orange cloud).

(Cloudflare requires *some* DNS record to attach a Worker route; the
`100::` discard prefix is the conventional placeholder when only a Worker
serves the hostname.)

## Verify

```sh
curl -s 'https://go.bevicted.dev/icb?go-get=1' | grep go-import
# <meta name="go-import" content="go.bevicted.dev/icb git https://codeberg.org/bevicted/icb">

go install go.bevicted.dev/icb@latest
```

## Adding a new module

No worker changes needed — any `go.bevicted.dev/<repo>` automatically maps
to `codeberg.org/bevicted/<repo>`. Just set the new repo's `go.mod` module
path to `go.bevicted.dev/<repo>` and push a tag.
