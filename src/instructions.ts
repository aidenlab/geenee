/**
 * The server instructions: what the two Viewers are for, and how to treat a
 * request that fits both. The server cannot see the conversation, so choosing a
 * Viewer is the model's work, from tool names, descriptions and this text.
 *
 * Hosts differ in how much they read: what matters most is in the first 512
 * characters, and all of it is within 2,048.
 */
export const INSTRUCTIONS = `geenee shows two viewers together on one page beside the conversation. Call open_geenee first: one call opens both viewers and gives a Room id. Pass that Room id as room on every other geenee tool call.

Tools whose names start with igv_ drive the igv genome browser: a view along a genome, with tracks of signal and annotation such as bigWig, BED, peaks and genes. Use them for a locus or gene on a genome, for tracks, and to search ENCODE and 4DN for tracks.

Tools whose names start with juicebox_ drive the Juicebox contact map viewer: Hi-C contact maps (.hic files), which show how often two parts of a genome touch. Use them for contact maps, their normalization and color scale, panels, tracks drawn along a map, and to search for Hi-C maps.

When a request names a viewer, or something only one of them shows, use that viewer's tools. When a request fits both ("zoom in", "go to MYC", "load the CTCF track", "remove the second track", "give me a link"), use the viewer this conversation last used, and ask which one is meant only when neither has been used. Send a request to both viewers only when the user asks for both.

A tool changes its own viewer only. The page shows one viewer at a time: the one a tool was last called for, until the user picks the other with the IGV and Juicebox tabs.`
