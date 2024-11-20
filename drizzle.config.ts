import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

const databaseUrlRaw = process.env.DATABASE_URL;
if (!databaseUrlRaw) {
  throw new Error("DATABASE_URL is not set");
}
const databaseUrl = databaseUrlRaw;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});