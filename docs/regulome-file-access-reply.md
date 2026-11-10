**Subject:** Geenee × Regulome: two file-access issues

Hi [name],

Thanks for the note about Regulome. We've started on the integration. Your MCP server at `https://regulome.org/mcp/http` works well: we can search samples and get full metadata and file paths with no setup. We hit two issues when loading the files into IGV and Juicebox, and both need a change on your side.

**1. File URLs from the MCP return 403**

`get_file_paths` and `get_sample` return URLs on `regulome.org`, for example:

```
https://regulome.org/data/per_sample/AG10028/AG10028.normalized_density.bw
```

Every request we made to these URLs returned `403`. The same path on `regulome.altius.org` works and supports range requests (`206`):

```
https://regulome.altius.org/data/per_sample/AG10028/AG10028.normalized_density.bw
```

We only tested from a command-line client, not a browser, so this may be bot filtering rather than a broken path. Either way, MCP clients fetch these URLs directly, so right now they can't use the paths the server returns. Could the MCP return `regulome.altius.org` URLs, or could `regulome.org/data/` serve the files to non-browser clients?

**2. No CORS headers on the file server**

IGV and Juicebox run in the browser and load tracks by fetching byte ranges from your server. `regulome.altius.org/data/` sends no `Access-Control-Allow-Origin` header, including on the preflight request for a `Range` header. Browsers will therefore block every Regulome track. Since the data is public, a wildcard origin is fine. On nginx it's roughly:

```nginx
location /data/ {
    add_header Access-Control-Allow-Origin  "*" always;
    add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Range" always;
    add_header Access-Control-Expose-Headers "Content-Length, Content-Range, Accept-Ranges" always;
    if ($request_method = OPTIONS) { return 204; }
}
```

This also lets igv.org, the UCSC browser and other web tools load your files.

**A small optional request:** the per-sample directories contain bigBed (`.bb`) and tabix-indexed (`.tbi`) versions of the peaks and hotspots, but the MCP returns only the `.bed.gz` paths. Genome browsers load bigBed and indexed files much better, so returning those paths too would help.

Once these are fixed, we'll make sure Regulome files load cleanly in Geenee and show where each result came from, with its Regulome metadata.

Best,
[signature]
