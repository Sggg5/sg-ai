const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return htmlResponse(renderHomePage());
    }

    if (request.method === "POST" && url.pathname === "/api/ask") {
      return handleAsk(request, env);
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};

async function handleAsk(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const question = String(body.question || "").trim();

    if (!question) {
      return jsonResponse({ error: "问题不能为空" }, 400);
    }

    let searchError = "";
    let searchResults = { chunks: [] };

    try {
      searchResults = await env.MY_SEARCH.search({
        query: question,
        ai_search_options: {
          retrieval: {
            retrieval_type: "vector",
            max_num_results: 8,
            match_threshold: 0.35,
            context_expansion: 1,
          },
          query_rewrite: {
            enabled: true,
          },
          reranking: {
            enabled: true,
            model: "@cf/baai/bge-reranker-base",
          },
        },
      });
    } catch (error) {
      searchError = String(error?.message || error);
    }

    const chunks = Array.isArray(searchResults?.chunks) ? searchResults.chunks : [];
    const contextText = chunks
      .slice(0, 6)
      .map((chunk, index) => {
        const source = chunk.item?.key || chunk.item?.name || "未知资料";
        const score = Number(chunk.score || 0).toFixed(3);
        return `【资料${index + 1}】\n来源：${source}\n相似度：${score}\n内容：\n${chunk.text || ""}`;
      })
      .join("\n\n");

    const aiResponse = await env.AI.run(AI_MODEL, {
      messages: [
        {
          role: "system",
          content:
            "你是 FRANTA AI 工程师助手。请基于检索资料回答问题，不要编造。回答必须使用简体中文，先给结论，再分点说明，最后列出参考来源。如果资料不足，请明确说明当前知识库未找到充分依据。",
        },
        {
          role: "user",
          content: `用户问题：\n${question}\n\n知识库检索资料：\n${contextText || "未检索到相关资料"}\n\n检索状态：${searchError ? `AI Search 调用失败：${searchError}` : "AI Search 调用成功"}`,
        },
      ],
      max_tokens: 1200,
    });

    const answer =
      aiResponse?.response ||
      aiResponse?.result?.response ||
      aiResponse?.choices?.[0]?.message?.content ||
      "AI 已完成检索，但未返回有效回答。";

    const sources = chunks.slice(0, 6).map((chunk) => ({
      title: chunk.item?.key || chunk.item?.name || "未知资料",
      score: chunk.score || 0,
      text: chunk.text || "",
    }));

    return jsonResponse({
      question,
      answer,
      sources,
      count: chunks.length,
      searchError,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: "服务处理失败",
        detail: String(error?.message || error),
      },
      500,
    );
  }
}

function renderHomePage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FRANTA AI 工程师助手</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f7f8;
      --ink: #101820;
      --muted: #66717e;
      --line: rgba(16, 24, 32, 0.12);
      --accent: #0f8b8d;
      --panel: rgba(255,255,255,0.88);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-width: 320px;
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif;
      background:
        linear-gradient(135deg, rgba(15, 139, 141, 0.12), transparent 34%),
        linear-gradient(180deg, #fff, #edf2f5);
    }
    main {
      width: min(980px, calc(100% - 28px));
      margin: 0 auto;
      padding: 56px 0 72px;
    }
    header {
      border-bottom: 1px solid var(--line);
      padding-bottom: 28px;
      margin-bottom: 28px;
    }
    .eyebrow {
      margin: 0 0 10px;
      color: #145c66;
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
    }
    h1 {
      margin: 0 0 12px;
      font-size: clamp(36px, 7vw, 68px);
      line-height: 1.05;
    }
    header p {
      margin: 0;
      color: var(--muted);
      font-size: 18px;
    }
    .panel {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--panel);
      box-shadow: 0 22px 56px rgba(16, 24, 32, 0.08);
      padding: 22px;
    }
    textarea {
      width: 100%;
      min-height: 132px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
      color: var(--ink);
      font: inherit;
      font-size: 17px;
      resize: vertical;
      background: #fff;
    }
    button {
      width: 100%;
      margin-top: 14px;
      border: 0;
      border-radius: 8px;
      padding: 15px 18px;
      background: var(--ink);
      color: #fff;
      cursor: pointer;
      font: inherit;
      font-weight: 800;
    }
    button:disabled { opacity: 0.58; cursor: wait; }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }
    .chips button {
      width: auto;
      margin: 0;
      border: 1px solid var(--line);
      background: #fff;
      color: #145c66;
      font-weight: 700;
      padding: 9px 12px;
    }
    .result {
      margin-top: 22px;
      white-space: pre-wrap;
      line-height: 1.8;
      color: #25313d;
    }
    .sources {
      display: grid;
      gap: 12px;
      margin-top: 18px;
    }
    .source {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: rgba(255,255,255,0.7);
      color: var(--muted);
      font-size: 14px;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">Workers AI + AI Search</p>
      <h1>FRANTA AI 工程师助手</h1>
      <p>连接 AI Search 实例 sggg、R2 知识库 sggg，并使用 Workers AI 生成中文回答。</p>
    </header>

    <section class="panel">
      <textarea id="question" placeholder="请输入问题，例如：沟槽接头为什么会漏水？"></textarea>
      <button id="askButton">AI 搜索并回答</button>
      <div class="chips">
        <button type="button" data-question="沟槽接头为什么会漏水？">沟槽接头为什么会漏水？</button>
        <button type="button" data-question="文件控制程序有哪些要求？">文件控制程序有哪些要求？</button>
        <button type="button" data-question="设备管理程序的目的是什么？">设备管理程序的目的是什么？</button>
      </div>
      <div id="result" class="result">请输入问题后开始检索。</div>
      <div id="sources" class="sources"></div>
    </section>
  </main>

  <script>
    const question = document.querySelector("#question");
    const askButton = document.querySelector("#askButton");
    const result = document.querySelector("#result");
    const sources = document.querySelector("#sources");

    document.querySelectorAll("[data-question]").forEach((button) => {
      button.addEventListener("click", () => {
        question.value = button.dataset.question;
        question.focus();
      });
    });

    askButton.addEventListener("click", async () => {
      const value = question.value.trim();
      if (!value) {
        result.textContent = "请先输入问题。";
        return;
      }

      askButton.disabled = true;
      askButton.textContent = "正在检索知识库...";
      result.textContent = "正在调用 AI Search 和 Workers AI，请稍候。";
      sources.innerHTML = "";

      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: value }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || data.error || "请求失败");
        }
        result.textContent = data.answer;
        sources.innerHTML = (data.sources || [])
          .map((source, index) => '<div class="source"><strong>[' + (index + 1) + '] ' + escapeHtml(source.title) + '</strong><br />相似度：' + Number(source.score || 0).toFixed(3) + '</div>')
          .join("");
      } catch (error) {
        result.textContent = "请求失败：\\n" + error.message;
      } finally {
        askButton.disabled = false;
        askButton.textContent = "AI 搜索并回答";
      }
    });

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[char]));
    }
  </script>
</body>
</html>`;
}

function htmlResponse(html) {
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}
