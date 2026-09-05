import {mountDex} from "./dex.mjs";
import {mountTypeTools} from "./type-tools.mjs";
import {mountBattlePrep} from "./battle-prep.mjs";
import {exposure, toggleActive} from "./planner.mjs";
import {
  TYPES,
  GYM_BATTLES,
  STORY_BATTLES,
  multiplier,
  weaknesses,
  opportunities,
  hasOrdinaryTypeDamage,
} from "./domain.mjs";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let state = {
    snapshot: null,
    snapshots: [],
    devices: [],
    plans: [],
    context: {
      difficulty: "unknown",
      levelCap: null,
      checkpoint: "",
      spoilerMode: "hints",
      favorites: [],
    },
    events: [],
    notes: [],
  },
  catalog = [],
  selected = [],
  inverse = false,
  limit = 3,
  hard = false,
  query = "",
  scope = "all",
  catalogMode = false,
  view = location.hash.slice(1) || "today",
  loaded = false,
  compare = null,
  pair = null,
  opponent = ["normal"],
  battleGroup = "gym",
  activePlan = null,
  collectionPage = 0, toolCleanup = null,
  shortlist = [], focusBoard = false, swapIn = null, draftName = "", lastCounts = null, plannerMessage = "";
const owned = () =>
    state.snapshot
      ? [
          ...state.snapshot.party,
          ...state.snapshot.boxes.flatMap((b) => b.pokemon),
        ]
      : [],
  team = () =>
    selected.map((id) => owned().find((p) => p.id === id)).filter(Boolean),
  name = (p) =>
    p.nickname && p.nickname !== p.name ? `${p.nickname} · ${p.name}` : p.name;
const when = (d) =>
  d
    ? new Date(d).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Never";
const age = (d) => {
  if (!d) return "No sync yet";
  const m = Math.max(0, Math.floor((Date.now() - Date.parse(d)) / 60000));
  return m < 1
    ? "Just now"
    : m < 60
      ? `${m}m ago`
      : m < 1440
        ? `${Math.floor(m / 60)}h ago`
        : `${Math.floor(m / 1440)}d ago`;
};
const types = (ts) =>
  (ts || [])
    .map((t) => `<span class="type ${esc(t.toLowerCase())}">${esc(t)}</span>`)
    .join("");
const opts = (arr, current) =>
  arr
    .map(
      (a) =>
        `<option value="${esc(a)}" ${a === current ? "selected" : ""}>${esc(a)}</option>`,
    )
    .join("");
