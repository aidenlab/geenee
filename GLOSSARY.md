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
What ties one conversation to its Workspace and the two Viewers inside it, identified by a single Room id that the model is given when geenee is opened and passes back on every tool call.
_Avoid_: Session, channel

**Card**:
What a Host shows in the conversation when geenee is opened: a short message, an Open geenee button, the link, and a QR code of the link. The way into the Workspace when the model cannot open it beside the conversation itself.
_Avoid_: Screen, view, widget
