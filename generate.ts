import { execSync } from "node:child_process";

const hash = "9d6332591afe1e5267a1efc02f55c0baf731f812";
const files = ["minimal", "common", "standard", "ardupilotmega"];
const baseUrl = `https://raw.githubusercontent.com/ardupilot/mavlink/${hash}/message_definitions/v1.0`;
const urls = files.map(_ => `${baseUrl}/${_}.xml`);
execSync(`npx mavlink-generate --out ./gen/schema.ts ${urls.join(" ")}`, {
  stdio: "inherit",
});
