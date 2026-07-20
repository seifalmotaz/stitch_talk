import { config } from "dotenv";

config({ path: ".env.local" });
process.env.DATABASE_URL =
  "postgresql://postgres:password@localhost:5432/stitch_talk_test";
process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT;
