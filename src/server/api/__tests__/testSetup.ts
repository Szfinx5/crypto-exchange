import dotenv from "dotenv";
import { beforeAll } from "vitest";

beforeAll(() => {
	dotenv.config({ path: ".env.test" });
});
