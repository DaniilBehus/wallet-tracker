'use strict';
// Reproduce the six explanatory maps in docs/analysis with Node built-ins only.
// Formal BPMN, Mermaid and UML assets are retained separately in formal/.
// Usage: node scripts/render-analysis-maps.js [--check] [model ...]
const fs=require('node:fs');
const path=require('node:path');
const OUT=path.resolve(__dirname,'../docs/analysis');
const C={bg:'#F7F4ED',ink:'#193039',muted:'#61747A',line:'#D6E1DE',teal:'#147C76',dark:'#0D625F',pale:'#E8F4F1',amber:'#B9761C',amberPale:'#FFF0D7',red:'#B64E47',redPale:'#FAEAE7',white:'#FFFFFF',soft:'#EFF2EF'};
const e=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const rect=(x,y,w,h,fill=C.white,stroke=C.line,r=20,sw=2)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const txt=(x,y,s,z=25,c=C.ink,b=400,a='start')=>`<text x="${x}" y="${y}" font-family="Segoe UI,Arial,sans-serif" font-size="${z}" font-weight="${b}" fill="${c}" text-anchor="${a}">${e(s)}</text>`;
const lines=(x,y,ss,z=24,g=36,c=C.ink,b=400)=>ss.map((s,i)=>txt(x,y+i*g,s,z,c,b)).join('');
const rule=(x1,y1,x2,y2,c=C.line,sw=2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${sw}"/>`;
const route=(d,c=C.teal,sw=3,arrow=true,dash=false)=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"${arrow?` marker-end="url(#${c===C.red?'arrRed':'arr'})"`:''}${dash?' stroke-dasharray="9 8"':''}/>`;
const pill=(x,y,w,s,fill=C.pale,color=C.dark)=>rect(x,y,w,42,fill,fill,21,0)+txt(x+w/2,y+28,s,21,color,700,'middle');
function svg(w,h,b){return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${C.teal}"/></marker><marker id="arrRed" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${C.red}"/></marker></defs>${rect(0,0,w,h,C.bg,C.bg,0,0)}${b}</svg>`;}
function chrome(n,v,title,subtitle,w,h){return rect(70,52,75,68,C.teal,C.teal,18,0)+txt(107,98,n,30,C.white,700,'middle')+txt(169,100,'WALLET  /  ANALYSIS MAP',22,C.dark,700)+txt(70,175,title,47,C.ink,700)+txt(70,218,subtitle,26,C.muted)+rule(70,247,w-70,247)+rule(70,h-73,w-70,h-73)+txt(70,h-37,'WALLET  /  MODULAR SERIES',20,C.muted,700)+txt(w-70,h-37,`${n} / 06`,20,C.muted,700,'end');}
function node(x,y,w,h,title,body=[],tone='normal'){
 const fill=tone==='amber'?C.amberPale:tone==='red'?C.redPale:tone==='teal'?C.pale:C.white;
 const accent=tone==='amber'?C.amber:tone==='red'?C.red:C.dark;
 return rect(x,y,w,h,fill,tone==='normal'?C.line:fill,20,tone==='normal'?2:0)+txt(x+22,y+43,title,27,accent,700)+lines(x+22,y+82,body,23,34,C.ink);
}
function band(x,y,w,title,fill=C.pale,color=C.dark){return rect(x,y,w,55,fill,fill,14,0)+txt(x+21,y+37,title,25,color,700);}
function label(x,y,s,color=C.muted){return rect(x-8,y-24,s.length*13+18,35,C.bg,C.bg,8,0)+txt(x,y,s,22,color,700);}

function moduleFrame(x,y,w,h,title,sub){return rect(x,y,w,h,C.white,C.line,24,2)+rect(x,y,w,65,C.pale,C.pale,24,0)+txt(x+24,y+43,title,27,C.dark,700)+txt(x+w-24,y+41,sub,21,C.muted,700,'end');}
function fourC(){
 const w=1800,h=2180;let b=chrome('04','C','Category limits · modular system map','Commands write independent records; a query builds and judges visible rows',w,h);
 b+=moduleFrame(70,292,760,658,'COMMANDS','WRITE');
 b+=moduleFrame(970,292,760,658,'PERSISTENCE','SQLITE');
 b+=node(100,392,700,120,'PATCH owned category',['Only limit field; 0 is real, NULL clears.']);
 b+=node(100,542,700,120,'Validate + check owner',['Empty / unknown PATCH → 400; foreign / missing → 404.']);
 b+=route('M450 512 V540');
 b+=node(100,693,700,120,'Record valid expense / paid instalment',['Independent action: limit is never a save gate.'],'teal');
 b+=node(1000,392,700,120,'Category limit L',['Current integer cents or NULL; no month history.'],'teal');
 b+=node(1000,693,700,120,'Actual expenses',['Valid payment saves even when category is exceeded.'],'teal');
 b+=route('M800 602 H900 V452 H998');b+=txt(855,584,'valid PATCH',21,C.dark,700);
 b+=route('M800 753 H998');b+=txt(855,738,'valid save',21,C.dark,700);
 b+=rect(100,842,700,72,C.redPale,C.redPale,15,0)+txt(122,888,'REFUSED PATCH → no category write',23,C.red,700)+route('M450 662 V675 H80 V878 H98',C.red,3,true);
 b+=moduleFrame(70,1060,760,650,'SUMMARY QUERY','READ');
 b+=moduleFrame(970,1060,760,650,'ROW JUDGEMENT','DERIVED');
 b+=node(100,1160,700,116,'GET selected month',['Standalone or after any successful write.'],'teal');
 b+=node(100,1307,700,133,'Aggregate T',['Saved expenses incl. paid instalments;','exclude unpaid instalments + income.']);
 b+=node(100,1471,700,170,'Visible rows',['Limited T = 0 included; unlimited T = 0 hidden.','Uncategorised only if T > 0; no limit editor.']);
 b+=route('M450 1276 V1305')+route('M450 1440 V1469');
 b+=route('M1360 950 V1000 H450 V1158',C.teal,3,true,true)+txt(780,1030,'read actuals + current L',21,C.muted,700);
 b+=node(1000,1160,700,145,'Current L vs actual T',['NULL = not_set; else compare per visible row.','Current limit applies to historical month.'],'teal');
 b+=route('M800 1555 H900 V1235 H998');
 const st=[['NOT SET','L = NULL',C.soft,C.muted],['WITHIN','T < L',C.pale,C.dark],['REACHED','T = L',C.amberPale,C.amber],['EXCEEDED','T > L',C.redPale,C.red]];
 st.forEach((s,i)=>{let x=1000+(i%2)*350,y=1350+Math.floor(i/2)*160;b+=rect(x,y,330,115,s[2],s[2],16,0)+txt(x+18,y+42,s[0],22,s[3],700)+txt(x+18,y+87,s[1],30,C.ink,700)});
 b+=route('M1360 1305 V1324 H1165 V1348',C.teal,3,true)+route('M1360 1324 H1515 V1348',C.teal,3,true)+route('M1360 1324 H1715 V1480 H1165 V1508',C.teal,3,true)+route('M1715 1480 H1515 V1508',C.teal,3,true);
 b+=rect(70,1770,1660,228,C.amberPale,C.amberPale,22,0)+txt(98,1819,'ATTACHED READ RULES',26,C.amber,700)+
   lines(98,1862,['Remaining = L − T is calculated, not stored. L = 0 and T = 0 is REACHED.','Overall and category limits are independent. A category state never rejects a valid save.'],24,42,C.ink);
 b+=route('M1360 1710 V1740 H900 V1768',C.teal,3,true);
 return svg(w,h,b);
}
function fiveC(){
 const w=1800,h=2190;let b=chrome('05','C','Draft → Save · modular system map','Three bounded modules connect draft generation, review and keyed persistence',w,h);
 b+=moduleFrame(70,292,760,732,'DRAFT GENERATION','NO EXPENSE WRITE');
 b+=moduleFrame(970,292,760,732,'REVIEW SESSION','USER CONTROL');
 b+=node(100,389,700,116,'1  Describe paid EUR expense',['Browser requests a draft.']);
 b+=node(100,540,700,149,'2  Preflight',['Input + reference date, enabled mode, live consent,','context, concurrency slot and quota.']);
 b+=node(100,724,700,125,'3  Extract',['Adapter: live provider or local demo fixture.']);
 b+=node(100,884,700,106,'4  Validate + normalize',['Usable output → 200 result.'],'teal');
 b+=route('M450 505 V538')+route('M450 689 V722')+route('M450 849 V882');
 b+=node(1000,389,700,129,'5  Review status',['ready / needs_input: editable; unsupported: unsaveable.'],'teal');
 b+=node(1000,551,700,142,'6  Correct or stop',['Correct needs_input before Save.','No implicit financial write.']);
 b+=node(1000,727,700,144,'7  Explicit Save',['User confirms valid fields, then POST transaction.'],'teal');
 b+=route('M800 937 H900 V454 H998')+route('M1350 518 V549')+route('M1350 693 V725');
 b+=rect(1000,906,700,84,C.amberPale,C.amberPale,15,0)+txt(1021,941,'Edit / cancel / navigate / sign out',22,C.amber,700)+txt(1021,973,'invalidates the draft; before Save: no expense.',22,C.ink);
 b+=rect(70,1062,1660,102,C.redPale,C.redPale,18,0)+txt(96,1104,'PRE-SAVE EXIT',24,C.red,700)+txt(96,1141,'Refusal or provider failure → fixed error; no expense. Quota may still be consumed.',23,C.ink);
 b+=route('M100 615 H45 V1110 H68',C.red,3,true,true)+route('M100 786 H45',C.red,3,false,true);
 b+=moduleFrame(70,1213,1660,840,'KEYED PERSISTENCE','EXPLICIT SAVE ONLY');
 b+=node(98,1322,475,177,'8  API payload gate',['Account-scoped key + canonical payload.','Bad shape → 400 before DB.'],'teal');
 b+=node(659,1322,475,177,'9  SQLite transaction',['BEGIN IMMEDIATE; look up','(user_id, key).'],'teal');
 b+=node(1220,1322,475,177,'10  Keyed result',['COMMIT or ROLLBACK; respond','with 201, 400 / 404 or 409.'],'teal');
 b+=route('M1350 1024 H1745 V1288 H335 V1320')+route('M573 1410 H657')+route('M1134 1410 H1218');
 const oc=[
  ['NEW / VALID',['Atomic expense + request','COMMIT → 201'],C.pale,C.dark],
  ['NEW / INVALID',['Bad date/category','ROLLBACK → 400 / 404'],C.redPale,C.red],
  ['EXISTING / SAME',['Expense exists: original 201','COMMIT; no insert or revert'],C.pale,C.dark],
  ['409 · ROLLBACK',['Same key, changed payload','Same payload, deleted original'],C.redPale,C.red]
 ];
 oc.forEach((a,i)=>{let x=98+i*400;b+=rect(x,1605,375,148,a[2],a[2],18,0)+txt(x+18,1645,a[0],23,a[3],700)+lines(x+18,1684,a[1],22,32,C.ink)});
 b+=route('M1457 1499 V1550 H286 V1603',C.teal,3,true)+route('M1457 1550 H686 V1603',C.teal,3,true)+route('M1457 1550 H1086 V1603',C.teal,3,true)+route('M1457 1550 H1486 V1603',C.teal,3,true);
 b+=rect(98,1833,1598,173,C.amberPale,C.amberPale,18,0)+txt(122,1877,'UNCERTAIN RESPONSE  ·  lost reply / 5xx / timeout',24,C.amber,700)+
   lines(122,1920,['Freeze the exact payload + key. Retry the SAME POST through the keyed lookup.','Retry may be the first insert if nothing committed; replay never creates a second row.'],23,34,C.ink);
 b+=route('M98 1900 H45 V1410 H96',C.teal,3,true,true);
 return svg(w,h,b);
}
function oneModular(){
 const w=1800,h=1790;let b=chrome('01','', 'What Wallet helps you do','Connected capabilities, not a required screen or payment sequence',w,h);
 b+=moduleFrame(600,292,600,172,'ACCOUNT ACCESS','REGISTER / SIGN IN');
 b+=txt(628,402,'Protects the personal records below.',25,C.ink);
 b+=moduleFrame(600,571,600,369,'EXPENSE LEDGER','LOCAL RECORDS');
 b+=node(630,665,540,177,'Record expenses',['Add, edit or delete a paid expense.','Amounts are stored in EUR cents.'],'teal');
 b+=moduleFrame(70,571,470,279,'CATEGORIES','GROUPING');
 b+=node(96,664,418,146,'Manage categories',['Create groups for expenses.','Set or clear category limits.']);
 b+=moduleFrame(1260,571,470,279,'SCHEDULES','PLANNING');
 b+=node(1286,664,418,146,'Manage schedules',['Recurring charges or finite loans.','Record paid instalments locally.']);
 b+=moduleFrame(70,1085,470,272,'BUDGETS','CURRENT LIMITS');
 b+=node(96,1177,418,143,'Set or clear limits',['Overall and category signals.','They do not block a valid save.']);
 b+=moduleFrame(600,1085,600,272,'MONTH REVIEW','READ TIME');
 b+=node(630,1177,540,143,'Review selected month',['Actual expenses, income and','category totals with limit states.'],'teal');
 b+=moduleFrame(1260,1085,470,272,'OPTIONAL AI DRAFT','SUGGESTION');
 b+=node(1286,1166,418,171,'Review, then Save',['Demo or live draft.','Review suggested fields.','Explicit Save writes an expense.'],'amber');
 b+=route('M900 464 V569',C.teal,3,true,true)+label(920,532,'AUTHENTICATED');
 b+=route('M540 754 H598',C.teal,3,true,true)+label(545,723,'GROUP');
 b+=route('M1260 781 H1202',C.teal,3,true)+label(1160,750,'PAID');
 b+=route('M900 940 V1083')+label(920,1018,'ACTUALS');
 b+=route('M305 850 V1083',C.teal,3,true,true)+label(325,994,'CATEGORY L');
 b+=route('M540 1239 H598',C.teal,3,true,true)+label(544,1208,'LIMITS');
 b+=route('M1260 1245 H1230 V910 H1202',C.teal,3,true,true)+label(1216,1005,'OPTIONAL');
 b+=rect(70,1441,1660,206,C.pale,C.pale,22,0)+txt(98,1489,'SCOPE BOUNDARY',26,C.dark,700)+
   lines(98,1534,['A schedule records a local paid instalment; Wallet does not send money or execute a charge.','An AI draft is optional. Access is a prerequisite for protected records, not a repeated workflow step.'],24,40,C.ink);
 return svg(w,h,b);
}
function twoModular(){
 const w=1800,h=2260;let b=chrome('02','', 'AI-assisted expense entry','A draft suggests editable fields; only a later explicit Save can write an expense',w,h);
 b+=moduleFrame(70,292,760,767,'DRAFT REQUEST','NO FINANCIAL WRITE');
 b+=node(100,388,700,118,'1  Describe one paid EUR expense',['Request an optional AI draft.']);
 b+=node(100,538,700,159,'2  Preflight',['Validate request, mode and live consent.','Check owned context, concurrency and quota.']);
 b+=node(100,730,700,124,'3  Extraction adapter',['Demo fixture or enabled live provider.']);
 b+=node(100,887,700,127,'4  Validate + normalize',['Usable answer → 200 draft result.'],'teal');
 b+=route('M450 506 V536')+route('M450 697 V728')+route('M450 854 V885');
 b+=moduleFrame(970,292,760,767,'REVIEW SESSION','PERSON CONTROLS SAVE');
 b+=node(1000,388,700,136,'5  Read draft status',['ready / needs_input → editable review.','unsupported → cannot Save.'],'teal');
 b+=node(1000,556,700,155,'6  Correct or cancel',['Correct missing / invalid fields.','Cancel before Save → no expense.']);
 b+=node(1000,743,700,128,'7  Confirm explicit Save',['Only a deliberate valid-field confirmation proceeds.'],'teal');
 b+=rect(1000,904,700,111,C.amberPale,C.amberPale,17,0)+lines(1022,946,['Edit description, cancel, navigate or sign out','→ pending draft response invalidated.'],22,34,C.ink);
 b+=route('M800 951 H900 V456 H998')+route('M1350 524 V554')+route('M1350 711 V741');
 b+=txt(1380,545,'ready / needs_input',19,C.dark,700);
 b+=rect(70,1093,1660,140,C.redPale,C.redPale,20,0)+txt(98,1139,'PRE-SAVE FAILURE',25,C.red,700)+
   lines(98,1182,['Guard / provider / unusable output → fixed error. Unsupported 200 → cannot Save. No expense.','Quota may still be consumed even if generation fails.'],23,34,C.ink);
 b+=route('M100 620 H45 V1164 H68',C.red,3,true,true)+route('M100 792 H45',C.red,3,false,true)+route('M100 950 H45',C.red,3,false,true)+route('M1000 500 H930 V1091',C.red,3,true,true);
 b+=moduleFrame(70,1290,1660,540,'EXPLICIT FINANCIAL WRITE','SEPARATE FROM DRAFT');
 b+=node(98,1395,465,176,'8  Person confirms',['Ready / corrected needs_input','fields are reviewed first.'],'teal');
 b+=node(665,1395,465,176,'9  Keyed POST',['Account-scoped key and canonical','expense payload; no implicit Save.'],'teal');
 b+=node(1230,1395,465,176,'10  Confirmed 201',['One actual expense is stored','only after successful keyed Save.'],'teal');
 b+=route('M1350 1059 H1745 V1350 H330 V1393')+route('M563 1483 H663')+route('M1130 1483 H1228')+txt(1151,1460,'201',20,C.dark,700);
 b+=rect(98,1640,735,141,C.redPale,C.redPale,19,0)+txt(122,1687,'DEFINITIVE REFUSAL',24,C.red,700)+lines(122,1728,['Invalid Save returns to editable review;','no expense is written by that refusal.'],22,32,C.ink);
 b+=rect(958,1640,737,141,C.amberPale,C.amberPale,19,0)+txt(982,1687,'UNCERTAIN RESPONSE',24,C.amber,700)+lines(982,1728,['Lost reply / timeout / 5xx: save may exist.','Freeze SAME payload + key; retry that operation.'],22,32,C.ink);
 b+=route('M895 1571 V1610 H465 V1638',C.red,3,true)+route('M895 1610 H1326 V1638');
 b+=route('M1695 1720 H1755 V1375 H900 V1393',C.teal,3,true,true);
 b+=rect(70,1883,1660,232,C.pale,C.pale,21,0)+txt(98,1930,'BUSINESS BOUNDARY',26,C.dark,700)+
   lines(98,1976,['A draft is a suggestion, never a transaction. Unsupported results cannot enter the Save route.','An uncertain Save is checked with the same key and payload; a fresh key could create another expense.','Detailed commit, replay, conflict and tombstone branches are mapped in diagram 05.'],23,39,C.ink);
 b+=route('M900 1830 V1881');
 return svg(w,h,b);
}
function threeModular(){
 const w=1800,h=2070;let b=chrome('03','', 'Overall monthly limit','Current settings and actual expenses become a read-time status, never a save gate',w,h);
 b+=moduleFrame(70,292,760,638,'COMMANDS','WRITE');
 b+=moduleFrame(970,292,760,638,'PERSISTENCE','SQLITE');
 b+=node(100,389,700,160,'Settings write',['Requires monthly_income_cents.','Set integer L = 0..100000000 cents; NULL clears.']);
 b+=node(100,581,700,140,'Omit limit or reject invalid input',['Omission preserves current L.','Invalid settings write → no change.']);
 b+=node(100,751,700,133,'Record valid expense',['Expense validation is independent of L.'],'teal');
 b+=node(1000,389,700,160,'Current settings row',['Income is separate; L is one current value.','NULL means no limit; 0 is a real limit.'],'teal');
 b+=node(1000,751,700,133,'Actual expense rows',['Valid expense saves even if T will exceed L.'],'teal');
 b+=route('M800 469 H900 V469 H998')+txt(846,449,'valid settings',20,C.dark,700);
 b+=route('M800 816 H998')+txt(850,795,'valid save',20,C.dark,700);
 b+=moduleFrame(70,1020,760,585,'SELECTED-MONTH QUERY','READ');
 b+=moduleFrame(970,1020,760,585,'STATUS JUDGEMENT','DERIVED');
 b+=node(100,1118,700,125,'GET selected month',['A standalone read needs no prior write.'],'teal');
 b+=node(100,1277,700,163,'Aggregate T',['Sum actual saved expenses for that month.','Income is excluded.']);
 b+=node(100,1472,700,105,'Apply current L',['The same current limit applies to historical months.']);
 b+=route('M450 1243 V1275')+route('M450 1440 V1470');
 b+=route('M1360 930 V980 H450 V1116',C.teal,3,true,true)+txt(764,998,'read actuals + current settings',20,C.muted,700);
 b+=node(1000,1118,700,141,'Compare T with L',['L = NULL → not_set; otherwise compare.','Remaining L − T is calculated, never stored.'],'teal');
 b+=route('M800 1525 H900 V1188 H998');
 const states=[['NOT SET','L = NULL',C.soft,C.muted],['WITHIN','T < L',C.pale,C.dark],['REACHED','T = L',C.amberPale,C.amber],['EXCEEDED','T > L',C.redPale,C.red]];
 states.forEach((s,i)=>{let x=1000+(i%2)*350,y=1300+Math.floor(i/2)*147;b+=rect(x,y,330,114,s[2],s[2],17,0)+txt(x+19,y+43,s[0],22,s[3],700)+txt(x+19,y+88,s[1],30,C.ink,700)});
 b+=route('M1360 1259 V1276 H1165 V1298')+route('M1360 1276 H1515 V1298')+route('M1360 1276 H1715 V1428 H1165 V1445')+route('M1715 1428 H1515 V1445');
 b+=rect(70,1683,1660,231,C.amberPale,C.amberPale,21,0)+txt(98,1730,'ATTACHED LIMIT RULES',26,C.amber,700)+
   lines(98,1778,['L = 0 and T = 0 is REACHED. Remaining can be negative; no limit gives NULL remaining.','Every valid expense remains saveable in every state. Overall and category limits are independent;','the overall settings write does not cross-validate the sum of category limits.'],23,37,C.ink);
 b+=route('M1360 1605 V1645 H900 V1681');
 return svg(w,h,b);
}
function schemaCard(x,y,w,h,title,meta,fields){let q=rect(x,y,w,h,C.white,C.line,21,2)+rect(x,y,w,59,C.pale,C.pale,21,0)+txt(x+22,y+40,title,27,C.dark,700)+txt(x+w-20,y+39,meta,19,C.muted,700,'end');q+=lines(x+22,y+101,fields,22,33,C.ink);return q;}
function dbGraphNode(x,y,w,h,title,sub,fill=C.white){return rect(x,y,w,h,fill,fill===C.white?C.line:fill,18,fill===C.white?2:0)+txt(x+20,y+43,title,26,C.ink,700)+txt(x+20,y+81,sub,20,C.muted);}
function sixModular(){
 const w=1800,h=2730;let b=chrome('06','', 'Data model · seven tables','Seven table modules above; eight declared foreign keys in the relationship map',w,h);
 b+=band(70,278,1660,'TABLE MODULES  ·  keys and core constraints');
 b+=schemaCard(70,355,520,334,'users','IDENTITY',['id PK; email UNIQUE','password_hash','created_at']);
 b+=schemaCard(640,355,520,334,'categories','OWNED',['id PK; user_id FK → users','UNIQUE (user_id, name)','icon nullable','monthly_limit_cents NULL or ≥ 0']);
 b+=schemaCard(1210,355,520,334,'schedules','OWNED',['id PK; user_id FK → users','category_id? FK; amount_cents > 0','day_of_month 1–31; starts_on','total_count NULL = subscription','> 0 = finite loan; paid_count ≥ 0','active; created_at']);
 b+=schemaCard(70,727,520,334,'transactions','ACTUAL',['id PK; user_id FK → users','amount_cents > 0; spent_on','category_id? FK; schedule_id? FK','note nullable; created_at']);
 b+=schemaCard(640,727,520,334,'settings','0–1 / USER',['user_id PK + FK → users','monthly_income_cents ≥ 0','monthly_limit_cents NULL or ≥ 0']);
 b+=schemaCard(1210,727,520,334,'transaction_requests','REPLAY',['PK (user_id, operation_key)','user_id FK → users; payload_hash','transaction_id deliberately NO FK','response_json; created_at']);
 b+=schemaCard(70,1099,520,281,'ai_quota','ISOLATED',['PK (period, scope, user_id)','scope enum; count ≥ 0','user_id = 0 global; NO FK']);
 b+=rect(640,1099,1090,281,C.amberPale,C.amberPale,21,0)+txt(668,1150,'INTENTIONAL NO-FK FIELDS',26,C.amber,700)+
   lines(668,1198,['transaction_requests.transaction_id keeps a tombstone after deletion.','ai_quota.user_id uses 0 for the global counter.','Neither field creates a relationship line below.'],23,40,C.ink);
 b+=band(70,1431,1660,'DECLARED FK NETWORK  ·  eight real links, no invented edges');
 b+=dbGraphNode(70,1650,340,175,'users','one parent',C.pale);
 b+=dbGraphNode(560,1610,300,130,'categories','0..* per user');
 b+=dbGraphNode(990,1610,300,130,'schedules','0..* per user');
 b+=dbGraphNode(1420,1610,300,130,'transactions','0..* per user');
 b+=dbGraphNode(560,1960,300,130,'settings','0..1 per user');
 b+=dbGraphNode(990,1960,300,130,'transaction_requests','0..* per user');
 b+=dbGraphNode(1420,1960,300,130,'ai_quota','no user FK',C.amberPale);
 // Five user-owned relationships share a clean spine; each branch has its own endpoint.
 b+=route('M245 1650 V1540 H1570',C.teal,3,false);
 [710,1140,1570].forEach(x=>b+=route(`M${x} 1540 V1608`));
 b+=txt(293,1530,'users 1',21,C.dark,700);
 b+=route('M410 1750 H500 V1872 H1140',C.teal,3,false);
 b+=route('M710 1872 V1958')+route('M1140 1872 V1958');
 b+=txt(505,1857,'user 1',21,C.dark,700);
 b+=txt(730,1589,'1 → 0..*',20,C.dark,700)+txt(1160,1589,'1 → 0..*',20,C.dark,700)+txt(1590,1589,'1 → 0..*',20,C.dark,700);
 b+=txt(730,1937,'1 → 0..1',20,C.dark,700)+txt(1160,1937,'1 → 0..*',20,C.dark,700);
 // Optional category links and optional schedule link use separate corridors.
 b+=route('M860 1690 H988')+txt(867,1668,'0..* / 0..1',19,C.dark,700);
 b+=route('M1290 1690 H1418')+txt(1297,1668,'0..* / 0..1',19,C.dark,700);
 b+=route('M710 1740 V1810 H1570 V1742')+txt(998,1796,'categories 0..* → transactions; each transaction 0..1 category',20,C.dark,700);
 b+=rect(70,2193,1660,324,C.pale,C.pale,22,0)+txt(98,2245,'CARDINALITY + CONSTRAINT NOTES',26,C.dark,700)+
   lines(98,2294,['Solid edges above are the five users FKs plus categories→schedules, categories→transactions,','and schedules→transactions. Each schedule/expense has 0..1 category; each expense has 0..1 schedule.','Category and schedule parents may have 0..* children. All money values are integer cents.'],23,45,C.ink);
 return svg(w,h,b);
}
const diagrams={'01-capability-map':oneModular,'02-ai-expense-process':twoModular,'03-monthly-limit-process':threeModular,'04-category-limit-process':fourC,'05-draft-save-map':fiveC,'06-database-map':sixModular};
const publicMaps={
  '01-capability-map':['use-cases.svg','Wallet capabilities','Modules for account access, expenses, categories, schedules, limits, month review and optional AI drafts.'],
  '02-ai-expense-process':['ai-expense-process.svg','AI-assisted expense entry','Draft request and review are separate from an explicit keyed expense save; failure and uncertain-response paths are shown.'],
  '03-monthly-limit-process':['monthly-limit-process.svg','Overall monthly limit','Current setting and saved expenses are compared on read; the limit never blocks a valid save.'],
  '04-category-limit-process':['category-limit-process.svg','Category spending limits','Independent writes and a selected-month summary produce four per-category limit states.'],
  '05-draft-save-map':['draft-save-sequence.svg','Draft then explicit save','Three modules show draft generation, human review, keyed persistence and retry outcomes.'],
  '06-database-map':['database.svg','Wallet data model','Seven table modules and eight declared foreign-key relationships; intentional non-foreign-key fields are identified.'],
};
function accessible(data,title,desc){return data.replace(/(<svg\b[^>]*>)/,`$1<title>${e(title)}</title><desc>${e(desc)}</desc>`);}
function main(){
 const args=process.argv.slice(2);
 const check=args.includes('--check');
 const names=args.filter(arg=>arg!=='--check');
 const selected=names.length?names:Object.keys(diagrams);
 let failed=false;
 for(const name of selected){
  const fn=diagrams[name],meta=publicMaps[name];
  if(!fn||!meta)throw Error('Unknown diagram: '+name);
  const [file,title,desc]=meta;
  const target=path.join(OUT,file);
  const data=accessible(fn(),title,desc);
  if(check){
   const actual=fs.existsSync(target)?fs.readFileSync(target,'utf8'):null;
   const equal=actual===data;
   console.log(`${file}: ${equal?'MATCH':'MISMATCH'}`);
   if(!equal)failed=true;
  }else{
   fs.writeFileSync(target,data,'utf8');
   console.log(`${file}: written`);
  }
 }
 if(failed)process.exitCode=1;
}
try{main();}catch(error){console.error(error.message);process.exitCode=1;}
