/**
 * The tools geenee serves for one Viewer, made from the tools its Upstream
 * lists. The names geenee serves are its own contract (ADR 0001).
 */
import type { Tool, ToolResult } from './upstream.ts'

export interface Viewer {
  /** The Viewer as geenee names it to the model. */
  name: 'igv' | 'Juicebox'
  /** Starts the name of every tool that drives this Viewer. */
  prefix: 'igv' | 'juicebox'
  /** The Upstream's own tool for opening this Viewer: its reply carries the Viewer's Join link for a Room. */
  openTool: string
  /** Upstream tools geenee does not serve: a Viewer is only ever opened inside the Workspace (ADR 0002). */
  hidden: string[]
  /**
   * How the Upstream is told which Room a call is for. The igv Upstream takes
   * it as the `room` argument. The Juicebox Upstream acts on the Room of the
   * call's MCP session, and a session it has bound to no Room has the Room
   * whose id is the session id, so geenee sends the Room id as the session.
   */
  roomGoesIn: 'argument' | 'session'
  /**
   * How geenee learns whether this Viewer is connected in a Room: an Upstream
   * tool that changes nothing in the Viewer, and what its reply says. Neither
   * Upstream has more of a contract for this than the wording of that reply.
   */
  connection: { tool: string; connected(reply: ToolResult): boolean }
}

/** geenee's own tool: it opens the Workspace, and so both Viewers. */
export const OPEN_GEENEE = 'open_geenee'

export const IGV: Viewer = {
  name: 'igv',
  prefix: 'igv',
  openTool: 'open_viewer',
  hidden: ['open_viewer'],
  roomGoesIn: 'argument',
  // The igv Upstream asks the Viewer for its summary, and answers with an error when no Viewer is in the Room.
  connection: { tool: 'read_session_summary', connected: (reply) => !reply.isError },
}
export const JUICEBOX: Viewer = {
  name: 'Juicebox',
  prefix: 'juicebox',
  openTool: 'get_juicebox_url',
  hidden: ['get_juicebox_url', 'join_room'],
  roomGoesIn: 'session',
  // The Juicebox Upstream answers from its own count of the Viewers in the Room.
  connection: {
    tool: 'get_server_status',
    connected: (reply) => reply.content.some((block) => block.text?.includes('Browser Connected: Yes')),
  },
}

/** A tool as geenee serves it, and the name its Upstream knows it by. */
export interface ServedTool {
  tool: Tool
  upstreamName: string
}

/** The name geenee serves an Upstream's tool under. A name that already says which Viewer it belongs to is left alone. */
function servedName({ prefix }: Viewer, upstreamName: string): string {
  return upstreamName.startsWith(`${prefix}_`) ? upstreamName : `${prefix}_${upstreamName}`
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Rewrites text from a Viewer's Upstream so that it names tools by the names
 * geenee serves. An Upstream's descriptions and replies name its tools by their
 * own names ("call read_session_summary first"); a hidden tool is named as
 * open_geenee, which stands in for it. A name inside a longer word, a path or a
 * link is not a tool being named, and is left alone.
 */
function renamer(viewer: Viewer, upstreamTools: Tool[]): (text: string) => string {
  const served = new Map(upstreamTools.map((tool) => [tool.name, servedName(viewer, tool.name)]))
  for (const name of viewer.hidden) served.set(name, OPEN_GEENEE)
  // Longest first, so that a name is never matched as the start of a longer one.
  const names = [...served.keys()].sort((a, b) => b.length - a.length)
  const named = new RegExp(`(?<![\\w/.=-])(${names.map(escapeRegExp).join('|')})(?![\\w/=-])`, 'g')
  return (text) => text.replace(named, (name) => served.get(name)!)
}

/** Applies `rename` to every description in a JSON Schema, however deep. */
function renameDescriptions<Node>(node: Node, rename: (text: string) => string): Node {
  if (Array.isArray(node)) return node.map((item) => renameDescriptions(item, rename)) as Node
  if (node === null || typeof node !== 'object') return node
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      key,
      key === 'description' && typeof value === 'string' ? rename(value) : renameDescriptions(value, rename),
    ]),
  ) as Node
}

/**
 * Every tool takes the Room id back from the model, and must: without it geenee
 * cannot tell an Upstream which Room a call is for. An Upstream tool that
 * already takes `room` keeps its own description of it.
 */
const ROOM_ARGUMENT = {
  type: 'string',
  description: `The Room id geenee was opened with, as given in the reply of ${OPEN_GEENEE}. Pass it on every call.`,
}

function withRoomArgument(inputSchema: Tool['inputSchema']): Tool['inputSchema'] {
  return {
    ...inputSchema,
    properties: { ...inputSchema.properties, room: inputSchema.properties?.room ?? ROOM_ARGUMENT },
    required: [...(inputSchema.required ?? []).filter((name) => name !== 'room'), 'room'],
  }
}

export interface ServedTools {
  tools: ServedTool[]
  /** A reply from the Upstream, as geenee passes it on: its text names tools by the names geenee serves. */
  reply(result: ToolResult): ToolResult
}

export function serveTools(viewer: Viewer, upstreamTools: Tool[]): ServedTools {
  const rename = renamer(viewer, upstreamTools)
  const tools = upstreamTools
    .filter((tool) => !viewer.hidden.includes(tool.name))
    .map((tool) => ({
      tool: {
        ...tool,
        name: servedName(viewer, tool.name),
        ...(tool.description === undefined ? {} : { description: rename(tool.description) }),
        inputSchema: withRoomArgument(renameDescriptions(tool.inputSchema, rename)),
      },
      upstreamName: tool.name,
    }))
  return {
    tools,
    reply: (result) => ({
      ...result,
      content: result.content.map((block) => (typeof block.text === 'string' ? { ...block, text: rename(block.text) } : block)),
    }),
  }
}
