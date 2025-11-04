import { defineConfig } from "sst/config";
import type { App } from "sst/constructs";


export default defineConfig({
  stacks: (app: App) => {
    app.stack("AppStack");
  },
});