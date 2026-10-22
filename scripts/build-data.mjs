// Genera data/dati.json. Node 20+. Env: TMDB_KEY (film e on demand), FD_KEY (calcio, football-data.org)
import {gunzipSync} from 'node:zlib';
import {mkdirSync,writeFileSync} from 'node:fs';
const {TMDB_KEY='',FD_KEY=''}=process.env,t0=Date.now(),t1=t0+7*864e5;
const get=async(u,o={},bin)=>{const r=await fetch(u,o);if(!r.ok)throw Error(r.status+' '+u.split('?')[0]);return bin?Buffer.from(await r.arrayBuffer()):r.json()};
const safe=async(n,f,d)=>{try{return await f()}catch(x){console.warn('!',n,x.message);return d}};
const day=t=>new Date(t).toLocaleDateString('sv',{timeZone:'Europe/Rome'});
const hm=t=>new Date(t).toLocaleTimeString('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'});
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-');
const dec=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").trim();
const attr=(s,k)=>(s.match(new RegExp(k+'="([^"]*)"'))||[])[1]||'';
const tag=(s,k)=>{const m=s.match(new RegExp('<'+k+'[^>]*>([^<]*)</'+k+'>'));return m?dec(m[1]):''};
const ts=s=>Date.parse(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}${s.slice(15,18)||'+00'}:${s.slice(18,20)||'00'}`);
const T2=s=>{const v=ts(s);return isNaN(v)?Date.parse(s):v};
async function epg(url,keep){const buf=await get(url,{headers:{'User-Agent':'Mozilla/5.0'}},1),xml=(buf[0]==0x1f&&buf[1]==0x8b?gunzipSync(buf):buf).toString('utf8'),ch={},out=[];let n=0,first='',last='';
 if(!xml.includes('<programme'))throw Error('risposta non XMLTV: '+xml.slice(0,80));
 for(const m of xml.matchAll(/<channel id="([^"]+)"[^>]*>([\s\S]*?)<\/channel>/g))ch[m[1]]=tag(m[2],'display-name');
 for(const m of xml.matchAll(/<programme ([^>]*)>([\s\S]*?)<\/programme>/g)){n++;const c=ch[attr(m[1],'channel')]||attr(m[1],'channel');if(keep&&!keep.test(c))continue;
  const s=attr(m[1],'start'),t=T2(s),e=T2(attr(m[1],'stop'));if(!first)first=s;last=s;if(!(t>=t0-36e5&&t<t1))continue;
  out.push({ch:c,t,min:(e-t)/6e4,title:tag(m[2],'title'),desc:tag(m[2],'desc'),cat:[...m[2].matchAll(/<category[^>]*>([^<]*)/g)].map(x=>dec(x[1])).join('|'),year:+tag(m[2],'date').slice(0,4)||0})}
 console.log(url,'canali',Object.keys(ch).length,'programmi',n,'in finestra',out.length,'primo',first,'ultimo',last);return out}
const getEpg=async(urls,keep)=>{for(const u of urls){const r=await safe(u,()=>epg(u,keep),[]);if(r.length)return r}return[]};
const P=[...await getEpg(['https://epg.lat/files/it.xml.gz','https://epgshare01.online/epgshare01/epg_ripper_IT1.xml.gz']),...await getEpg(['https://epg.lat/files/ch.xml.gz'],/\bRSI\b/i)];
console.log('Programmi in guida:',P.length);
const T=(p,x='')=>{const b=TMDB_KEY.length>40;return get(`https://api.themoviedb.org/3${p}?language=it-IT${x}${b?'':'&api_key='+TMDB_KEY}`,b?{headers:{Authorization:'Bearer '+TMDB_KEY}}:{})};
const IMG='https://image.tmdb.org/t/p/w342',tv=[],teams=new Set();
// CALCIO (Serie A, Premier, Champions da football-data.org)
const BIG=/inter|milan|juventus|napoli|roma|lazio|atalanta|manchester|man city|man united|liverpool|arsenal|chelsea|tottenham|real madrid|barcelona|bayern|paris|psg|dortmund|atl[eé]tico/i;
const COMP={SA:['Serie A','DAZN'],PL:['Premier League','Sky Sport'],CL:['Champions League','Sky Sport o Prime Video']};
const sky=m=>P.find(p=>/sky sport/i.test(p.ch)&&Math.abs(p.t-Date.parse(m.utcDate))<36e5&&[m.homeTeam,m.awayTeam].every(t=>new RegExp('\\b'+(t.shortName||t.name).split(' ')[0],'i').test(p.title)));
if(FD_KEY)for(const c of Object.keys(COMP)){const H={headers:{'X-Auth-Token':FD_KEY}},B='https://api.football-data.org/v4/competitions/'+c;
 const j=await safe(c,()=>get(`${B}/matches?dateFrom=${day(t0)}&dateTo=${day(t1)}`,H),{matches:[]});
 (await safe(c+' squadre',()=>get(B+'/teams',H),{teams:[]})).teams.forEach(x=>teams.add(x.shortName||x.name));
 for(const m of j.matches){const t=Date.parse(m.utcDate),h=m.homeTeam.shortName||m.homeTeam.name,a=m.awayTeam.shortName||m.awayTeam.name,s=sky(m);
  tv.push({id:'f'+m.id,day:day(t),time:hm(t),kind:'sport',comp:COMP[c][0],title:`${h} - ${a}`,teams:[h,a],channel:s?s.ch:COMP[c][1],big:[h,a].filter(x=>BIG.test(x)).length>1||(c=='CL'&&m.stage!='LEAGUE_STAGE')})}}
