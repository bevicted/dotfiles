# Kobo → DRM-free epub (kobodl via Docker)

Strip DRM from ebooks bought on [kobo.com](https://www.kobo.com) using the
[`kobodl`](https://github.com/subdavis/kobo-book-downloader) Docker image, then
sideload the plain epub to the PocketBooks. No Wine, no Adobe, no Kindle.

Image: `ghcr.io/subdavis/kobodl`. Auth tokens live in `~/.config/kobodl.json`
(mounted), so they survive the container's `--rm` wipe.

## 1. Enter the image (interactive shell)

```sh
docker run --rm -it --user $(id -u):$(id -g) \
  --entrypoint sh \
  -v ${HOME}/.config:/home/config \
  -v ${HOME}/Downloads:/home/downloads \
  ghcr.io/subdavis/kobodl
```

Downloads land on the host in `~/Downloads` (that's the `-v` mount).

## 2. Inside the shell: alias away the config flag

```sh
alias k='kobodl --config /home/config/kobodl.json'
```

## 3. Link the Kobo account (one-time)

```sh
k user add        # prints an activation URL + code
```

Open the URL in a browser, sign in at kobo.com, enter the code. kobodl captures
access tokens (never your password). Confirm:

```sh
k user list
```

Re-auth only needed if tokens expire or `kobodl.json` is deleted.

## 4. Buy the book

On kobo.com, purchase the ebook (not the audiobook) on the same account.

## 5. Download DRM-free

```sh
k book list                                   # copy the RevisionId
k book get <RevisionId> --output-dir /home/downloads
```

`--output-dir` MUST be the in-container mount `/home/downloads`. A bare path like
`/home/Downloads` fails with `Errno 13` — `/home` is root-owned in the container;
only the mounted dirs are writable.

## 6. Sideload

Plug a PocketBook in via USB, copy the `.epub` from `~/Downloads` onto it.
PocketBook reads epub natively — no conversion.

---

Fallback if kobodl ever breaks: Obok plugin + Kobo Desktop under 32-bit Wine.
Plugins already at `~/dev/dedrm/DeDRM_tools_10.0.3/`.
