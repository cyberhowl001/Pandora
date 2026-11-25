// Add this to your existing vite.config.js (keep your react() and tailwind plugins).
import fs from "node:fs";
import path from "node:path";

// Stamps every build into dist/service-worker.js so the browser sees a changed file after each deploy.
function stampServiceWorker() {
  return {
    name: "stamp-service-worker",
    apply: "build",
    closeBundle() {
      const file = path.resolve("dist/service-worker.js");
      if (!fs.existsSync(file)) return;
      const id = process.env.RENDER_GIT_COMMIT || String(Date.now()); // Render sets the commit hash
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("__BUILD_ID__", id));
    },
  };
}

// plugins: [react(), tailwindcss(), stampServiceWorker()]
