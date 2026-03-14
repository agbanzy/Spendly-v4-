import * as esbuild from "esbuild";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

console.log("Building client...");

// Log VITE_ env vars status so build failures are diagnosable
const viteVars = Object.keys(process.env).filter(k => k.startsWith('VITE_'));
if (viteVars.length > 0) {
  console.log(`  VITE env vars available: ${viteVars.join(', ')}`);
} else {
  console.warn("  WARNING: No VITE_ environment variables found. Client auth may not work in production.");
}

execSync("npx vite build", { cwd: rootDir, stdio: "inherit", env: process.env });

console.log("Building server...");
await esbuild.build({
  entryPoints: [path.resolve(rootDir, "server/index.ts")],
  outfile: path.resolve(rootDir, "dist/index.cjs"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  packages: "external",
  alias: {
    "@shared": path.resolve(rootDir, "shared"),
  },
  plugins: [
    {
      name: "exclude-vite-dev",
      setup(build) {
        build.onResolve({ filter: /\/vite$/ }, (args) => {
          if (args.importer.includes("server")) {
            return { path: args.path, external: true };
          }
        });
        build.onResolve({ filter: /^vite$/ }, () => {
          return { path: "vite", external: true };
        });
      },
    },
  ],
});

console.log("Build complete!");
