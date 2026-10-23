# An expired Room stays expired

A Room link travels beyond the Driver: Guests scan it at conferences, email it to themselves and forward it. Each Upstream deletes a Room's saved state after a day without use, so a Room revived after that is empty, and a link that quietly reopens an empty Room looks broken rather than old. So a Room expires after a day without use and stays expired for everyone. A Guest who opens its Room link sees one page saying so, with the way to get geenee. A tool call for it tells the model the Room has expired, so the model opens geenee again and the Driver gets a new Room and a new Card.

## Considered Options

- **Anyone can revive it**, as the igv Upstream's `open_viewer` does today. Rejected: "expires after a day without use" would be untrue, and an old link would reopen a Room that is empty in igv and refused in Juicebox.
- **Only the Driver can revive it**, empty, under the same link. Rejected: it keeps old links alive with nothing in them, and Guests holding the link could not tell a revived Room from the one they were shown.

## Consequences

- geenee must know when a Room has expired, though its own record of a Room never expires; and it must not reach the igv Upstream through `open_viewer` in a way that revives an expired Room.
- The Driver loses nothing they could have kept: the content was already gone with the Upstreams' saved state.
