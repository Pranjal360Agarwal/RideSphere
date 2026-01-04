const express = require("express");
const morgan = require("morgan");
const os = require("os");
const cluster = require("cluster");

const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  console.log(`Master process ${process.pid} is running`);
  console.log(`Starting ${numCPUs} worker processes...`);

  // Fork workers for each CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Handle worker exit
  cluster.on("exit", (worker, code, signal) => {
    console.log(
      `Worker ${worker.process.pid} died (${signal || code}). Restarting...`
    );
    cluster.fork();
  });
} else {
  // Worker processes
  const app = express();
  app.use(morgan("dev"));

  app.get("/", (req, res) => {
    for (let i = 0; i < 10000000000; i++); // Simulate heavy work
    res.send("This was fast!");
  });

  app.listen(3002, () => {
    console.log(
      `Worker process ${process.pid} is running on http://localhost:3002`
    );
  });
}
