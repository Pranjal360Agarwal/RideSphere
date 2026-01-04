const autocannon = require("autocannon");

const urls = ["http://localhost:3000", "http://localhost:3000/stress-test"];
const duration = 30; // in seconds

urls.forEach((url) => {
  const instance = autocannon(
    {
      url: url,
      duration: duration,
    },
    (err, result) => {
      if (err) {
        console.error(`Error during stress test for ${url}:`, err);
      } else {
        console.log(`URL: ${url}:`);
        console.log("Number of Requests:", result.requests.total);
        console.log("Duration (seconds):", result.duration);
      }
    }
  );
  autocannon.track(instance, {
    renderProgressBar: false,
    renderResultsTable: false,
  });
});
