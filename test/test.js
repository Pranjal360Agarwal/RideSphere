const autocannon = require("autocannon");

async function runLoadTest() {
  try {
    const result = await autocannon({
      url: "http://localhost:3000",
      duration: 30, // 30 seconds
      connections: 10, // number of parallel connections
      pipelining: 1, // number of pipelined requests
      requests: [
        {
          path: "/",
          method: "GET",
        },
      ],
    });

    console.log("\n=== Load Test Results ===");
    console.log(`Total Requests: ${result.requests.total}`);
    console.log(`Requests/sec: ${result.requests.average}`);
    console.log(`Latency (ms): ${result.latency.mean}`);
    console.log(`Throughput (bytes/sec): ${result.throughput.average}`);
    console.log(`Errors: ${result.errors}`);
    console.log(`Timeouts: ${result.timeouts}`);
  } catch (error) {
    console.error("Load test failed:", error);
    process.exit(1);
  }
}

runLoadTest();