// F1, MOTOGP (qualifiche, sprint, gara), EUROPA/CONFERENCE LEAGUE: dalla guida TV
const dd=new Set();
for(const p of P){const ti=p.title,mo=/motogp/i.test(ti)&&!/moto[23]/i.test(ti),comp=mo?'MotoGP':/formula 1|\bf1\b/i.test(ti)?'F1':'';
 if(comp&&/qualific|sprint|\bgara\b|gran premio|\bgp\b/i.test(ti)&&!/libere|\bfp\d|prove|replay|differita|highlights|paddock|pre[- ]?gara|post[- ]?gara|magazine|storia/i.test(ti)&&p.min>=20&&!dd.has(comp+p.t)){dd.add(comp+p.t);tv.push({id:'r'+comp+p.t,day:day(p.t),time:hm(p.t),kind:'sport',comp,title:ti,channel:p.ch})}
 else if(/(europa|conference) league/i.test(ti)&&/sky/i.test(p.ch)&&p.min>=90&&p.min<=200&&!/magazine|studio|highlights|replay|differita|gol/i.test(ti)&&!dd.has(ti+p.t)){
  const tm=ti.replace(/^[^:]*:\s*/,'').split(/\s+[-–]\s+|-/).map(s=>s.trim());
  if(tm.length==2){dd.add(ti+p.t);tv.push({id:'u'+slug(ti)+p.t,day:day(p.t),time:hm(p.t),kind:'sport',comp:/conference/i.test(ti)?'Conference League':'Europa League',title:tm.join(' - '),teams:tm,channel:p.ch,big:tm.some(x=>BIG.test(x))})}}}
// SVIZZERA: Super League, Promotion League e Coppa Svizzera (Lugano, Bellinzona) da TheSportsDB
const TS='https://www.thesportsdb.com/api/v1/json/123',CHC={'swiss super league':['Super League','blue Sport o RSI'],'swiss promotion league':['Promotion League','Da verificare'],'swiss cup':['Coppa Svizzera','Da verificare']};let nCH=0;
teams.add('Lugano');teams.add('Bellinzona');
const all=(await safe('leghe CH',()=>get(TS+'/all_leagues.php'),{leagues:[]})).leagues||[];
console.log('Leghe TheSportsDB:',all.length,'| svizzere:',all.filter(l=>/swiss|switz/i.test(l.strLeague)).map(l=>`${l.strLeague}=${l.idLeague}(${l.strSport})`).join(', '));
const sw=all.filter(l=>l.strSport=='Soccer'&&CHC[(l.strLeague||'').toLowerCase()]);
if(!sw.some(l=>l.idLeague=='5319'))sw.push({idLeague:'5319',strLeague:'Swiss Promotion League'});
for(const l of sw){const c=CHC[l.strLeague.toLowerCase()];
 let ev=(await safe(l.strLeague,()=>get(`${TS}/eventsseason.php?id=${l.idLeague}&s=2026-2027`),{events:[]})).events||[];
 if(!ev.length)ev=(await safe(l.strLeague,()=>get(`${TS}/eventsnextleague.php?id=${l.idLeague}`),{events:[]})).events||[];
 console.log(l.strLeague,l.idLeague,'eventi',ev.length,'primo',ev[0]?.dateEvent,'ultimo',ev[ev.length-1]?.dateEvent);
 for(const m of ev){teams.add(m.strHomeTeam);teams.add(m.strAwayTeam);
  const t=Date.parse((m.strTimestamp||`${m.dateEvent}T${m.strTime||'00:00:00'}`).replace(/Z?$/,'Z'));if(!(t>=t0-36e5&&t<t1))continue;
  nCH++;tv.push({id:'c'+m.idEvent,day:day(t),time:hm(t),kind:'sport',comp:c[0],title:`${m.strHomeTeam} - ${m.strAwayTeam}`,teams:[m.strHomeTeam,m.strAwayTeam],channel:c[1]})}}
