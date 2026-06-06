import http from "node:http";

import { port } from "./src/config.mjs";
import { createRequestHandler } from "./src/local-api/request-handler.mjs";
import { initializeStorage } from "./src/storage/project-repository.mjs";

await initializeStorage();

const server = http.createServer(createRequestHandler());

server.listen(port, "127.0.0.1", () => {
  console.log(`Shoe Ad Studio V2 is running at http://127.0.0.1:${port}`);
});
