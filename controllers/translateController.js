import axios from "axios";
import Translation from "../models/Translation.js";

export const translateCode = async (req, res) => {
  try {

    const { code, sourceLang, targetLang } = req.body;

    if (!code || !sourceLang || !targetLang) {
      return res.status(400).json({
        message: "Missing fields"
      });
    }

    // AI PROMPT
    const prompt = `
You are a code translator.

Convert the following ${sourceLang} code into ${targetLang}.

Rules:
- Return ONLY translated code
- No explanations
- No markdown
- No extra text

Code:
${code}
`;

    // OPENROUTER API
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "deepseek/deepseek-chat",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    // CLEAN RESPONSE
    let translatedCode =
      response.data.choices[0].message.content;

    translatedCode = translatedCode
      .replace(/```[a-z]*\n?/gi, "")
      .replace(/```/g, "")
      .trim();

    // AUTO SAVE / AUTO UPDATE HISTORY
    const translation = await Translation.findOneAndUpdate(
      {
        user: req.user.id,
        originalCode: code,
        targetLang
      },
      {
        user: req.user.id,
        sourceLang,
        targetLang,
        originalCode: code,
        translatedCode
      },
      {
        new: true,
        upsert: true
      }
    );

    // RESPONSE
    res.json({
      translatedCode,
      history: translation
    });

  } catch (error) {

    console.error(
      error.response?.data || error
    );

    res.status(500).json({
      message: "Translation failed"
    });
  }
};