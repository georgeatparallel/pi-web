import { lstatSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir, type ExtensionFactory } from "@earendil-works/pi-coding-agent";

function hasConfig(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

/** Supply search only to profiles that have made no MCP configuration choice. */
export function withDefaultSearchMcp(mcp: ExtensionFactory): ExtensionFactory {
  return (pi) => {
    let registered = false;
    // Register before MCP's session_start handler reads the registry. Keep the
    // same builtin identity so Pi's replacement and disable controls still apply.
    pi.on("session_start", (_event, ctx) => {
      if (registered) {
        pi.unregisterMcpServer("parallel");
        registered = false;
      }
      // Even an empty, malformed, disabled, or untrusted project configuration
      // is an explicit choice. Never use a config error as a search fallback.
      if (hasConfig(join(getAgentDir(), "mcp.json"))
        || hasConfig(join(getAgentDir(), "mcp-auth.json"))
        || hasConfig(join(ctx.cwd, CONFIG_DIR_NAME, "mcp.json"))
        || pi.getMcpServers().length > 0) return;

      pi.registerMcpServer("parallel", {
        url: "https://search.parallel.ai/mcp",
        headers: { "User-Agent": "pi-web (+https://github.com/jmfederico/pi-web)" },
        description: "Search the web and fetch pages with Parallel, without an account or API key.",
        exposure: "deferred",
        timeout: 30,
      });
      registered = true;
    });
    return mcp(pi);
  };
}
