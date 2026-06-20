export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/soften") {
      return handleSoften(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleSoften(request, env) {
  try {
    const body = await request.json();
    const text = String(body.text || "").trim();
    const tone = String(body.tone || "business");

    if (!text) {
      return jsonResponse({ error: "文章が空です。" }, 400);
    }

    if (text.length > 1000) {
      return jsonResponse({ error: "文章は1000文字以内にしてください。" }, 400);
    }

    if (!env.GEMINI_API_KEY) {
      return jsonResponse(
        { error: "GEMINI_API_KEY が設定されていません。" },
        500
      );
    }

    const toneInstruction = getToneInstruction(tone);

    const prompt = `
あなたは日本語コミュニケーションの専門家です。

次の文章を、相手を傷つけない柔らかい表現に変換してください。

条件:
- 元の意図はできるだけ残す
- 攻撃的な表現、命令口調、嫌味、脅し、侮辱をなくす
- ビジネスチャットで送れる自然な日本語にする
- 余計な説明は出さない
- 変換後の文章だけを出力する
- 相手に行動してほしい場合は、依頼・確認の形にする
- 強い不満が含まれている場合も、冷静な確認文にする

文体:
${toneInstruction}

変換したい文章:
${text}
`.trim();

    const model = env.GEMINI_MODEL || "gemini-3.5-flash";

    const apiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
      `?key=${env.GEMINI_API_KEY}`;

    const geminiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 500
        }
      })
    });

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini API error:", geminiData);
      return jsonResponse(
        { error: "AI変換APIの呼び出しに失敗しました。" },
        500
      );
    }

    const result =
      geminiData?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim() || "";

    if (!result) {
      return jsonResponse(
        { error: "変換結果を取得できませんでした。" },
        500
      );
    }

    return jsonResponse({ result });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: "サーバー側でエラーが発生しました。" },
      500
    );
  }
}

function getToneInstruction(tone) {
  switch (tone) {
    case "normal":
      return "丁寧すぎず、自然でやわらかい表現にしてください。";
    case "verySoft":
      return "かなり丁寧で、相手への配慮が強く伝わる表現にしてください。";
    case "casual":
      return "カジュアルだけど失礼にならない、やさしい表現にしてください。";
    case "business":
    default:
      return "ビジネスチャットで使える、丁寧で落ち着いた表現にしてください。";
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8" }
  });
}
