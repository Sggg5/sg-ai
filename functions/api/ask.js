export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const question = String(body.question || "").trim();

    if (!question) {
      return json({ error: "问题不能为空" }, 400);
    }

    const searchResults = await env.MY_SEARCH.search({
      query: question,
      ai_search_options: {
        retrieval: {
          retrieval_type: "hybrid",
          max_num_results: 8,
          match_threshold: 0.35,
          context_expansion: 1
        },
        query_rewrite: {
          enabled: true
        },
        reranking: {
          enabled: true,
          model: "@cf/baai/bge-reranker-base"
        }
      }
    });

    const chunks = searchResults.chunks || [];

    const contextText = chunks
      .slice(0, 6)
      .map((c, i) => {
        return `【资料${i + 1}】
来源：${c.item?.key || "未知文件"}
相似度：${Number(c.score || 0).toFixed(3)}
内容：
${c.text}`;
      })
      .join("\n\n");

    const systemPrompt = `
你是 FRANTA AI 工程师助手。
你的回答对象是工厂技术、质量、工艺、销售人员。
请基于给定资料回答，不要胡编。
如果资料不足，要明确说“当前知识库未找到充分依据”。
回答风格要求：
1. 先给结论
2. 再分点说明
3. 最后列出参考来源
4. 使用简体中文
5. 适合不锈钢管道、管件、工艺、质量体系场景
`;

    const userPrompt = `
用户问题：
${question}

知识库检索资料：
${contextText || "未检索到相关资料"}
`;

    const aiResp = await env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct-fast",
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 1200
      },
      {
        gateway: {
          id: "sggg",
          collectLog: true,
          metadata: {
            app: "franta-ai",
            source: "ai.sggg.cc.cd"
          }
        }
      }
    );

    const answer =
      aiResp.response ||
      aiResp.result?.response ||
      aiResp.choices?.[0]?.message?.content ||
      "AI 已完成检索，但未返回有效回答。";

    const sources = chunks.slice(0, 6).map((c) => ({
      title: c.item?.key || "未知文件",
      score: c.score || 0,
      text: c.text || ""
    }));

    return json({
      question,
      answer,
      sources,
      count: chunks.length
    });
  } catch (err) {
    return json(
      {
        error: "服务器处理失败",
        detail: String(err.message || err)
      },
      500
    );
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
