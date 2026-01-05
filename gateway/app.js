const express = require("express");
const expressProxy = require("express-http-proxy");
const app = express();

// Parse incoming JSON and urlencoded bodies so the proxy can forward them
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple logger to inspect incoming requests at the gateway
app.use((req, res, next) => {
  console.log("Gateway incoming:", req.method, req.originalUrl, "body:", req.body);
  next();
});

// Helper function to create proxy options
const createProxyOptions = () => ({
  proxyReqPathResolver: function (req) {
    // express-http-proxy already strips the mount path, so req.url is the clean path
    // Just return it as-is or with a leading slash if needed
    return req.url || "/";
  },
  proxyReqBodyDecorator: function (bodyContent, srcReq) {
    // If bodyContent is a Buffer (or looks like one), convert to string
    let bodyString;
    if (bodyContent && Buffer.isBuffer(bodyContent)) {
      bodyString = bodyContent.toString();
    } else if (bodyContent && bodyContent.type === "Buffer" && Array.isArray(bodyContent.data)) {
      // express-http-proxy may present a Buffer as { type: 'Buffer', data: [...] }
      bodyString = Buffer.from(bodyContent.data).toString();
    } else {
      bodyString = JSON.stringify(bodyContent || srcReq.body || {});
    }

    console.log("Gateway proxying body:", bodyString);
    return bodyString;
  },
  proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
    // Determine the string body (handle Buffer cases)
    let bodyString;
    try {
      if (srcReq.body && Buffer.isBuffer(srcReq.body)) {
        bodyString = srcReq.body.toString();
      } else {
        bodyString = JSON.stringify(srcReq.body || {});
      }
    } catch (e) {
      bodyString = "";
    }

    proxyReqOpts.headers["Content-Type"] = "application/json";
    proxyReqOpts.headers["Content-Length"] = Buffer.byteLength(bodyString);
    return proxyReqOpts;
  },
});

app.use("/user", expressProxy("http://localhost:3001", createProxyOptions()));
app.use("/captain", expressProxy("http://localhost:3002", createProxyOptions()));

app.listen(3000, () => {
  console.log("API Gateway is running on http://localhost:3000");
});
