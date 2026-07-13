import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle for Electron packaging.
  output: "standalone",
  // The Claude Agent SDK ships its own CLI assets and must not be bundled —
  // keep it external so its files are copied intact into the standalone output.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
};

export default nextConfig;
