**Subject:** Loading Regulome tracks in IGV

Hi [name],

We use your MCP server to find Regulome samples and their file URLs, then load the files into IGV running in the browser. The tracks don't load. These URLs failed:

```
https://regulome.altius.org/data/per_sample/AG11020/AG11020.normalized_density.bw
https://regulome.altius.org/data/per_sample/AG11020/peaks/fdr0.05/AG11020.peaks.fdr0.05.bb
https://regulome.org/data/per_sample/AG11020/AG11020.normalized_density.bw
```

Two changes on your side would fix this.

## 1. Add CORS headers to `regulome.altius.org/data/`

**The problem:** the files download fine from the command line, but your server doesn't send CORS headers. Without them, the browser won't let a web page such as IGV read the files.

**The change:** your server reports nginx 1.20.1. Add this to the `server` block for `regulome.altius.org`, then reload nginx (`nginx -t && nginx -s reload`). If `/data/` already has a `location` block, put these lines in it instead of adding a second one.

```nginx
location /data/ {
    add_header Access-Control-Allow-Origin   "*" always;
    add_header Access-Control-Allow-Methods  "GET, HEAD, OPTIONS" always;
    add_header Access-Control-Allow-Headers  "Range" always;
    add_header Access-Control-Expose-Headers "Content-Length, Content-Range, Accept-Ranges" always;

    if ($request_method = OPTIONS) {
        return 204;
    }
}
```

What each line is for:

- **`Allow-Origin "*"`** lets any web page read the files. The data is public, so `*` is safe.
- **`Allow-Headers "Range"`** is needed because IGV reads only part of each file, using `Range` requests. Your server already supports those.
- **`Expose-Headers`** lets IGV see the file size and which byte range it got back.
- **The `OPTIONS` block** answers the check the browser sends before each `Range` request.

**To check it worked:**

```sh
curl -s -D - -o /dev/null -r 0-99 -H "Origin: https://example.org" \
  https://regulome.altius.org/data/per_sample/AG11020/AG11020.normalized_density.bw
```

The reply should include `HTTP/2 206` and `access-control-allow-origin: *`.

## 2. Make the URLs your MCP returns reachable

**The problem:** your MCP returns URLs on `regulome.org`, such as the third URL above, and those answer `403 Forbidden`. The same paths on `regulome.altius.org` work.

**The change:** either of these fixes it:

- **(a)** Have the MCP return `https://regulome.altius.org/data/...` URLs instead of `https://regulome.org/data/...`. Or:
- **(b)** Make `regulome.org/data/` serve the files. Find the rule that refuses them, for example a bot filter or a `deny`. Then add the same CORS headers as in step 1.

**To check it worked:** take a URL your MCP returns and run the `curl` command from step 1 on it. It should return `206` with the CORS header.

Once both checks pass, Regulome tracks should load directly in IGV and in other browser-based viewers such as igv.org and the UCSC Genome Browser.

Thanks,
[signature]
