# Implementation contracts

Build new independent Cloudflare-owned app in app/ (NOT companion-app; preserve original).
Worker API base is dashboard origin for browser, separate upload origin for Android.
Human routes require owner Cloudflare Access JWT in production; upload host exposes only device pair/upload/receipt.
JSON errors: {error:string}. Dates ISO UTC.
POST /api/pairings (browser) -> {code,expiresAt,uploadUrl}; POST /api/device/pair {code,name} -> {deviceId,token,uploadUrl}; code one-use 10min, token revocable upload-only.
POST /api/device/upload raw application/octet-stream, Authorization Bearer token, X-Capture-Id UUID, X-Captured-At ISO, X-Device-Sequence integer, X-Save-Name UTF8 URI-encoded filename, X-Game-Version '2.1.1.1'. -> {id,status:'pending'|'ready'|'failed',duplicate:boolean}; GET /api/device/receipts/:id -> {id,status,error?} only own.
Browser GET /api/state -> {snapshot:Snapshot|null, snapshots:SnapshotSummary[],devices:Device[],plans:Plan[],context:Context,events:Event[],notes:Note[]}
GET /api/snapshots/:id -> Snapshot; POST /api/import (browser raw bytes same capture headers optional) -> receipt. POST /api/plans {id?,name,memberIds:string[],inverse:boolean,weaknessLimit:number,hardLimit:boolean} -> Plan; DELETE /api/plans/:id.
PUT /api/context {difficulty:'unknown'|'Vanilla'|'Difficult'|'Expert'|'Insane',levelCap:number|null,checkpoint:string,spoilerMode:'hints'|'full',favorites:string[]} -> Context.
POST /api/notes {text,snapshotId?} -> Note; POST /api/devices/:id/revoke -> {ok:true}.
GET /api/catalog -> {species:CatalogSpecies[]} may be public only on authenticated dashboard. Parser agent exports catalog as getCatalog().
Snapshot {id,capturedAt,receivedAt,hash,filename,parserVersion,gameVersion:'2.1.1.1',party:Pokemon[],boxes:{box:number,pokemon:Pokemon[]}[],progress:Progress,warnings:string[]}
Pokemon {id:string,identityConfidence:'candidate'|'ambiguous',speciesId:number,dexId:number|null,name:string,nickname:string,level:number,types:string[],nature:string,ability:string,item:string,moves:Move[],ivs:Record<string,number>,evs:Record<string,number>,stats:Record<string,number>|null,hp:{current:number,max:number}|null,location:{kind:'party'|'box',box?:number,slot:number},baseStats:number[]}
Move {id:number,name:string,type:string|null,power:number|null,accuracy:number|null,category:'physical'|'special'|'status'|'unknown',pp:number,maxPp:number}
Progress {badges:number|null,isChampion:boolean|null,money:number|null,heartScales:number|null,ownedTms:string[],provenance:'experimental',difficulty:null,levelCap:null}; unsupported unknown, never invented caps.
SnapshotSummary {id,capturedAt,receivedAt,status,partyNames:string[],boxCount:number,error?:string}
Device {id,name,createdAt,lastSeenAt,revokedAt}; Plan {id,name,memberIds,inverse,weaknessLimit,hardLimit,updatedAt}; Context as above; Event {id,snapshotId,kind,text,createdAt}; Note {id,text,snapshotId,createdAt}.
Parser module app/src/parser/index.ts exports parseSave(Uint8Array,{gameVersion='2.1.1.1'}={}) returning {party,boxes,progress,warnings,parserVersion,gameVersion}, getCatalog() -> {species:[{speciesId,dexId,name,types,baseStats}]}.
The Cloudflare service lives in app/src/server, client features in app/src/client, and shared game contracts in app/src/shared. The read-only parser lives in app/src/parser; upstream/generated data is isolated in app/src/vendor with explicit TypeScript declarations. Android source remains in android/.

## Planning board update

Plans optionally accept `shortlistIds`: up to 24 unique Pokémon IDs, containing every `memberIds` entry. The active `memberIds` list still allows at most six. Existing plans without a shortlist load their active members as the shortlist. Both are stored in the existing plan JSON; no database migration is required.

The UI threshold is explicitly inclusive: “3+ weak” highlights a row at count >= 3. Counts use only active members; benched columns remain visible in gray. Full-team swaps replace one selected ID in a single transition. Draft active selections/shortlist are retained locally; Save/Update plan persists them to the owner account. Focus mode fits ten candidates and eighteen type rows at 1280×720. Smaller screens scroll the grid horizontally while type/count columns remain pinned.


## Battle preparation and native reference tools

Context supports nextBattleId (string or null) and fightReveal (types, team, full). Older context writes preserve these fields. Next fight and difficulty are manually confirmed, not detected from the save. Battle module matches exact difficulty variants; unavailable entries do not borrow another mode's roster.

New routes: #prepare (sourced gym/major-battle planning), #dex (local Unbound reference data), #types (native type calculator). Tool mounts clean up their event listeners on navigation. Background refresh does not interrupt these tools; explicit Refresh reloads the latest save.

Battle calculations use known ordinary damaging moves with nonzero/unknown PP, sourced roster typing and selected documented field restrictions. Full details add source sets and incoming move-type checks. Ability/item/damage/turn-order simulation is not claimed. Camomons applies first two move types on both sides; unsupported typing remains unknown. See battle-sources.md, dex-sources.md, and type-tools.md for provenance.
