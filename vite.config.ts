import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  // Expose only these names to the browser. Do not use prefix "SUPABASE_"
  // or SUPABASE_DB_PASSWORD / service role would be bundled into the client.
  envPrefix: ["VITE_", "SUPABASE_URL", "SUPABASE_ANON_KEY"],
  server: {
    port: 3177,
    host: true,
  },
  preview: {
    port: 3177,
  },
});
