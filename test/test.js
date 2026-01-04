const autocannon = require("autocannon");

const url = "http://localhost:3000";
const duration = 30; // in seconds

const instance = autocannon(
  {
    url,
    duration,
  },
  (err, result) => {
    if (err) {
      console.error("Error during load test:", err);
    } else {
      console.log("Load test completed. Results:", result);
    }
  }
);

autocannon.track(instance);
