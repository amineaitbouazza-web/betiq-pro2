import { useState } from "react";

const ALL_LEAGUES = ["Premier League","La Liga","Serie A","Bundesliga","Ligue 1","MLS","Liga MX"];
const GROUPS = [
  { label:"🌍 All World", value:"ALL", leagues:ALL_LEAGUES },
  { label:"⭐ Europe Top 5", value:"EU5", leagues:["Premier League","La Liga","Serie A","Bundesliga","Ligue 1"] },
  ...ALL_LEAGUES.map(l => ({ label:l, value:l, leagues:[l] })),
];

const FLAG = { "Premier League":"🏴󠁥󠁧","La Liga":"🇪🇸","Serie A":"🇮","Bundesliga":"🇩🇪","Ligue 1":"🇫🇷","MLS":"🇺🇸","Liga MX":"🇲🇽" };
const getRisk = c => c>=75?{label:"LOW RISK",color:"#00e676"}:c>=65?{label:"MED RISK",color:"#ffd600"}:{label:"HIGH RISK",color:"#ff6d00"};

const FormBar = ({form}) => !form ? null : (
  <span style={{display:"inline-flex",gap:2}}>
    {form.split("").map((c,i)=>(
      <span key={i} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:15,height:15,borderRadius:3,fontSize:8,fontWeight:900,fontFamily:"monospace",background:c==="W"?"rgba(0,230,118,.18)":c==="D"?"rgba(255,214,0,.18)":"rgba(255,80,80,.18)",color:c==="W"?"#00e676":c==="D"?"#ffd600":"#ff6060"}}>{c}</span>
    ))}
  </span>
);

export default function App() {
  const today = new Date().toISOString().split("T")[0];
  const [selectedGroup, setSelectedGroup] = useState("EU5");
  const [date, setDate] = useState(today);
  const [sortBy, setSortBy] = useState("odds");
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});
  const [revealed, setRevealed] = useState(false);
  const [searchLog, setSearchLog] = useState([]);

  const group = GROUPS.find(g=>g.value===selectedGroup)||GROUPS[1];

  const run = async () => {
    const selected = new Date(date);
    const todayDate = new Date();
    todayDate.setHours(0,0,0,0);
    if (selected < todayDate) { setError("Please select a future date."); return; }

    setLoading(true);
    setError(null);
    setPicks([]);
    setRevealed(false);
    setSearchLog([]);

    try {
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, leagues: group.leagues, sortBy })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setSearchLog(data.fixtures?.slice(0,5) || []);
      setPicks(data.picks || []);
      setStats(data.stats || {});
      setTimeout(()=>setRevealed(true), 80);

    } catch (e) {
      setError(e.message + " → Add ANTHROPIC_API_KEY in Vercel Settings");
    } finally {
      setLoading(false);
    }
  };

  const copyPicks = () => navigator.clipboard.writeText(picks.map((p,i) => `${i+1}. [${p.league}] ${p.home} vs ${p.away} | ${p.tip} @ ${p.odds} | ${p.conf}%`).join("\n"));

  return (
    <div style={{minHeight:"100vh",fontFamily:"'Rajdhani',sans-serif",color:"#dde8ff",padding:20}}>
      <h1 style={{fontFamily:"'Orbitron',monospace",fontSize:26,fontWeight:900,color:"#fff",letterSpacing:4}}>BETIQ <span style={{color:"#00b4d8"}}>PRO</span> <span style={{marginLeft:10,fontSize:9,fontWeight:700,padding:"3px 9px",borderRadius:20,background:"rgba(0,230,118,.1)",border:"1px solid rgba(0,230,118,.3)",color:"#00e676"}}>🔴 LIVE</span></h1>
      <p style={{fontSize:9,color:"rgba(180,210,255,.38)",letterSpacing:2,marginTop:4}}>REAL FIXTURES · CLAUDE AI · VALUE BETS</p>
      
      <div style={{margin:"20px 0",display:"flex",gap:10,flexWrap:"wrap"}}>
        <select value={selectedGroup} onChange={e=>setSelectedGroup(e.target.value)} style={{padding:10,borderRadius:6,border:"none",background:"#1a2a3a",color:"#fff"}}>
          {GROUPS.map(g=><option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} min={today} style={{padding:10,borderRadius:6,border:"none",background:"#1a2a3a",color:"#fff"}}/>
        <button onClick={run} disabled={loading} style={{padding:"10px 24px",borderRadius:6,border:"none",background:loading?"#555":"#00b4d8",color:"#fff",cursor:loading?"not-allowed":"pointer",fontWeight:"bold"}}>{loading?"⟳ SEARCHING...":"⚡ GET REAL PICKS"}</button>
      </div>

      {error && <div style={{background:"rgba(255,23,68,.2)",border:"1px solid #f55",borderRadius:8,padding:14,marginBottom:16}}>⚠️ {error}</div>}
      
      {searchLog.length > 0 && <div style={{background:"rgba(0,230,118,.1)",border:"1px solid #0f0",borderRadius:8,padding:14,marginBottom:16}}>✅ {searchLog.length} REAL FIXTURES FOUND</div>}
      
      {picks.length > 0 && (
        <div style={{display:"grid",gap:10}}>
          {picks.map(p => {const risk=getRisk(p.conf);return (
            <div key={p.id} style={{background:"rgba(255,255,255,.05)",borderRadius:8,padding:14,border:`1px solid ${risk.color}44`}}>
              <div style={{fontSize:16,fontWeight:"bold"}}>{p.home} vs {p.away}</div>
              <div style={{color:"#00e676",marginTop:4}}>💡 {p.tip} @ {p.odds} • {p.conf}% <span style={{background:`${risk.color}22`,color:risk.color,padding:"2px 6px",borderRadius:4,fontSize:10,marginLeft:8}}>{risk.label}</span></div>
              <div style={{color:"#888",fontSize:12,marginTop:4}}>{p.league} • {p.reasoning}</div>
              {(p.homeForm || p.awayForm) && <div style={{marginTop:8,fontSize:10}}>{p.homeForm && <span>🏠 {p.homeForm}</span>}{p.awayForm && <span style={{marginLeft:8}}>✈️ {p.awayForm}</span>}</div>}
            </div>
          );})}
          <button onClick={copyPicks} style={{padding:"10px 20px",borderRadius:6,border:"none",background:"#00b4d8",color:"#fff",cursor:"pointer",marginTop:10}}>📋 Copy All</button>
        </div>
      )}

      <div style={{marginTop:30,textAlign:"center",color:"#666",fontSize:11,borderTop:"1px solid #333",paddingTop:20}}>
        <p>⚠️ For entertainment only. Bet responsibly. 18+</p>
        <p style={{marginTop:6}}>Powered by Claude AI • Vercel • Web Search</p>
      </div>
    </div>
  );
}
