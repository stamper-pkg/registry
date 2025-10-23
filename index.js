// stamper registry entry point
// written by primiti-ve on github

import express from "express";
import path from "path";
import fs from "graceful-fs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import sanitize from "sanitize-filename";
import crypto from "node:crypto";

const __dirname = path.resolve(path.dirname(""));
const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many requests. Please try again later." },
});

app.use(limiter);

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

app.post("/packages/new", async (req, res, next) => {
  try {
    const packagesFolder = path.join(__dirname, "packages");
    ensureDirSync(packagesFolder);

    // --- 1️⃣ Owner directory ---
    const ownerDir = path.join(packagesFolder, sanitize(req.query.owner));
    ensureDirSync(ownerDir);

    // --- 2️⃣ Package directory (inside owner) ---
    const packageDir = path.join(ownerDir, sanitize(req.query.name));
    ensureDirSync(packageDir);

    // --- 3️⃣ Version directory (inside package) ---
    const versionDir = path.join(packageDir, sanitize(req.query.version || "0.1.0"));
    ensureDirSync(versionDir);

    // --- 4️⃣ Init file inside version directory ---
    const initFilePath = path.join(versionDir, "init.txt");

    if (fs.existsSync(initFilePath)) {
      console.log("Version already exists, redirecting to update route...");
      req.url = "/packages/update";
      return app._router.handle(req, res, next);
    }

    const content = req.body?.content || "default package content";

    fs.writeFileSync(initFilePath, content);

    const hash = crypto.createHash("sha256").update(content).digest("hex");

    res.status(201).json({
      message: "Package version initialized successfully",
      owner: req.query.owner,
      name: req.query.name,
      version: req.query.version,
      hash,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

app.put("/packages/update", async (req, res) => {
  try {
    const packagesFolder = path.join(__dirname, "packages");
    ensureDirSync(packagesFolder);

    var initFilePath = path.join(
      packagesFolder,
      sanitize(req.query.owner),
      sanitize(req.query.name),
      sanitize(req.query.version || "0.1.0"),
      "init.txt"
    );

    if (!fs.existsSync(initFilePath)) {
      return res.status(404).json({
        error: "Package version not found",
      });
    }

    const newContent = req.body?.content;

    if (!newContent) {
      return res.status(400).json({
        error: "Missing 'content' field in request body",
      });
    }

    fs.writeFileSync(initFilePath, newContent);

    const hash = crypto.createHash("sha256").update(newContent).digest("hex");

    res.status(200).json({
      message: "Package version updated successfully",
      owner: req.query.owner,
      name: req.query.name,
      version: req.query.newVersion,
      hash,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

app.get("/packages/get", async (req, res, next) => {
  try {
    const initFilePath = path.join(
      __dirname,
      "packages",
      sanitize(req.query.owner),
      sanitize(req.query.name),
      sanitize(req.query.version || "v1"),
      "init.txt"
    );

    if (!fs.existsSync(initFilePath)) {
      return res.status(404).json({ error: "Package version not found" });
    }

    res.sendFile(initFilePath, {
      headers: {
        "x-timestamp": Date.now().toString(),
        "x-sent": true,
      },
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
});

app.use((err, _, res) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Something went wrong" });
});

app.listen(port, () => {
  console.log(`Stamper Registry API running on port ${port}`);
});
