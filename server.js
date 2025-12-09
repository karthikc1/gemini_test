import express from "express";
import morgan from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT || 3000;

// Target: Gemini
const GEMINI_TARGET = "https://gemini.google.com";

app.use(morgan("dev"));

// Simple health check
app.get("/", (req, res) => {
  res.send("Gemini proxy is running. Use /g/* to proxy requests.");
});

// Proxy all /g/* → gemini.google.com/*
app.use(
  "/g",
  createProxyMiddleware({
    target: GEMINI_TARGET,
    changeOrigin: true,
    secure: true,
    pathRewrite: {
      "^/g": "" // /g/chat → /chat
    },
    onProxyReq(proxyReq, req, res) {
      // You can tweak headers here if needed
      proxyReq.setHeader("Accept-Language", "en-US,en;q=0.9");
    },
    onProxyRes(proxyRes, req, res) {
      // Remove/adjust some security headers that might break embedding
      delete proxyRes.headers["content-security-policy"];
      delete proxyRes.headers["x-frame-options"];
    },
    logLevel: "debug"
  })
);

app.listen(PORT, () => {
  console.log(`Gemini proxy listening on port ${PORT}`);
});