function notify(text) {
  $("#notice").textContent = text;
  setTimeout(() => {
    $("#notice").textContent = "";
  }, 9000);
}
async function api(
  path,
  method = "GET",
  body,
  raw = false,
  filename = "Unbound.srm",
) {
  const r = await fetch("/api" + path, {
    method,
    headers: body
      ? raw
        ? {
            "Content-Type": "application/octet-stream",
            "X-Game-Version": "2.1.1.1",
            "X-Save-Name": encodeURIComponent(filename),
            "X-Capture-Id": crypto.randomUUID(),
            "X-Captured-At": new Date().toISOString(),
          }
        : { "Content-Type": "application/json" }
      : {},
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
  });
  if (!r.ok) {
    let msg;
    try {
      msg = (await r.json()).error;
    } catch {
      msg = `Request failed (${r.status}). Check your connection and sign-in.`;
    }
    throw Error(msg);
  }
  return r.json();
}
async function refresh(quiet = false) {
  try {
    const previous = state.snapshot?.id;
    state = await api("/state");
    state.context = {
      difficulty: "unknown",
      levelCap: null,
      checkpoint: "",
      spoilerMode: "hints",
      favorites: [],
      ...state.context,
    };
    if (!loaded || !previous)
      selected = state.snapshot?.party.map((p) => p.id) || [];
    else if (previous !== state.snapshot?.id)
      selected = selected.filter((id) => owned().some((p) => p.id === id));
    if (!loaded) {
      shortlist = [...selected];
      try {const d=JSON.parse(localStorage.getItem('borrius-planner')||'null');if(d){shortlist=(d.shortlist||[]).filter(id=>owned().some(p=>p.id===id)).slice(0,24);selected=(d.selected||[]).filter(id=>shortlist.includes(id)).slice(0,6);inverse=!!d.inverse;limit=Math.max(1,Math.min(6,d.limit||3));draftName=d.name||'';activePlan=state.plans.some(p=>p.id===d.activePlan)?d.activePlan:null;}}catch{}
    }
    shortlist=[...new Set([...shortlist.filter(id=>owned().some(p=>p.id===id)),...selected])];
    if(swapIn&&!shortlist.includes(swapIn))swapIn=null;
    loaded = true;
    render();
    if (!quiet) notify("Playthrough refreshed.");
  } catch (e) {
    $("#status").textContent = "Connection needs attention";
    if (!loaded)
      $("#content").innerHTML =
        `<div class="empty"><h2>Let’s reconnect.</h2><p>${esc(e.message)}</p><button data-action="refresh">Try again</button></div>`;
    else notify(e.message);
  }
}
function head(kicker, title, description, action = "") {
  return `<div class="lead"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}
function blank() {
  return `<div class="empty"><div class="eyebrow">Your next adventure starts here</div><h2>No save yet.</h2><p>Pair your Retroid for automatic snapshots, or import a cartridge save.<br>Your game files are never modified.</p><a class="button" href="#settings">Connect your Retroid →</a></div>`;
}
function portrait(p, extra = "") {
  return Number.isInteger(p.dexId) && p.dexId > 0 && p.dexId <= 1025
    ? `<img class="sprite ${extra}" src="/sprites/${p.dexId}.png" alt="" width="96" height="96" loading="lazy">`
    : `<span class="unknown-mon" aria-hidden="true">?</span>`;
}
function card(p, actions = true) {
  const isSelected = selected.includes(p.id), fav = state.context.favorites.includes(p.id);
  const hp = p.hp && Number.isFinite(p.hp.current) && p.hp.max > 0 ? Math.max(0, Math.min(100, 100 * p.hp.current / p.hp.max)) : null;
  return `<article class="mon ${isSelected ? "selected" : ""}" data-type="${esc(p.types?.[0]?.toLowerCase() || "normal")}"><div class="mon-top"><span class="avatar" aria-hidden="true">${portrait(p)}</span><div><small class="mon-location">${p.location.kind === "party" ? "IN YOUR PARTY" : "BOX " + p.location.box}</small><h3>${esc(p.nickname || p.name)}${fav ? ' <span class="gold">★</span>' : ""}</h3><small>${esc(p.nickname !== p.name ? p.name + " · " : "")}Lv. ${p.level}</small></div></div><div class="types">${types(p.types)}</div>${hp !== null ? `<div class="hp-line"><b>HP</b><span class="hp-track"><span style="width:${hp}%;background:${hp < 20 ? '#c74544' : hp < 50 ? '#c18a25' : '#418761'}"></span></span><small>${p.hp.current} / ${p.hp.max}</small></div>` : ""}<p>${esc(p.ability)} · ${esc(!p.item || p.item === "None" ? "No held item" : p.item)}</p><div class="mon-actions"><button class="quiet" data-action="detail" data-id="${esc(p.id)}">Summary</button>${actions ? `<button class="${isSelected ? "quiet" : ""}" data-action="select" data-id="${esc(p.id)}" aria-pressed="${isSelected}">${isSelected ? "− Bench" : "+ Plan"}</button>` : ""}</div></article>`;
}
function today() {
  const s = state.snapshot;
  const intro = `<section class="camp-hero"><div class="hero-copy"><div class="eyebrow">THE BORRIUS ADVENTURE</div><h1>A good day for<br>another adventure.</h1><p>${state.context.checkpoint ? `Up next: ${esc(state.context.checkpoint)}` : "Six companions. A whole region to explore.<br>Pick up your journey right where you left it."}</p><a class="button" href="#prepare">Let’s get ready <span aria-hidden="true">→</span></a></div><div class="route-scene" aria-hidden="true"><span class="scene-sun"></span><span class="cloud cloud-one"></span><span class="cloud cloud-two"></span><span class="hill hill-back"></span><span class="hill hill-front"></span><span class="route-path"></span><span class="route-sign">BORRIUS ↗</span><div class="scene-party">${s ? s.party.slice(0,3).map(p=>portrait(p)).join("") : '<span class="camp-ball"></span>'}</div><span class="scene-caption">A LITTLE FURTHER, TOGETHER.</span></div></section>`;
  if (!s) return intro + blank();
  return intro + (state.context.nextBattleId?`<section class="panel next-fight-card"><div><div class="eyebrow">YOUR NEXT BIG FIGHT</div><h2>Your battle plan is ready to revisit.</h2><p>${esc(state.context.difficulty)} · ${state.context.fightReveal==='full'?'Full scouting':state.context.fightReveal==='team'?'Team preview':'Typing hints'} · Selected by you</p></div><a class="button" href="#prepare">Open matchup →</a></section>`:'') + `${Date.now() - Date.parse(s.capturedAt) > 3600000 ? '<div class="banner">Your last save is over an hour old. Save in-game and sync your Retroid to catch up.</div>' : ""}<div class="section-head"><div><div class="eyebrow">READY WHEN YOU ARE</div><h2>Your traveling companions</h2></div><a class="text-link" href="#lab">Visit your Pokémon →</a></div><div class="grid roster party-roster">${s.party.map(p=>card(p,false)).join("")}</div><section class="trainer-record"><div class="record-title"><span class="record-ball" aria-hidden="true"></span><div class="eyebrow">TRAINER’S RECORD</div></div><div class="grid metrics"><div class="metric"><strong>${owned().length}</strong><span>Pokémon in your save</span></div><div class="metric"><strong>${s.progress.badges ?? "—"}<small> / 8</small></strong><span>Badges · provisional</span></div><div class="metric"><strong>${esc(state.context.levelCap ?? "—")}</strong><span>Your confirmed level cap</span></div><div class="metric"><strong>${s.progress.heartScales ?? "—"}</strong><span>Heart Scales · provisional</span></div></div></section><div class="grid split field-pages"><section class="panel"><div class="eyebrow">BEFORE YOU SET OFF</div><h2>A few things to remember</h2>${opportunities(s.party,state.context.levelCap).slice(0,6).map(o=>`<div class="insight">${esc(o.text)}</div>`).join("") || '<p>Your party has no immediate item, PP, or confirmed-cap reminders.</p>'}<small>Based on your last save. Check your bag and game before acting.</small></section><section class="panel journal-panel"><div class="eyebrow">FROM YOUR JOURNAL</div><h2>Notes from the road</h2>${state.events.slice(0,4).map(e=>`<div class="insight">${esc(e.text)}<br><small>${when(e.createdAt)}</small></div>`).join("") || '<p>Your next save starts the next page.</p>'}<a class="text-link" href="#journey">Open your journal →</a></section></div><section class="panel"><div class="section-head" style="margin-top:0"><h2>Inside your bag</h2><span class="pill">Provisional save readings</span></div><div class="row"><span class="pill">Money · ${s.progress.money == null ? "Unknown" : Number(s.progress.money).toLocaleString()}</span><span class="pill">Champion · ${s.progress.isChampion == null ? "Unknown" : s.progress.isChampion ? "Flag set" : "Flag not set"}</span></div><details><summary>TM pocket (${s.progress.ownedTms.length} reported)</summary><p>${s.progress.ownedTms.map(esc).join(", ") || "No TMs reported by this parser."}</p></details><p>Confirm these readings in-game. Set your location and next objective in Link.</p>${s.warnings.length ? `<details class="coverage-notes"><summary>About this save · ${s.warnings.length} reading notes</summary>${s.warnings.map(w=>`<p>${esc(w)}</p>`).join("")}</details>` : ""}</section>`;
}
const planningRoster = () => shortlist.map(id=>owned().find(p=>p.id===id)).filter(Boolean);
function matrix() {
 const roster=planningRoster(), rows=exposure(roster,selected,inverse,limit);
 return `<div class="planning-scroll" tabindex="0" aria-label="Team planning grid; scroll horizontally for more candidates"><table class="matrix planning-matrix"><thead><tr><th class="type-col">Incoming<br>type</th><th class="count-col">Weak<br><small>active ${selected.length}/6</small></th>${roster.map((p,i)=>`<th class="${selected.includes(p.id)?"active-column":"bench-column"} ${swapIn===p.id?"swap-column":""}"><button class="grid-summary" data-action="detail" data-id="${esc(p.id)}" aria-label="Summary for ${esc(name(p))}">${portrait(p)}<span>${esc(p.nickname||p.name)}</span><small>Lv. ${p.level}</small></button><button class="grid-toggle ${selected.includes(p.id)?"is-active":""}" data-action="activate" data-id="${esc(p.id)}" aria-pressed="${selected.includes(p.id)}" aria-label="${swapIn&&selected.includes(p.id)?'Replace':selected.includes(p.id)?'Bench':'Activate'} ${esc(name(p))}">${swapIn===p.id?'Cancel':swapIn&&selected.includes(p.id)?'Replace ↓':selected.includes(p.id)?'● Active':selected.length===6?'⇄ Swap in':'+ Activate'}</button><div class="column-tools"><button data-action="left" data-id="${esc(p.id)}" aria-label="Move ${esc(name(p))} left" ${i===0?'disabled':''}>‹</button><button data-action="unlist" data-id="${esc(p.id)}" aria-label="Remove ${esc(name(p))} from shortlist">×</button><button data-action="right" data-id="${esc(p.id)}" aria-label="Move ${esc(name(p))} right" ${i===roster.length-1?'disabled':''}>›</button></div></th>`).join('')}</tr></thead><tbody>${rows.map(({type,count,flagged})=>{const delta=lastCounts?count-lastCounts[type]:0;return `<tr class="${flagged?'threshold-row':''}"><th class="type-col">${types([type])}</th><td class="count-col ${flagged?'count-alert':''}" aria-label="${type}: ${count} active Pokémon weak${flagged?', threshold reached':''}"><b>${flagged?'⚑ ':''}${count}</b>${delta?`<small class="count-delta ${delta>0?'worse':'better'}">${delta>0?'+':''}${delta}</small>`:''}</td>${roster.map(p=>{const v=multiplier(type,p.types,inverse),active=selected.includes(p.id);return `<td class="${active?'':'bench-cell '}${v===0?'immune':v>1?'weak':v<1?'resist':'neutral'}" aria-label="${esc(name(p))}: ${v} times${active?'':', bench; not counted'}">${v}×</td>`}).join('')}</tr>`;}).join('')}</tbody></table></div>`;
}
function candidates() {
  const t = team(),
    w = weaknesses(t, inverse).filter((x) => x.count > 0),
    list = owned()
      .filter((p) => !selected.includes(p.id))
      .map((p) => {
        const protection = w.filter(
            (x) => multiplier(x.type, p.types, inverse) < 1,
          ),
          covers = [
            ...new Set(
              p.moves
                .filter(hasOrdinaryTypeDamage)
                .flatMap((m) =>
                  TYPES.filter(
                    (type) => multiplier(m.type, [type], inverse) > 1,
                  ),
                ),
            ),
          ];
        return {
          p,
          protection,
          covers,
          score: protection.reduce((n, x) => n + x.count, 0),
          passes: TYPES.every(
            (type) =>
              t.filter((mon) => multiplier(type, mon.types, inverse) > 1)
                .length +
                (multiplier(type, p.types, inverse) > 1 ? 1 : 0) <
              limit,
          ),
        };
      })
      .filter((x) => !hard || x.passes)
      .sort((a, b) => b.score - a.score || b.p.level - a.p.level)
      .slice(0, 4);
  return (
    list
      .map(
        (x) =>
          `<div class="list-item"><div><strong>${esc(name(x.p))}</strong><p>${x.protection.length ? "Resists " + x.protection.map((w) => esc(w.type)).join(", ") + " where this plan is exposed." : "No resistance to this plan’s exposed types."} ${x.p.moves.some((m) => m.type) ? `Validated attacks cover ${x.covers.length} single types.` : "Move coverage awaits validated metadata."}</p></div><button class="quiet" data-action="detail" data-id="${esc(x.p.id)}">Inspect</button></div>`,
      )
      .join("") ||
    "<p>No owned candidates satisfy this threshold. Try a softer limit or change the plan.</p>"
  );
}
function lab() {
 if (!state.snapshot) return blank();
 const rows=exposure(planningRoster(),selected,inverse,limit), flagged=rows.filter(x=>x.flagged);
 const list=owned().filter(p=>(scope==='all'||scope==='party'&&p.location.kind==='party'||scope==='boxes'&&p.location.kind==='box'||scope==='favorites'&&state.context.favorites.includes(p.id))&&`${p.name} ${p.nickname} ${p.types.join(' ')} ${p.ability} ${p.moves.map(m=>m.name).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
 return `<div class="planner-heading"><div><div class="eyebrow">THE POKÉMON WORKSHOP</div><h1>Find your six.</h1></div><button class="quiet" data-action="party">Use current party</button></div><section class="planner-workspace"><div class="planner-controls"><button class="quiet" data-action="focus-board">${focusBoard?"↙ Exit focus":"⛶ Focus grid"}</button><strong>${selected.length}/6 active <small>· ${shortlist.length} shortlisted</small></strong><label>Rules<select id="inverse"><option value="false" ${!inverse?'selected':''}>Standard</option><option value="true" ${inverse?'selected':''}>Inverse</option></select></label><label>Flag rows at<select id="limit">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${limit===n?'selected':''}>${n}+ weak</option>`).join('')}</select></label><form id="plan-form"><input name="name" aria-label="Plan name" maxlength="80" required placeholder="Name this team" value="${esc(draftName)}"><button ${selected.length?'':'disabled'}>${activePlan?'Update plan':'Save plan'}</button></form></div><div class="planner-feedback" role="status" aria-live="polite">${swapIn?`Choose an active Pokémon to replace with <b>${esc(name(owned().find(p=>p.id===swapIn)))}</b>. <button class="quiet mini" data-action="cancel-swap">Cancel swap</button>`:`<b>${flagged.length?flagged.length+(flagged.length===1?' type at the threshold':' types at the threshold'):'No types at the threshold'}</b>${flagged.length?' · '+flagged.map(x=>`${esc(x.type)} ${x.count}`).join(' · '):''} <span>${esc(plannerMessage||'Bench columns stay visible but do not count. At six, choose “Swap in,” then who to replace.')}</span>`}</div><div class="planner-body"><section class="roster-picker" aria-label="Shortlist picker"><label>Find a Pokémon<input id="search" type="search" value="${esc(query)}" placeholder="Name, type, move…"></label><label>Show<select id="scope">${opts(['all','party','boxes','favorites'],scope)}</select></label><small>${list.length} matches · up to 24 on the board</small><div class="picker-list">${list.map(p=>`<div class="picker-mon">${portrait(p)}<div><strong>${esc(p.nickname||p.name)}</strong><small>Lv. ${p.level} · ${esc(p.types.join('/'))}</small></div><button class="quiet" data-action="${shortlist.includes(p.id)?'detail':'shortlist'}" data-id="${esc(p.id)}" aria-label="${shortlist.includes(p.id)?'Inspect':'Shortlist'} ${esc(name(p))}">${shortlist.includes(p.id)?'⋯':'+'}</button></div>`).join('')||'<p>No matching Pokémon.</p>'}</div></section><div class="grid-board">${shortlist.length?matrix():'<div class="empty">Add Pokémon from the picker to build your shortlist.</div>'}</div></div><p class="planner-legend"><b>⚑ ${limit}+ active Pokémon weak = highlighted row</b> · Orange: weak · Green: resists · Blue: immune · Gray: bench, excluded. Changes show +/− versus your previous selection. Type-only; abilities, items and field effects can change the matchup.</p></section><details class="panel saved-plans"><summary>Saved teams (${state.plans.length})</summary>${activePlan?'<button class="quiet" data-action="new-plan">Save as a new team instead</button>':''}${state.plans.map(p=>`<div class="saved-plan"><strong>${esc(p.name)}</strong><small>${p.memberIds.length} active · ${(p.shortlistIds||p.memberIds).length} shortlisted</small><button class="quiet mini" data-action="load-plan" data-id="${esc(p.id)}">Load</button><button class="danger mini" data-action="delete-plan" data-id="${esc(p.id)}">Delete</button></div>`).join('')||'<p>Save your active team and its shortlist together.</p>'}</details><details class="panel"><summary>Bench suggestions & Pokédex reference</summary><p>Suggestions use the active team. Add any candidate through the picker.</p><label class="check"><input id="hard" type="checkbox" ${hard?"checked":""}>Only suggest additions that stay below the threshold</label>${selected.length?candidates():''}<button class="quiet" data-action="catalog">${catalogMode?'Close Pokédex':'Explore Pokédex'}</button>${catalogMode?catalogView():''}</details>`;
}
function catalogView() {
  const filtered = catalog
    .filter((p) =>
      `${p.name} ${p.types.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 60);
  return `<section class="panel"><h3>Pokédex reference</h3><p>Species information only; these entries are not added to your owned collection. Uses the same search field. Showing up to 60 matches.</p><div class="table-wrap"><table><thead><tr><th>Species</th><th>Types</th><th>Owned</th><th>Base stats total</th></tr></thead><tbody>${filtered.map((p) => `<tr><td>${esc(p.name)}</td><td>${types(p.types)}</td><td>${owned().filter((o) => o.speciesId === p.speciesId).length || "—"}</td><td>${p.baseStats.reduce((n, v) => n + v, 0)}</td></tr>`).join("")}</tbody></table></div></section>`;
}
function attackMatches(ts, inv = inverse) {
  return owned()
    .map((p) => ({
      p,
      moves: p.moves.filter(
        (m) => hasOrdinaryTypeDamage(m) && multiplier(m.type, ts, inv) > 1,
      ),
    }))
    .filter((x) => x.moves.length)
    .sort((a, b) => b.p.level - a.p.level);
}
function prepare() {
  const matches = attackMatches(opponent),
    full = state.context.spoilerMode === "full";
  return (
    head(
      "A little preparation goes a long way",
      "Ready for the next fight?",
      "Start with a matchup you know. Find useful attacks in your own collection.",
    ) +
    `<section class="panel"><h2>Matchup workbench</h2><div class="toolbar"><label>Opponent primary type<select id="opp1">${opts(TYPES, opponent[0])}</select></label><label>Secondary type<select id="opp2">${opts(["none", ...TYPES], opponent[1] || "none")}</select></label><label>Rules<select id="inverse"><option value="false" ${!inverse ? "selected" : ""}>Standard</option><option value="true" ${inverse ? "selected" : ""}>Inverse</option></select></label></div><p>Known damaging moves with a super-effective type matchup. This is not a damage calculation: levels, stats, abilities, items and battle effects still matter. Fixed-damage, retaliation and one-hit-KO moves are excluded from these type rankings.</p>${
      matches
        .slice(0, 18)
        .map(
          (x) =>
            `<div class="list-item"><div><strong>${esc(name(x.p))} <small>Lv. ${x.p.level}</small></strong><p>${x.moves.map((m) => `${esc(m.name)} · ${multiplier(m.type, opponent, inverse)}× · ${m.pp ?? "—"}/${m.maxPp ?? "—"} PP`).join(" · ")}</p></div><button class="quiet" data-action="detail" data-id="${esc(x.p.id)}">Inspect</button></div>`,
        )
        .join("") ||
      "<p>No confirmed matching attacks found. Moves without validated type/category metadata are excluded; this does not establish that your team lacks coverage.</p>"
    }</section><section class="panel"><h2>Your five-minute checklist</h2><div class="insight">Save in-game, then sync. Check the snapshot time before relying on a build.</div>${opportunities(
      team().length ? team() : state.snapshot?.party || [],
      state.context.levelCap,
    )
      .slice(0, 4)
      .map((o) => `<div class="insight">${esc(o.text)}</div>`)
      .join(
        "",
      )}<div class="insight">Confirm your opponent’s rules in-game. Bring healing and status recovery appropriate to the fight.</div></section><section class="panel"><h2>Gym & story notebook</h2>${full ? `<div class="banner">Legacy reference from your previous Team Lab. Teams, levels, gimmicks and tips have not been verified for this save’s version or difficulty. This is not detected story progress.</div><label>Notebook<select id="battle-group">${opts(["gym", "story"], battleGroup)}</select></label>${(battleGroup === "gym" ? GYM_BATTLES : STORY_BATTLES).map((b) => `<details class="battle"><summary>${esc(b.name)} · ${esc(b.location)} <small>Unverified reference</small></summary><p>${esc(b.gimmick)} · Reference levels ${esc(b.level)}</p><div class="row">${b.team.map((f) => `<span class="pill">${esc(f.name)} · ${esc(f.types.join("/"))}</span>`).join("")}</div><p>${b.tips.map(esc).join("<br>")}</p><button class="quiet" data-action="battle" data-id="${esc(b.id)}">Explore primary focus type</button></details>`).join("")}` : '<p>Hints mode keeps future opponent names, teams and story details hidden. Use the matchup workbench with information you’ve discovered in-game.</p><a class="text-link" href="#settings">Change spoiler preference →</a>'}</section>`
  );
}
function diff(a, b) {
  const old = [...b.party, ...b.boxes.flatMap((x) => x.pokemon)],
    current = [...a.party, ...a.boxes.flatMap((x) => x.pokemon)],
    lines = [];
  for (const p of current) {
    const prev = old.find((x) => x.id === p.id);
    if (!prev)
      lines.push(
        `${name(p)} is present in the selected snapshot and absent from the comparison snapshot.`,
      );
    else {
      if (p.level !== prev.level)
        lines.push(`${name(p)}: level ${prev.level} → ${p.level}.`);
      if (
        p.moves.map((m) => m.id).join() !== prev.moves.map((m) => m.id).join()
      )
        lines.push(
          `${name(p)}: moves changed to ${p.moves.map((m) => m.name).join(", ")}.`,
        );
      if (p.item !== prev.item)
        lines.push(
          `${name(p)}: item ${prev.item || "none"} → ${p.item || "none"}.`,
        );
    }
  }
  for (const p of old)
    if (!current.some((x) => x.id === p.id))
      lines.push(`${name(p)} is absent from the selected snapshot.`);
  return lines;
}
function journey() {
  return (
    head(
      "Every save is a stepping stone",
      "Your adventure journal",
      "A record of observed snapshots and the notes you leave along the way.",
    ) +
    `<div class="grid split"><section><div class="panel"><h2>Snapshot archive</h2>${state.snapshots.map((s) => `<div class="list-item"><div><strong>${when(s.capturedAt)}</strong> <span class="pill">${esc(s.status)}</span><p>${esc((s.partyNames || []).join(", "))}</p>${s.error ? `<p class="gold">${esc(s.error)}</p>` : ""}</div>${s.status === "ready" ? `<button class="quiet" data-action="compare" data-id="${esc(s.id)}">Compare</button>` : ""}</div>`).join("") || "<p>Your first upload will appear here.</p>"}</div>${
      compare
        ? `<section class="panel"><h2>Latest snapshot vs. ${when(compare.capturedAt)}</h2><p>Identity matching is provisional. Differences describe the save contents, not necessarily catches, releases, or a chronological play session.</p>${
            diff(state.snapshot, compare)
              .map((l) => `<div class="insight">${esc(l)}</div>`)
              .join("") ||
            "<p>No level, item, move, or collection differences found.</p>"
          }</section>`
        : ""
    }<div class="panel"><h2>Observed changes</h2><div class="timeline">${state.events.map((e) => `<article><small>${when(e.createdAt)}</small><p>${esc(e.text)}</p></article>`).join("") || "<p>Changes between processed snapshots will appear here.</p>"}</div></div></section><section class="panel"><h2>Leave yourself a note</h2><form id="note-form"><label>What should you remember?<textarea name="text" required maxlength="2000" placeholder="Next session: explore that route, try this lead…"></textarea></label><button style="margin-top:12px">Save note</button></form>${state.notes.map((n) => `<div class="insight"><small>${when(n.createdAt)}</small><p style="white-space:pre-wrap">${esc(n.text)}</p></div>`).join("")}</section></div>`
  );
}
function settings() {
  const c = state.context;
  return (
    head(
      "Quietly connected",
      "Keep your Pokédex in touch",
      "Link your Retroid, set your context, and let snapshots find their way home.",
    ) +
    `<div class="grid split"><section><div class="panel"><h2>Connect your Retroid</h2><p>Generate a one-time code, then enter it in the Borrius save courier on your Retroid. The device receives an upload-only credential. It cannot change your game.</p><button data-action="pair">Generate pairing code</button>${pair ? `<div class="pair-code">${esc(pair.code)}</div><p>Expires ${when(pair.expiresAt)}. Enter this server address in the courier:</p><input aria-label="Upload server address" readonly value="${esc(pair.uploadUrl)}" style="width:100%">` : ""}<h3 style="margin-top:26px">Linked devices</h3>${state.devices.map((d) => `<div class="list-item"><div><strong>${esc(d.name)}</strong><p>${d.revokedAt ? "Revoked " + when(d.revokedAt) : "Last seen " + when(d.lastSeenAt)}</p></div>${!d.revokedAt ? `<button class="danger" data-action="revoke" data-id="${esc(d.id)}">Revoke</button>` : ""}</div>`).join("") || "<p>No devices paired yet.</p>"}<p><small>Android periodic sync is best-effort and can be delayed. Save in-game before syncing. Emulator save states are not imported.</small></p></div><div class="panel"><h2>Import a save</h2><p>Upload a copy of your cartridge save. The original file remains unchanged.</p><form id="import-form"><label>Game version<select name="version"><option>2.1.1.1</option></select></label><label style="margin:15px 0">Cartridge save (.srm or .sav)<input type="file" name="save" accept=".srm,.sav" required></label><button>Import snapshot</button></form></div></section><section class="panel"><h2>Playthrough context</h2><p>These settings are confirmed by you. Difficulty, exact location and level cap are not reliably detected from the save.</p><form id="context-form" class="grid form-grid"><label>Difficulty<select name="difficulty">${opts(["unknown", "Vanilla", "Difficult", "Expert", "Insane"], c.difficulty)}</select></label><label>Confirmed level cap<input name="levelCap" type="number" min="1" max="100" value="${esc(c.levelCap ?? "")}" placeholder="Unknown"></label><label style="grid-column:1/-1">Current objective / checkpoint<input name="checkpoint" maxlength="200" value="${esc(c.checkpoint)}" placeholder="Where are you headed next?"></label><label style="grid-column:1/-1">Spoilers<select name="spoilerMode"><option value="hints" ${c.spoilerMode === "hints" ? "selected" : ""}>Hints — hide future boss details</option><option value="full" ${c.spoilerMode === "full" ? "selected" : ""}>Full — default to detailed battle scouting</option></select></label><button>Save context</button></form></section></div>`
  );
}
function render() {
  const gridScroll=$('.planning-scroll')?.scrollLeft||0, gridY=$('.planning-scroll')?.scrollTop||0, pickerY=$('.picker-list')?.scrollTop||0;
  const focus=document.activeElement?.dataset;

  view = ["today", "lab", "prepare", "journey", "settings", "dex", "types"].includes(view)
    ? view
    : "today";
  document.querySelectorAll("nav a").forEach((a) => {
    const active = a.hash === "#" + view;
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  $("#status").innerHTML =
    `<span class="light"></span>${state.snapshot ? `Last snapshot ${esc(age(state.snapshot.capturedAt))} · ${esc(state.snapshot.gameVersion)}` : "Awaiting your first save"}`;
  document.body.classList.toggle("planner-focus",view==="lab"&&focusBoard);
  $("#content").dataset.view = view;
  if(toolCleanup){toolCleanup();toolCleanup=null;}
  const toolProps={owned:owned(),active:team()};
  if(view==='dex')toolCleanup=mountDex($('#content'),toolProps);
  else if(view==='types')toolCleanup=mountTypeTools($('#content'),toolProps);
  else if(view==='prepare')toolCleanup=mountBattlePrep($('#content'),{...toolProps,party:state.snapshot?.party||[],shortlist:[...shortlist],context:state.context,
    onInspect:detail,
    onSaveContext:async patch=>{state.context=await api('/context','PUT',{...state.context,...patch});},
    onShortlist:id=>{if(!shortlist.includes(id)){if(shortlist.length>=24)throw Error('The planning board has 24 candidates. Remove one there first.');shortlist.push(id);}try{localStorage.setItem('borrius-planner',JSON.stringify({shortlist,selected,inverse,limit,name:draftName,activePlan}));}catch{}}
  });
  else $('#content').innerHTML = { today, lab, journey, settings }[view]();
  if(view==='lab') {
    if($('.planning-scroll')){$('.planning-scroll').scrollLeft=gridScroll;$('.planning-scroll').scrollTop=gridY;}
    if($('.picker-list'))$('.picker-list').scrollTop=pickerY;
    if(focus?.action && focus?.id) [...document.querySelectorAll('[data-action]')].find(b=>b.dataset.action===focus.action&&b.dataset.id===focus.id)?.focus({preventScroll:true});
    try{localStorage.setItem('borrius-planner',JSON.stringify({shortlist,selected,inverse,limit,name:draftName,activePlan}));}catch{}
  }
  document.title = `${{ today: "Today", lab: "The Pokémon workshop", prepare: "Prepare", journey: "Journey", settings: "Connection", dex:"Pokédex", types:"Type Desk" }[view]} · Borrius`;
}
function detail(id) {
  const p = owned().find((p) => p.id === id);
  if (!p) return;
  $("#detail-content").innerHTML =
    `<div class="detail-portrait" aria-hidden="true">${portrait(p)}</div><div class="eyebrow">${p.location.kind === "party" ? "Current party" : "Box " + p.location.box} · identity ${esc(p.identityConfidence)}</div><h1>${esc(p.nickname || p.name)}</h1><p>${esc(p.name)} · Level ${p.level} · ${esc(p.nature)} nature</p><div class="types">${types(p.types)}</div><div class="stats"><div>Ability<strong>${esc(p.ability)}</strong></div><div>Held item<strong>${esc(p.item || "None")}</strong></div><div>HP<strong>${p.hp ? `${p.hp.current} / ${p.hp.max}` : "Not stored"}</strong></div></div><button class="quiet" data-action="favorite" data-id="${esc(p.id)}">${state.context.favorites.includes(p.id) ? "★ Remove favorite" : "☆ Keep as favorite"}</button><h2 style="margin-top:24px">Known moves</h2><div class="table-wrap"><table><thead><tr><th>Move</th><th>Type</th><th>Category</th><th>Power</th><th>Accuracy</th><th>PP</th></tr></thead><tbody>${p.moves.map((m) => `<tr><td>${esc(m.name)}</td><td>${types(m.type ? [m.type] : []) || "Unknown"}</td><td>${esc(m.category)}</td><td>${m.power ?? "—"}</td><td>${m.accuracy ?? "—"}</td><td>${m.pp ?? "—"}/${m.maxPp ?? "—"}</td></tr>`).join("")}</tbody></table></div><h2 style="margin-top:24px">Build details</h2><div class="table-wrap"><table><thead><tr><th>Stat</th><th>Current</th><th>IV</th><th>EV</th></tr></thead><tbody>${[...new Set([...Object.keys(p.ivs), ...Object.keys(p.stats || {})])].map((k) => `<tr><th>${esc(k)}</th><td>${p.stats?.[k] ?? "—"}</td><td>${p.ivs[k] ?? "—"}</td><td>${p.evs[k] ?? "—"}</td></tr>`).join("")}</tbody></table></div><p>Stored snapshot values. Box battle stats may be unavailable. Type matchup analysis does not simulate ability or item effects.</p>`;
  if (!$("#detail").open) $("#detail").showModal();
}
$("#detail .close").onclick = () => $("#detail").close();
$("#detail").addEventListener("click", (e) => {
  if (e.target === $("#detail")) $("#detail").close();
});
$("#refresh").onclick = () => refresh();
window.addEventListener("hashchange", () => {
  view = location.hash.slice(1);
  render();
  window.scrollTo(0, 0);
});
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const action = b.dataset.action,
    id = b.dataset.id;
  try {
    if (action === "refresh") return refresh();
    if (action === "detail") return detail(id);
    if (['activate','party'].includes(action)) lastCounts=Object.fromEntries(exposure(planningRoster(),selected,inverse,limit).map(r=>[r.type,r.count]));
    if(action==='shortlist') {
      if(shortlist.length>=24)return notify('The board holds 24 candidates. Remove one with × to make room.');
      if(!shortlist.includes(id))shortlist.push(id);
      plannerMessage='Candidate added to the bench. Activate or swap them in from their column.';
    }
    if(action==='focus-board')focusBoard=!focusBoard;
    if(action==='cancel-swap')swapIn=null;
    if(action==='activate') {
      if(swapIn===id)swapIn=null;
      else if(swapIn&&selected.includes(id)){selected=toggleActive(selected,id,swapIn);plannerMessage='Swap complete. Counts show the change from your previous team.';swapIn=null;}
      else if(!selected.includes(id)&&selected.length===6){swapIn=id;}
      else {selected=toggleActive(selected,id);swapIn=null;plannerMessage='Team updated. Only active columns count.';}
    }
    if(action==='unlist') {lastCounts=Object.fromEntries(exposure(planningRoster(),selected,inverse,limit).map(r=>[r.type,r.count]));shortlist=shortlist.filter(x=>x!==id);selected=selected.filter(x=>x!==id);if(swapIn===id)swapIn=null;}
    if (action === "select") {
      if (selected.includes(id)) selected = selected.filter((x) => x !== id);
      else if (selected.length < 6) selected.push(id);
      else return notify("A plan can have up to six Pokémon. Bench one first.");
    }
    if (action === "party") {
      selected = state.snapshot.party.map((p) => p.id);
      shortlist=[...new Set([...selected,...shortlist])].slice(0,24);swapIn=null;activePlan = null;draftName="";
    }
    if (action === "left" || action === "right") {
      const i = shortlist.indexOf(id),
        j = i + (action === "left" ? -1 : 1);
      if (j >= 0 && j < shortlist.length)
        [shortlist[i], shortlist[j]] = [shortlist[j], shortlist[i]];
    }
    if (action === "page-prev")
      collectionPage = Math.max(0, collectionPage - 1);
    if (action === "page-next") collectionPage++;
    if (action === "new-plan") activePlan = null;
    if (action === "load-plan") {
      const p = state.plans.find((p) => p.id === id);
      selected = p.memberIds.filter((id) => owned().some((p) => p.id === id));
      shortlist=[...new Set([...(p.shortlistIds||p.memberIds),...selected])].filter(id=>owned().some(p=>p.id===id));swapIn=null;lastCounts=null;draftName=p.name;
      inverse = p.inverse;
      limit = Math.max(1,p.weaknessLimit);
      hard = p.hardLimit;
      activePlan = id;
      if (selected.length !== p.memberIds.length)
        notify(
          "Some plan members are absent from this snapshot; available members were loaded.",
        );
    }
    if (action === "delete-plan") {
      await api("/plans/" + encodeURIComponent(id), "DELETE");
      if (activePlan === id) activePlan = null;
      await refresh(true);
      return;
    }
    if (action === "catalog") {
      catalogMode = !catalogMode;
      if (catalogMode && !catalog.length)
        catalog = (await api("/catalog")).species;
    }
    if (action === "favorite") {
      const favorites = state.context.favorites.includes(id)
        ? state.context.favorites.filter((x) => x !== id)
        : [...state.context.favorites, id];
      state.context = await api("/context", "PUT", {
        ...state.context,
        favorites,
      });
      render();
      return detail(id);
    }
    if (action === "pair") {
      b.disabled = true;
      pair = await api("/pairings", "POST", {});
    }
    if (action === "revoke") {
      b.disabled = true;
      await api("/devices/" + encodeURIComponent(id) + "/revoke", "POST", {});
      await refresh(true);
      return notify("Device upload access revoked.");
    }
    if (action === "compare") {
      compare = await api("/snapshots/" + encodeURIComponent(id));
    }
    if (action === "battle") {
      const battle = [...GYM_BATTLES, ...STORY_BATTLES].find(
        (b) => b.id === id,
      );
      opponent = [battle.focus[0]];
      inverse = !!battle.inverse;
      window.scrollTo(0, 0);
    }
    render();
  } catch (e) {
    b.disabled = false;
    notify(e.message);
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "scope") {
    scope = e.target.value;
    collectionPage = 0;
  } else if (e.target.id === "inverse") {inverse = e.target.value === "true";lastCounts=null;swapIn=null;}
  else if (e.target.id === "limit") limit = Number(e.target.value);
  else if (e.target.id === "hard") hard = e.target.checked;
  else if (e.target.id === "opp1")
    opponent = [
      e.target.value,
      ...(opponent[1] && opponent[1] !== e.target.value ? [opponent[1]] : []),
    ];
  else if (e.target.id === "opp2")
    opponent = [
      opponent[0],
      ...(e.target.value !== "none" && e.target.value !== opponent[0]
        ? [e.target.value]
        : []),
    ];
  else if (e.target.id === "battle-group") battleGroup = e.target.value;
  else return;
  render();
});
let searchTimer;
document.addEventListener("input", (e) => {
  if(e.target.name==="name" && e.target.closest("#plan-form")){draftName=e.target.value;return;}
  if (e.target.id !== "search") return;
  query = e.target.value;
  collectionPage = 0;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const start = e.target.selectionStart;
    render();
    $("#search")?.focus();
    $("#search")?.setSelectionRange(start, start);
  }, 170);
});
document.addEventListener("submit", async (e) => {
  const form = e.target;
  if (
    !["plan-form", "context-form", "note-form", "import-form"].includes(form.id)
  )
    return;
  e.preventDefault();
  const b = form.querySelector("button");
  b.disabled = true;
  const f = new FormData(form);
  try {
    if (form.id === "plan-form") {
      const p = await api("/plans", "POST", {
        ...(activePlan ? { id: activePlan } : {}),
        name: f.get("name"),
        memberIds: selected,
        shortlistIds: shortlist,
        inverse,
        weaknessLimit: limit,
        hardLimit: hard,
      });
      activePlan = p.id;
    }
    if (form.id === "context-form")
      await api("/context", "PUT", {
        ...state.context,
        ...state.context,
        difficulty: f.get("difficulty"),
        levelCap: f.get("levelCap") ? Number(f.get("levelCap")) : null,
        checkpoint: f.get("checkpoint"),
        spoilerMode: f.get("spoilerMode"),
      });
    if (form.id === "note-form")
      await api("/notes", "POST", {
        text: f.get("text"),
        snapshotId: state.snapshot?.id,
      });
    if (form.id === "import-form") {
      const file = f.get("save");
      if (!file?.size) throw Error("Choose a cartridge save file.");
      if (file.size > 1048576)
        throw Error(
          "This file is too large for a cartridge save. Choose the .srm or .sav file.",
        );
      const receipt = await api(
        "/import",
        "POST",
        await file.arrayBuffer(),
        true,
        file.name,
      );
      if (receipt.status === "failed")
        throw Error(receipt.error || "The save could not be parsed.");
      notify(
        receipt.status === "ready"
          ? "Snapshot imported."
          : "Save uploaded. Processing will appear in Journey; the page refreshes automatically.",
      );
    }
    await refresh(true);
    if (form.id !== "import-form") notify("Saved.");
  } catch (err) {
    notify(err.message);
    b.disabled = false;
  }
});
refresh(true);
setInterval(() => {
  if (
    !["dex","types","prepare"].includes(view) &&
    !document.hidden &&
    !$("#detail").open &&
    !document.activeElement?.matches("input,textarea,select")
  )
    refresh(true);
}, 60000);
