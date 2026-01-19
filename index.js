import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import multer from "multer";
import { createRequire } from "module";

/* --------------------
   App setup
-------------------- */
const app = express();
const PORT = 3001;

/* --------------------
   pdf-parse (ESM safe)
-------------------- */
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

/* --------------------
   Middleware
-------------------- */
app.use(cors());
app.use(express.json());

// 🔒 Secure app middleware (CORS-safe)
app.use((req, res, next) => {
  if (req.method === "OPTIONS") return next();

  const key = req.headers["x-app-key"];
  if (key !== process.env.APP_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

/* --------------------
   OpenAI
-------------------- */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* --------------------
   Uploads setup
-------------------- */
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: uploadDir });

/* --------------------
   Health check
-------------------- */
app.get("/", (req, res) => {
  res.send("SERVER IS ALIVE");
});

/* --------------------
   Upload resume
-------------------- */
app.post("/api/upload", upload.single("file"), (req, res) => {
  res.json({ filename: req.file.filename });
});

/* --------------------
   Scan resume
-------------------- */
app.post("/api/scan-resume", async (req, res) => {
  try {
    const filePath = path.join(uploadDir, req.body.filename);
    const buffer = fs.readFileSync(filePath);
    const text = (await pdfParse(buffer)).text;

    const result = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `Analyze this resume and give professional feedback:\n${text}`,
    });

    res.json({ analysis: result.output_text });
  } catch (err) {
    res.status(500).json({ error: "Scan failed" });
  }
});

/* --------------------
   Rewrite resume
-------------------- */
app.post("/api/rewrite-resume", async (req, res) => {
  try {
    const filePath = path.join(uploadDir, req.body.filename);
    const buffer = fs.readFileSync(filePath);
    const text = (await pdfParse(buffer)).text;

    const result = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `Rewrite this resume professionally and ATS-friendly:\n${text}`,
    });

    res.json({ rewritten: result.output_text });
  } catch (err) {
    res.status(500).json({ error: "Rewrite failed" });
  }
});

/* --------------------
   Job match
-------------------- */
app.post("/api/job-match", async (req, res) => {
  try {
    const { filename, targetRole } = req.body;

    const filePath = path.join(uploadDir, filename);
    const buffer = fs.readFileSync(filePath);
    const text = (await pdfParse(buffer)).text;

    const result = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `
Compare this resume to the target role.

Return:
- Match percentage
- Strengths
- Skill gaps
- Improvement advice

Resume:
${text}

Target Role:
${targetRole || "General professional roles"}
`,
    });

    res.json({ matches: result.output_text });
  } catch (err) {
    res.status(500).json({ error: "Job match failed" });
  }
});

/* --------------------
   Start server
-------------------- */
app.listen(PORT, () => {
  console.log(`Server listening on http://127.0.0.1:${PORT}`);
});
