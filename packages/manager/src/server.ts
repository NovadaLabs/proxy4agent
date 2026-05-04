#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { handleApiRequest } from "./api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardHtml = readFileSync(join(__dirname, "ui", "index.html"), "utf8");
const port = Number(process.env.NOVADA_MANAGER_PORT || 22999);

const server = createServer(async (req, res) => {
  if (await handleApiRequest(req, res)) return;

  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(dashboardHtml);
});

server.listen(port, () => {
  console.log(`Novada Proxy Manager listening at http://localhost:${port}`);
});
