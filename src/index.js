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

    const prompt = buildPrompt(text);
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
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.25,
          topP: 0.8,
          maxOutputTokens: 800
        }
      })
    });

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini API error:", JSON.stringify(geminiData));
      return jsonResponse(
        { error: "AI変換APIの呼び出しに失敗しました。" },
        500
      );
    }

    const result = extractGeminiText(geminiData);

    if (!result) {
      console.error("Gemini empty result:", JSON.stringify(geminiData));
      return jsonResponse(
        { error: "変換結果を取得できませんでした。" },
        500
      );
    }

    return jsonResponse({ result: cleanResult(result) });
  } catch (error) {
    console.error(error);

    return jsonResponse(
      { error: "サーバー側でエラーが発生しました。" },
      500
    );
  }
}

function buildPrompt(text) {
  return `
あなたは人間関係を円滑にするための文章変換AIです。

目的:
友人、家族、恋人、同僚、知人など、一般人同士の会話において、
強い言葉・怒り・命令口調・嫌味・冷たい表現を、
相手が受け取りやすいやさしい言葉に変換してください。

重要:
これはカスタマーサポート文ではありません。
「恐れ入ります」「ご案内いたします」「対応いたします」などの業務的すぎる表現は使わないでください。
日常会話として自然な日本語にしてください。

変換ルール:
- 元の意図は残す
- 相手を責める表現をやわらげる
- 命令口調をお願い・相談の形にする
- 嫌味や攻撃的な表現を消す
- 丁寧すぎず、自然な言い方にする
- 文章は1〜3文にする
- 途中で終わる文章は禁止
- 余計な説明は不要
- 変換後の文章だけを出力する

変換例:
原文: なんでまだ返事ないの？早くして。
変換後: まだ返事が来ていないみたいで少し気になっています。時間があるときに返してもらえるとうれしいです。

原文: 何回言えばわかるの？
変換後: 前にも伝えたことなので、もう一度確認してもらえると助かります。

原文: その言い方むかつく。
変換後: その言い方だと少しきつく感じてしまいました。もう少しやわらかく話してもらえるとうれしいです。

原文: もういい。勝手にして。
変換後: 今は少し気持ちが落ち着かないので、少し時間を置きたいです。

原文: 全然納得できない。ちゃんと説明して。
変換後: まだ少し納得できていないところがあります。もう少し詳しく説明してもらえると助かります。

原文: こっちは忙しいんだけど。
変換後: 今少し忙しいので、あとで改めて話せると助かります。

今回の原文:
${text}

変換後:
`.trim();
}

function extractGeminiText(geminiData) {
  return (
    geminiData?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || ""
  );
}

function cleanResult(text) {
  return text
    .replace(/^変換後[:：]\s*/g, "")
    .replace(/^["「『]/g, "")
    .replace(/["」』]$/g, "")
    .trim();
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
