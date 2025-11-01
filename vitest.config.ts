import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

dotenv.config({ path: ".env.test" });

export default defineConfig({
	test: {
		environment: "node",
		setupFiles: ["./src/server/api/__tests__/testSetup.ts"],
	},
	resolve: {
		alias: {
			"~": path.resolve(__dirname, "./src"),
			"@server": path.resolve(__dirname, "./src/server"),
			"@client": path.resolve(__dirname, "./src/app"),
		},
	},
});
