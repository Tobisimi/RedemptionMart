import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { paymentsRouter } from "./routes/payments.js";

const app = express();

app.use(
  cors({
    origin: [env.frontendUrl, "http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  })
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/payments", paymentsRouter);

app.listen(env.port, () => {
  console.log(`RedemptionMart API listening on http://localhost:${env.port}`);
});
