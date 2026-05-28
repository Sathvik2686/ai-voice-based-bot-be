import axios from "axios";
import Translation from "../models/Translation.js";
import History from "../models/History.js";

/* ================= CACHE ================= */
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 5; // 5 min
const MAX_CACHE_SIZE = 100;

/* ================= USER LIMIT ================= */
const userUsage = new Map();
const DAILY_LIMIT = 20;

const checkUsage = (userId) => {
  const today = new Date().toDateString();

  const userData = userUsage.get(userId);

  if (!userData) {
    userUsage.set(userId, { count: 1, date: today });
    return true;
  }

  if (userData.date !== today) {
    userUsage.set(userId, { count: 1, date: today });
    return true;
  }

  if (userData.count >= DAILY_LIMIT) return false;

  userData.count++;
  return true;
};

/* ================= VALIDATION ================= */
const validateCode = (code, res) => {
  if (!code || typeof code !== "string") {
    res.status(400).json({ message: "Code is required" });
    return false;
  }

  const trimmed = code.trim();

  if (trimmed.length < 3) {
    res.status(400).json({ message: "Code too short" });
    return false;
  }

  if (trimmed.length > 5000) {
    res.status(400).json({ message: "Code too long" });
    return false;
  }

  return true;
};

/* ================= SAFE SAVE ================= */
const save = async (req, code, output, type, sourceLang = "auto", targetLang = type) => {
  try {
    await History.create({
      user: req.user?.id || null,
      originalCode: code,
      output,
      sourceLang,
      targetLang,
      type
    });
  } catch (err) {
    console.log("⚠️ History skipped:", err.message);
  }
};

/* ================= AI CALL (WITH CACHE) ================= */
const callAI = async (prompt) => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const key = prompt.slice(0, 200);
  const now = Date.now();

  // ⚡ CACHE HIT
  if (cache.has(key)) {
    const { data, expiry } = cache.get(key);

    if (now < expiry) {
      console.log("⚡ CACHE HIT");
      return data;
    } else {
      cache.delete(key);
    }
  }

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "meta-llama/llama-3-8b-instruct",
        messages: [
          {
            role: "user",
            content: prompt.slice(0, 2500)
          }
        ],
        max_tokens: 800
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const result =
      response.data?.choices?.[0]?.message?.content || "No response";

    // 🔥 LIMIT CACHE SIZE
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    cache.set(key, {
      data: result,
      expiry: now + CACHE_TTL
    });

    return result;

  } catch (error) {
    console.error("🔥 AI ERROR:", error.response?.data || error.message);

    throw new Error(
      error.response?.data?.error?.message ||
      JSON.stringify(error.response?.data) ||
      error.message
    );
  }
};

/* ================= CONTROLLERS ================= */

const handleRequest = async (req, res, prompt, type, sourceLang = "auto", targetLang = type) => {
  try {
    const userId = req.user?.id || req.ip;

    if (!checkUsage(userId)) {
      return res.status(429).json({
        message: "Daily AI limit reached"
      });
    }

    const output = await callAI(prompt);

    await save(req, req.body.code, output, type, sourceLang, targetLang);

    res.json({
      output,
      translatedCode: type === "translate" ? output : undefined,
      sourceLang,
      targetLang
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ================= ENDPOINTS ================= */

export const translateSmart = async (req, res) => {
  const { code, targetLang } = req.body;
  if (!validateCode(code, res)) return;

  return handleRequest(
    req,
    res,
    `Convert this code to ${targetLang}. Return ONLY code:\n\n${code}`,
    "translate",
    "auto",
    targetLang
  );
};

export const explainCode = async (req, res) => {
  const { code } = req.body;
  if (!validateCode(code, res)) return;

  return handleRequest(req, res, `Explain this code:\n\n${code}`, "explain");
};

export const fixCode = async (req, res) => {
  const { code } = req.body;
  if (!validateCode(code, res)) return;

  return handleRequest(req, res, `Fix this code:\n\n${code}`, "fix");
};

export const reviewCode = async (req, res) => {
  const { code } = req.body;
  if (!validateCode(code, res)) return;

  return handleRequest(req, res, `Review this code:\n\n${code}`, "review");
};

export const optimizeCode = async (req, res) => {
  const { code } = req.body;
  if (!validateCode(code, res)) return;

  return handleRequest(req, res, `Optimize this code:\n\n${code}`, "optimize");
};

export const generateTestCases = async (req, res) => {
  const { code } = req.body;
  if (!validateCode(code, res)) return;

  return handleRequest(req, res, `Generate test cases:\n\n${code}`, "testcases");
};

export const analyzeDSA = async (req, res) => {
  const { code } = req.body;
  if (!validateCode(code, res)) return;

  return handleRequest(req, res, `Analyze this code:\n\n${code}`, "analyze");
};