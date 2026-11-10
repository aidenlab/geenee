# geenee

One Connector that lets a person drive the igv.js genome browser, the Juicebox contact-map viewer and the Spacewalk 3D viewer from a single Claude or ChatGPT conversation. A proof of concept that the existing tool sets make sense behind one installation.

## Language

**Host**:
The application a person talks to the model in: Claude desktop, or ChatGPT desktop in Codex mode.
_Avoid_: MCP client, client, chat app

**Marketplace**:
The `aidenlab/plugins` GitHub repository, added to a Host once by name, that lists the Aiden Lab's Plugins and carries their updates.
_Avoid_: Catalog, store, repo (when talking to people)

**Plugin**:
An installable package from the Marketplace that bundles a Connector and a skill. geenee is one.
_Avoid_: App, extension, integration

**Connector**:
A Host's saved connection to geenee, which supplies the tools for all the Viewers. The Plugin carries it.
_Avoid_: MCP server (when talking to people), integration, installation

**Upstream**:
One of the existing servers whose tools geenee offers: the igv one, the Juicebox one or the Spacewalk one. Each stays a working Connector in its own right.
_Avoid_: Backend, sub-server, source

**Deployment**:
One of the two long-lived copies of geenee or of an Upstream, prod or dev, each at an address that never changes. prod changes only when someone deliberately releases to it; dev is a single slot for trying a change. geenee prod forwards to the prod Upstreams, geenee dev to the dev ones.
_Avoid_: Channel, stage, environment, version

**Viewer**:
One of the existing web pages showing a tool: the igv Viewer, the Juicebox Viewer or the Spacewalk Viewer. Each belongs to its Upstream and is shown inside the Workspace.
_Avoid_: Page, widget, app

**Workspace**:
The one geenee web page a person opens beside the conversation, holding all the Viewers and showing one at a time. A person knows it simply as geenee.
_Avoid_: Viewer, shell, dashboard, page

**Room**:
What ties one conversation to its Workspace and the Viewers inside it, identified by a single Room id that the model is given when geenee is opened and passes back on every tool call. A Room expires after a day without use, and an expired Room stays expired.
_Avoid_: Session, channel

**Room link**:
The short link that brings anyone into a Room: on a computer straight into the Workspace, on a phone to the Hand-off.
_Avoid_: URL, invite, share link

**Join link**:
The address of one Viewer in a Room, which the Workspace frames. A person is given the Room link instead.
_Avoid_: Room link

**Participant**:
Anyone with a Room open, the Organizer included. No Participant controls the Room: anyone's change counts the same.
_Avoid_: Driver, user, collaborator

**Organizer**:
The Participant whose conversation a Room belongs to: their model makes the tool calls and hears what changed. It is the only role in a Room and cannot be handed over; in what the Viewers show, the Organizer is one Participant among equals. A role in one Room, not a kind of person.
_Avoid_: Driver, host (the app), presenter, owner

**Guest**:
A Participant other than the Organizer, who joins through the Room link with no conversation and nothing installed.
_Avoid_: Bystander, viewer

**Hand-off**:
The page a Room link opens on a phone, where a Guest sends the Room link on to a computer, since geenee is too small to use on a phone.
_Avoid_: Landing page, interstitial, redirect

**Get geenee**:
A Marketplace install: add the Marketplace to a Host, then install the geenee Plugin from it. Every "Get geenee" link points at `/install`, geenee's stable install address, which redirects to the install page in the Marketplace's repository. geenee shows no install steps of its own.
_Avoid_: Custom connector, signup, landing page

**Card**:
What a Host shows in the conversation when geenee is opened: a short message led by geenee's icon, an Open geenee button, the Room link, and a QR code of the Room link for Guests to scan, which Show large makes fill the Card under geenee's icon and name, for projecting or screen-sharing. The way into the Workspace when the model cannot open it beside the conversation itself.
_Avoid_: Screen, view, widget
