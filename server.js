import express from "express";
import morgan from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";
import { Buffer } from "buffer";

const app = express();
const PORT = process.env.PORT || 3000;

const GEMINI_TARGET = "https://gemini.google.com";

app.use(morgan("dev"));

// helper to get proxy base URL (https://your-service.onrender.com/g)
function getProxyBase(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}/g`;
}

app.get("/", (req, res) => {
  res.send(`
    <h1>Gemini proxy is running</h1>
    <p>Go to <a href="/g/">/g/</a> to open Gemini via the proxy.</p>
  `);
});

app.use(
  "/g",
  createProxyMiddleware({
    target: GEMINI_TARGET,
    changeOrigin: true,
    secure: true,
    selfHandleResponse: true, // we will handle the response body ourselves
    onProxyReq(proxyReq, req, res) {
      proxyReq.setHeader("Accept-Language", "en-US,en;q=0.9");
    },
    async onProxyRes(proxyRes, req, res) {
      const proxyBase = getProxyBase(req);

      // collect response body
      const chunks = [];
      proxyRes.on("data", (chunk) => chunks.push(chunk));
      proxyRes.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const headers = { ...proxyRes.headers };
        const statusCode = proxyRes.statusCode || 200;
        const contentType = headers["content-type"] || "";

        // rewrite redirect Location header if it points to gemini.google.com
        if (headers.location && headers.location.startsWith(GEMINI_TARGET)) {
          headers.location = headers.location.replace(GEMINI_TARGET, proxyBase);
        }

        // remove some strict security headers
        delete headers["content-security-policy"];
        delete headers["x-frame-options"];

        if (contentType.includes("text/html")) {
          let body = buffer.toString("utf8");

          // rewrite absolute gemini links to go through proxy
          body = body
            .split("https://gemini.google.com").join(proxyBase)
            .split("https:\\/\\/gemini.google.com").join(proxyBase.replace(/https:\/\//, "https:\\/\\/"));

          const outBuf = Buffer.from(body, "utf8");
          headers["content-length"] = Buffer.byteLength(outBuf);

          res.writeHead(statusCode, headers);
          res.end(outBuf);
        } else {
          // non-HTML: just pass through
          res.writeHead(statusCode, headers);
          res.end(buffer);
        }
      });
    },
    logLevel: "debug",
  })
);

app.listen(PORT, () => {
  console.log(`Gemini proxy listening on port ${PORT}`);
});
