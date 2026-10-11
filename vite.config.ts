import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => {
  // Vite only exposes VITE_ variables to the browser. Copy the rest of .env into process.env
  // so server functions can read SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY during development.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    server: { port: 3000 },
    plugins: [
      tsConfigPaths(),
      tanstackStart({ server: { entry: "server" } }),
      nitro(),
      viteReact(),
      tailwindcss(),
    ],
  };
});