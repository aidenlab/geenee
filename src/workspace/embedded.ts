/**
 * The Workspace frames each Viewer at its Join link marked `embedded`, so that
 * a Viewer can leave out what the Workspace supplies, starting with the igv
 * Shareable URL (ADR 0002). The Viewer checks only that the parameter is
 * there. The Join links geenee keeps and hands out stay unmarked, so one given
 * out on its own still opens the full standalone Viewer.
 */
export function embedded(joinLink: string): string {
  const link = new URL(joinLink)
  link.search = link.search ? `${link.search}&embedded` : '?embedded'
  return link.href
}
