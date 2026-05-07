import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pipelinePlugin from "./vite-plugin-pipeline";

export default defineConfig({
  plugins: [react(), pipelinePlugin()],
});
