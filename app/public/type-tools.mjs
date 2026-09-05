import { TYPES, multiplier, hasOrdinaryTypeDamage } from './domain.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title = type => type[0].toUpperCase() + type.slice(1);
export function cleanTypes(types, max = 4) {
  return [...new Set((types || []).map(t => String(t).toLowerCase()).filter(t => TYPES.includes(t)))].slice(0,max);
}
export function defenseProfile(types, inverse = false) {
  const chosen = cleanTypes(types, 2);
  return chosen.length ? TYPES.map(type => ({types:[type], value:multiplier(type, chosen, inverse)})) : [];
}
export function defenderCombinations(includeDual = false) {
  return TYPES.flatMap((type, i) => [[type], ...(includeDual ? TYPES.slice(i+1).map(other => [type, other]) : [])]);
}
export function offenseProfile(types, inverse = false, includeDual = false) {
  const chosen = cleanTypes(types);
  return chosen.length ? defenderCombinations(includeDual).map(defenders => {
    const matches = chosen.map(type => ({type, value:multiplier(type, defenders, inverse)}));
    const value = Math.max(...matches.map(m => m.value));
    return {types:defenders, value, best:matches.filter(m => m.value === value).map(m => m.type)};
  }) : [];
}
const display = value => ({0:'0×',0.25:'¼×',0.5:'½×',1:'1×',2:'2×',4:'4×'}[value] || `${value}×`);
const badge = type => `<span class="type ${type}">${title(type)}</span>`;

