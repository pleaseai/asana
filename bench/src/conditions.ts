import type { Condition } from './types'
import { join } from 'node:path'

const CONDITIONS_DIR = join(import.meta.dir, '..', 'conditions')

/**
 * Every condition runs the same prompts with the same model; only the tool
 * surface differs. The system-prompt hint is one symmetric sentence per
 * condition — enough to know the interface exists, nothing about how to use it.
 */
export const CONDITIONS: Condition[] = [
  {
    name: 'cli',
    description: 'pleaseai/asana CLI via Bash (AXI-style output, TOON default)',
    mcpConfigPath: join(CONDITIONS_DIR, 'cli.json'),
    allowedTools: ['Bash(asana:*)'],
    disallowedTools: ['WebFetch', 'WebSearch', 'Task'],
    env: {},
    systemPromptAppend: 'The `asana` CLI is installed and already authenticated. Discover commands with `asana --help`.',
  },
  {
    name: 'mcp',
    description: 'Official Asana MCP (mcp.asana.com) with tool search (deferred schemas)',
    mcpConfigPath: join(CONDITIONS_DIR, 'mcp.json'),
    allowedTools: ['mcp__asana'],
    disallowedTools: ['Bash', 'WebFetch', 'WebSearch', 'Task'],
    env: { ENABLE_TOOL_SEARCH: 'auto' },
    systemPromptAppend: 'Asana MCP tools are connected and already authenticated.',
  },
  {
    name: 'mcp-eager',
    description: 'Official Asana MCP with all tool schemas loaded upfront (tool search off)',
    mcpConfigPath: join(CONDITIONS_DIR, 'mcp.json'),
    allowedTools: ['mcp__asana'],
    disallowedTools: ['Bash', 'WebFetch', 'WebSearch', 'Task'],
    env: { ENABLE_TOOL_SEARCH: 'false' },
    systemPromptAppend: 'Asana MCP tools are connected and already authenticated.',
  },
  {
    name: 'executor',
    description: 'executor.sh hosted MCP proxy (code-mode) via https://executor.sh/<org>/mcp',
    mcpConfigPath: join(CONDITIONS_DIR, 'executor.json'),
    allowedTools: ['mcp__executor'],
    disallowedTools: ['Bash', 'WebFetch', 'WebSearch', 'Task'],
    env: {},
    systemPromptAppend: 'The Executor MCP proxy is connected; it exposes Asana and is already authenticated.',
  },
  {
    name: 'executor-cli',
    description: 'executor.sh local proxy driven through its CLI (`executor tools search` / `executor call`) via Bash',
    mcpConfigPath: join(CONDITIONS_DIR, 'cli.json'),
    allowedTools: ['Bash(executor:*)'],
    disallowedTools: ['WebFetch', 'WebSearch', 'Task'],
    env: {},
    systemPromptAppend: 'The `executor` CLI is installed and its local service is running with Asana connected. Discover tools with `executor tools search <query>` and invoke them with `executor call <server> <tool> <json-args>`.',
  },
]

export function resolveConditions(names?: string[]): Condition[] {
  if (!names || names.length === 0) {
    return CONDITIONS.filter(c => !['mcp-eager', 'executor-cli'].includes(c.name))
  }
  return names.map((name) => {
    const condition = CONDITIONS.find(c => c.name === name)
    if (!condition) {
      throw new Error(`Unknown condition "${name}". Available: ${CONDITIONS.map(c => c.name).join(', ')}`)
    }
    return condition
  })
}
