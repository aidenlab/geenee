# geenee

One Connector that lets a person drive both the igv.js genome browser and the Juicebox contact-map viewer from a single Claude or ChatGPT conversation. A proof of concept that the two existing tool sets make sense behind one installation.

## Language

**Host**:
The application a person talks to the model in: Claude desktop, or ChatGPT desktop in Codex mode.
_Avoid_: MCP client, client, chat app

**Connector**:
geenee as a person adds it to a Host, once, to get both Viewers.
_Avoid_: Plugin, integration, installation

**Upstream**:
One of the two existing servers whose tools geenee offers: the igv one or the Juicebox one. Each stays a working Connector in its own right.
_Avoid_: Backend, sub-server, source

**Viewer**:
One of the two existing web pages showing a tool: the igv Viewer or the Juicebox Viewer. Each belongs to its Upstream and is shown inside the Workspace.
_Avoid_: Page, widget, app

**Workspace**:
The one geenee web page a person opens beside the conversation, holding both Viewers and showing one at a time. A person knows it simply as geenee.
_Avoid_: Viewer, shell, dashboard, page

**Room**:
What ties one conversation to its Workspace and the two Viewers inside it, identified by a single Room id that the model is given when geenee is opened and passes back on every tool call. A Room expires after a day without use, and an expired Room stays expired.
_Avoid_: Session, channel

**Room link**:
The short link that brings anyone into a Room: on a computer straight into the Workspace, on a phone to the Hand-off.
_Avoid_: URL, invite, share link

**Driver**:
The person whose conversation a Room belongs to: their model makes the tool calls. A role in one Room, not a kind of person.
_Avoid_: Presenter, owner, host, user

**Guest**:
A person who joins a Room through its Room link, with no conversation and nothing installed, as an equal of the Driver in what the Viewers show.
_Avoid_: Bystander, viewer, participant, collaborator

**Hand-off**:
The page a Room link opens on a phone, where a Guest sends the Room link on to a computer, since geenee is too small to use on a phone.
_Avoid_: Landing page, interstitial, redirect

**Get geenee**:
The page that tells a person what geenee is and how to add it as a Connector to a Host. A Guest who comes to it from a Hand-off can go back to their Room from it.
_Avoid_: Install page, signup, landing page

**Card**:
What a Host shows in the conversation when geenee is opened: a short message, an Open geenee button, the Room link, and a QR code of the Room link for Guests to scan, which Show large makes fill the Card for projecting or screen-sharing. The way into the Workspace when the model cannot open it beside the conversation itself.
_Avoid_: Screen, view, widget
