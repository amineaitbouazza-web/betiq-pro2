export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  const { date, leagues, sortBy } = await req.json();
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set in Vercel" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  try {
    // Step 1: Search fixtures
    const searchRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 3000,
        system: "You are a football fixture researcher. Return ONLY JSON array.",
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: `Find REAL football matches for ${date} in: ${leagues.join(", ")}. Return ONLY JSON: [{"home":"Team","away":"Team","league":"League","time":"15:00"}]` }]
      }),
    });

    const searchData = await searchRes.json();
    const fixtureText = searchData.content?.find(c => c.type === "text")?.text || "[]";
    const jsonMatch = fixtureText.match(/\[[\s\S]*\]/);
    const fixtures = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    if (!fixtures || fixtures.length === 0) throw new Error(`No fixtures for ${date}`);

    // Step 2: Generate predictions
    const analysisRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        system: "You are a betting analyst. Return ONLY JSON array.",
        messages: [{ role: "user", content: `Fixtures:\n${fixtures.map(f=>`${f.home} vs ${f.away}`).join("\n")}\n\nReturn 10 picks: [{"home":"","away":"","league":"","tip":"Home Win","conf":75,"odds":1.95,"homeForm":"WWDWL","awayForm":"DLWDL","factor":"reason","reasoning":"analysis"}]` }]
      }),
    });

    const analysisData = await analysisRes.json();
    const analysisText = analysisData.content?.find(c => c.type === "text")?.text || "[]";
    const jsonMatch2 = analysisText.match(/\[[\s\S]*\]/);
    let picks = jsonMatch2 ? JSON.parse(jsonMatch2[0]) : [];

    picks = picks.slice(0, 10).map((p, i) => ({
      id: i + 1,
      home: p.home || "Unknown",
      away: p.away || "Unknown",
      league: p.league || leagues[0],
      tip: p.tip || "Home Win",
      conf: Math.min(88, Math.max(60, parseInt(p.conf) || 70)),
      odds: parseFloat(p.odds) || 1.80,
      homeForm: p.homeForm || "",
      awayForm: p.awayForm || "",
      factor: p.factor || "",
      reasoning: p.reasoning || "",
    }));

    picks = sortBy === "odds" ? picks.sort((a, b) => b.odds - a.odds) : picks.sort((a, b) => b.conf - a.conf);

    const stats = {
      avgConf: Math.round(picks.reduce((s, p) => s + p.conf, 0) / picks.length),
      totalOdds: picks.reduce((s, p) => s * p.odds, 1).toFixed(1),
      avgOdds: (picks.reduce((s, p) => s + p.odds, 0) / picks.length).toFixed(2),
    };

    return new Response(JSON.stringify({
      success: true,
      fixtures: fixtures.slice(0, 10).map(f => `${f.home} vs ${f.away} | ${f.league}`),
      picks,
      stats,
    }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
