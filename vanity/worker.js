// Cloudflare Worker: Go vanity import host for go.bevicted.dev.
//
// Maps go.bevicted.dev/<repo>[/<subpath>...] to the Codeberg repo at
// codeberg.org/bevicted/<repo>. Serves a `go-import` meta tag for the Go
// toolchain (?go-get=1) and meta-refreshes browsers to the Codeberg page.

const CODEBERG_USER = "bevicted";
const VANITY_HOST = "go.bevicted.dev";

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const repo = segments[0];

    if (!repo) {
      return new Response(
        `${VANITY_HOST} — Go vanity import host for codeberg.org/${CODEBERG_USER}/*\n`,
        { headers: { "content-type": "text/plain; charset=utf-8" } }
      );
    }

    const codebergRepo = `https://codeberg.org/${CODEBERG_USER}/${repo}`;
    const importPath = `${VANITY_HOST}/${repo}`;
    const subPath = segments.slice(1).join("/");
    const browserURL = subPath
      ? `${codebergRepo}/src/branch/main/${subPath}`
      : codebergRepo;

    const body = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="go-import" content="${importPath} git ${codebergRepo}">
<meta name="go-source" content="${importPath} ${codebergRepo} ${codebergRepo}/src/branch/main{/dir} ${codebergRepo}/src/branch/main{/dir}/{file}#L{line}">
<meta http-equiv="refresh" content="0; url=${browserURL}">
<title>${importPath}</title>
</head>
<body>
<p>Redirecting to <a href="${browserURL}">${browserURL}</a>...</p>
</body>
</html>
`;

    return new Response(body, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
};