/** Independent client-only tool. Returns a listener cleanup function. */
export function mountTypeTools(container, {owned = [], active = []} = {}) {
  const activeIds = new Set(active.map(p => typeof p === 'string' ? p : p.id));
  const roster = [...owned].sort((a,b) => Number(activeIds.has(b.id)) - Number(activeIds.has(a.id)) || String(a.name).localeCompare(String(b.name)));
  const first = roster.find(p => activeIds.has(p.id));
  const state = {mode:'defense', defense:cleanTypes(first?.types || ['normal'],2), offense:['ice'], inverse:false, dual:false, selected:first?.id || '', notice:''};
  function results() {
    const defensive = state.mode === 'defense';
    const profile = defensive ? defenseProfile(state.defense,state.inverse) : offenseProfile(state.offense,state.inverse,state.dual);
    if (!profile.length) return '<p class="tt-empty">Choose a type to see matchups.</p>';
    const labels = defensive ? {4:'Major weaknesses',2:'Weaknesses',1:'Neutral',0.5:'Resistances',0.25:'Double resistances',0:'Immunities'} : {4:'Best hit: 4×',2:'Best hit: 2×',1:'Best hit: neutral',0.5:'Coverage gaps: resisted',0.25:'Coverage gaps: doubly resisted',0:'Coverage gaps: immune'};
    const weak = profile.filter(p => p.value > 1).length;
    return `<p class="tt-summary" role="status">${defensive ? `<strong>${weak}</strong> attacking types hit super-effectively` : `<strong>${weak} / ${profile.length}</strong> defender typings hit super-effectively`} · ${state.inverse?'Inverse':'Standard'} rules</p><div class="tt-results">${[4,2,0.5,0.25,0,1].map(value => {
      const rows = profile.filter(p => p.value === value);
      if (!rows.length) return '';
      return `<details class="tt-bucket tt-value-${String(value).replace('.','_')}" ${value !== 1?'open':''}><summary><span>${labels[value]}</span><span>${display(value)} · ${rows.length}</span></summary><div class="tt-matchups">${rows.map(row => `<div class="tt-matchup">${row.types.map(badge).join('<span class="tt-divider">/</span>')}${!defensive ? `<small>via ${row.best.map(title).join(' / ')}</small>`:''}</div>`).join('')}</div></details>`;
    }).join('')}</div>`;
  }
  function render(focus) {
    const defensive = state.mode === 'defense';
    const chosen = defensive ? state.defense : state.offense;
    container.innerHTML = `<section class="type-tools"><div class="eyebrow">THE TRAINER’S TYPE DESK</div><h1>Know your matchups.</h1><p class="tt-intro">Try a Pokémon’s typing or a set of attacking types. See weaknesses, resistances, and gaps before the next fight.</p><div class="tt-layout"><section class="panel tt-controls" aria-label="Type calculator controls"><div class="tt-mode" role="group" aria-label="Calculator mode"><button data-tt="mode" data-value="defense" aria-pressed="${defensive}">Defend</button><button data-tt="mode" data-value="offense" aria-pressed="${!defensive}">Attack coverage</button></div><label class="tt-rules">Battle rules<select data-tt="rules"><option value="standard" ${!state.inverse?'selected':''}>Standard</option><option value="inverse" ${state.inverse?'selected':''}>Inverse</option></select></label><h2>${defensive?'What are you defending with?':'Which attacking types?'}</h2><p>${defensive?'Choose one or two types. A third replaces the second.':'Choose up to four move types. Each defender uses your best available hit.'}</p><label>Use an owned Pokémon<select data-tt="owned"><option value="">Choose from your collection…</option>${roster.map(p => `<option value="${esc(p.id)}" ${state.selected===p.id?'selected':''}>${activeIds.has(p.id)?'★ ':''}${esc(p.nickname || p.name)}${p.nickname&&p.nickname!==p.name?' ('+esc(p.name)+')':''} · Lv. ${esc(p.level)} · ${cleanTypes(p.types,2).map(title).join('/')}</option>`).join('')}</select></label><small>★ Active planning team${defensive?'':' · Imports known damaging move types'}.</small><div class="tt-chips" role="group" aria-label="${defensive?'Defender types':'Attacking move types'}">${TYPES.map(type => `<button class="tt-chip ${type}" data-tt="type" data-value="${type}" aria-pressed="${chosen.includes(type)}" ${!defensive && chosen.length===4 && !chosen.includes(type)?'disabled':''}><span aria-hidden="true">${chosen.includes(type)?'✓':'+'}</span>${title(type)}</button>`).join('')}</div><div class="tt-selection">${chosen.length?chosen.map(badge).join(' '):'No types selected'}<button class="quiet mini" data-tt="clear">Clear</button></div>${!defensive?`<label class="check tt-dual"><input data-tt="dual" type="checkbox" ${state.dual?'checked':''}>Include every dual-type combination</label><small>${state.dual?'171 hypothetical single/dual typings, including combinations without a species.':'18 single types. Enable dual types to reveal compounded weaknesses and resistances.'}</small>`:''}<p class="tt-notice" role="status">${esc(state.notice)}</p></section><section class="panel tt-output" aria-label="Type effectiveness results">${results()}</section></div><p class="tt-footnote">Type effectiveness only: abilities, items, weather, special fight rules, move-specific effects, stats and damage are not calculated. Inverse rules flip each individual matchup before combining dual types. This tool does not change your team or save.</p><p class="tt-credit">Inspired by <a href="https://www.pkmn.help/defense/solo/" target="_blank" rel="noopener noreferrer">PKMN.help’s type calculator ↗</a>.</p></section>`;
    if (focus) container.querySelector(focus)?.focus({preventScroll:true});
  }
  function handle(event) {
    const target = event.target.closest('[data-tt]');
    if (!target || !container.contains(target)) return;
    const action = target.dataset.tt;
    if ((['rules','owned','dual'].includes(action)) !== (event.type === 'change')) return;
    state.notice = '';
    const key = state.mode === 'defense' ? 'defense' : 'offense';
    if (action === 'mode') {state.mode = target.dataset.value; state.selected = '';}
    if (action === 'rules') state.inverse = target.value === 'inverse';
    if (action === 'dual') state.dual = target.checked;
    if (action === 'clear') {state[key] = []; state.selected = '';}
    if (action === 'type') {
      const value = target.dataset.value;
      if (state[key].includes(value)) state[key] = state[key].filter(t => t !== value);
      else if (key === 'defense' && state[key].length === 2) state[key] = [state[key][0],value];
      else if (state[key].length < (key === 'defense'?2:4)) state[key].push(value);
      state.selected = '';
    }
    if (action === 'owned') {
      state.selected = target.value;
      const mon = roster.find(p => p.id === target.value);
      if (mon) {
        state[key] = key === 'defense' ? cleanTypes(mon.types,2) : cleanTypes((mon.moves || []).filter(hasOrdinaryTypeDamage).map(move => move.type));
        if (key === 'offense') state.notice = state[key].length ? 'Imported ordinary damaging move types; status and special-damage moves are excluded. Remaining PP is not considered.' : 'No ordinary damaging move types were available. Choose types manually.';
      }
    }
    const focus = `[data-tt="${action}"]${target.dataset.value?`[data-value="${target.dataset.value}"]`:''}`;
    render(focus);
  }
  container.addEventListener('click',handle);
  container.addEventListener('change',handle);
  render();
  return () => {container.removeEventListener('click',handle);container.removeEventListener('change',handle);};
}
