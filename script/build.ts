import * as esbuild from "esbuild";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

console.log("Building client...");
execSync("npx vite build", { cwd: rootDir, stdio: "inherit" });

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
