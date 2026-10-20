/**
 * The server instructions: what the two Viewers are for, and how to treat a
 * request that fits both. The server cannot see the conversation, so choosing a
 * Viewer is the model's work, from tool names, descriptions and this text.
 *
 * Hosts differ in how much they read: what matters most is in the first 512
 * characters, and all of it is within 2,048.
 */

/**
 * The Pane rule, said the same way here, in the open_geenee description and in
 * its result: in the Pane the model opens the geenee link, and does nothing
 * else. It names the behaviour, not any Host's own tools.
 */
export const PANE_RULE = `If this app shows pages beside the conversation, open the geenee link there: that is the only thing you do in that page. Never click, type, scroll, take screenshots, read the page or pick a tab in it, by browser or screen automation or any other way; everything else goes through geenee's tools. Never open the link in the user's own web browser, and if this app shows no page beside the conversation, do not try to open it at all.`

export const INSTRUCTIONS = `geenee shows two viewers on one page beside the conversation. Call open_geenee first: it gives the geenee link and a Room id. Pass that Room id as room on every other geenee tool call. ${PANE_RULE}

Tools whose names start with igv_ drive the igv genome browser: a view along a genome, with tracks of signal and annotation such as bigWig, BED, peaks and genes. Use them for a locus or gene on a genome, for tracks, and to search ENCODE and 4DN for tracks.

Tools whose names start with juicebox_ drive the Juicebox contact map viewer: Hi-C contact maps (.hic files), which show how often two parts of a genome touch. Use them for contact maps, their normalization and color scale, panels, tracks drawn along a map, and to search for Hi-C maps.

When a request names a viewer, or something only one of them shows, use that viewer's tools. When a request fits both ("zoom in", "go to MYC", "load the CTCF track", "remove the second track", "give me a link"), use the viewer this conversation last used, and ask which one is meant only when neither has been used. Send a request to both viewers only when the user asks for both.

A tool changes its own viewer only. A tool's result is the check: it says whether its viewer did it, so never look at the page to confirm. The page shows one viewer at a time, and geenee brings forward the viewer each tool call is for, by itself. The IGV and Juicebox tabs are for the user, to show the other viewer, never for you.`
