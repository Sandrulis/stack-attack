import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    port: 3177,
    host: true,
  },
  preview: {
    port: 3177,
  },
});
