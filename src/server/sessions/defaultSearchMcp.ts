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
    let considered = false;
    // Wait until startup extensions have registered their servers, including a
    // server named parallel. MCP supports registrations after session_start.
    pi.on("before_agent_start", (_event, ctx) => {
      if (considered) return;
      considered = true;
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
    pi.on("mcp_servers_change", () => {
      if (registered && pi.getMcpServers().some((server) => server.name !== "parallel")) {
        // Withdraw only our own default. An explicit server arriving later must
        // not leave an unconfigured fallback running, even if that server fails.
        registered = false;
        pi.unregisterMcpServer("parallel");
      }
    });
    // Keep the same builtin identity so Pi's replacement/disable controls apply.
    return mcp(pi);
  };
}
