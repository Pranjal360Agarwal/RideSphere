const http = require("http");
const app = require("./app"); // Assuming app.js exports your Express app

const server = http.createServer(app);

server.listen(3001, () => {
  console.log("Server is running on http://localhost:3001");
});