console.log('Svizzera, partite nei prossimi 7 giorni:',nCH);
// GENERI TMDB
const gm={};if(TMDB_KEY)for(const k of['movie','tv'])(await safe('generi',()=>T(`/genre/${k}/list`),{genres:[]})).genres.forEach(g=>gm[g.id]=g.name);
const X={'Action & Adventure':['Azione','Avventura'],'Sci-Fi & Fantasy':['Fantascienza','Fantasy']},gn=ids=>(ids||[]).flatMap(i=>X[gm[i]]||[gm[i]]).filter(Boolean);
// FILM IN DIRETTA (prima serata, scelti per voto, notorietà e ultima occasione)
const prime=p=>{const h=+hm(p.t).slice(0,2);return h>=20&&h<24},cache=new Map();
const look=async p=>{const k=p.title+p.year;if(!cache.has(k))cache.set(k,TMDB_KEY?await safe('tmdb',async()=>(await T('/search/movie','&query='+encodeURIComponent(p.title)+(p.year?'&year='+p.year:''))).results[0],null):null);return cache.get(k)};
for(const p of P.filter(p=>prime(p)&&/film|cinema|movie/i.test(p.cat)&&p.min>=70&&p.min<=220&&!/sky (sport|tg24)/i.test(p.ch))){
 const m=await look(p),ok=m&&m.vote_count>=50,sc=ok?m.vote_average*(1-Math.exp(-m.vote_count/300))+Math.log10(1+m.popularity):0;
 tv.push({id:ok?'m'+m.id:'x'+slug(p.title),day:day(p.t),time:hm(p.t),kind:'film',title:ok?m.title:p.title,year:+(ok?m.release_date:'').slice(0,4)||p.year||'',rating:ok&&m.vote_average?+m.vote_average.toFixed(1):'',plot:(ok&&m.overview)||p.desc.slice(0,300),genres:ok?gn(m.genre_ids):[],poster:ok&&m.poster_path?IMG+m.poster_path:'',channel:p.ch,score:+sc.toFixed(2)})}
// PROGRAMMI DI PUNTA (lista modificabile)
const SHOWS=['le iene','report','striscia la notizia','chi l.ha visto','amici','x factor','masterchef','che tempo che fa','ballando con le stelle','porta a porta','quarto grado','affari tuoi','il collegio','italia.s got talent','pechino express','temptation island','grande fratello','propaganda live','zelig','sanremo','t[uú] s[iì] que vales','the voice','otto e mezzo','piazzapulita','dritto e rovescio'];
for(const p of P.filter(p=>prime(p)&&p.min>=30)){const r=SHOWS.findIndex(s=>new RegExp(s,'i').test(p.title));if(r>=0)tv.push({id:'s'+slug(p.title),day:day(p.t),time:hm(p.t),kind:'show',title:p.title,plot:p.desc.slice(0,300),channel:p.ch,score:+(10-r*.2).toFixed(1)})}
// ON DEMAND (novità degli ultimi 120 giorni sulle tue piattaforme, in Italia)
const vod=[],nice=n=>n.replace(/^Amazon /,'').replace(/ Plus$/,'+');
if(TMDB_KEY){const from=new Date(t0-120*864e5).toISOString().slice(0,10);
 for(const k of['movie','tv']){const pr=((await safe('provider',()=>T(`/watch/providers/${k}`,'&watch_region=IT'),{results:[]})).results||[]).filter(x=>/^(netflix|amazon prime video|disney plus|apple tv( plus|\+)?|(hbo )?max|paramount( plus|\+)?)$/i.test(x.provider_name));
  for(const p of pr){const r=await safe(p.provider_name,()=>T('/discover/'+k,`&watch_region=IT&with_watch_providers=${p.provider_id}&with_watch_monetization_types=flatrate&sort_by=popularity.desc&${k=='movie'?'primary_release_date':'first_air_date'}.gte=${from}`),{results:[]});
   for(const x of r.results.slice(0,15)){const id=(k=='movie'?'m':'t')+x.id;let o=vod.find(v=>v.id==id);
    if(!o)vod.push(o={id,type:k=='movie'?'film':'serie',title:x.title||x.name,year:+(x.release_date||x.first_air_date||'').slice(0,4)||'',date:x.release_date||x.first_air_date,rating:x.vote_average?+x.vote_average.toFixed(1):'',plot:x.overview,genres:gn(x.genre_ids),poster:x.poster_path?IMG+x.poster_path:'',pop:x.popularity,prov:[]});
    o.prov.push(nice(p.provider_name))}}}}
// USCITA (al massimo 5 film e 6 programmi al giorno)
const cnt={},sk=new Set(),rest=tv.filter(x=>x.kind!='sport').sort((a,b)=>b.score-a.score).filter(x=>{if(sk.has(x.id+x.day))return 0;sk.add(x.id+x.day);const c=x.day+x.kind;cnt[c]=(cnt[c]||0)+1;return cnt[c]<=(x.kind=='film'?5:6)});
const out=[...tv.filter(x=>x.kind=='sport'),...rest].sort((a,b)=>(a.day+a.time<b.day+b.time?-1:1));
mkdirSync('data',{recursive:true});
writeFileSync('data/dati.json',JSON.stringify({generated:new Date().toISOString(),teams:[...teams].sort(),tv:out,vod:vod.sort((a,b)=>b.pop-a.pop).slice(0,60)}));
console.log('Eventi:',out.length,'On demand:',vod.length);
