"use strict";

const STORAGE_KEY = "outfit-ai-pwa-v2";
const COLORS = ["白","黒","グレー","ネイビー","青","ベージュ","ブラウン","グリーン","赤","その他"];
const PLANS = ["仕事","営業","休日","長時間歩く","雨","旅行","フォーマル"];
const LABEL = {shirt:"シャツ",pants:"パンツ",shoes:"靴"};
const ICON = {shirt:"👕",pants:"👖",shoes:"👞"};

const makeItem = (kind, patch={}) => ({
  id: crypto.randomUUID(), kind, name:"", brand:"", color:"その他", image:"", favorite:false,
  useCount:0, lastUsed:"未使用", formal:3, tags:[LABEL[kind]], subtype:"未設定",
  sleeve:kind==="shirt"?"未設定":"", pattern:kind==="shirt"?"未設定":"",
  length:kind==="pants"?"ロング":"", material:kind==="shoes"?"未設定":"",
  walk:3, easyOff:3, rain:"normal", maintenanceDate:"未実施", maintenanceCount:0, ...patch
});

const samples = [
  makeItem("shirt",{id:"shirt-white",name:"白シャツ",brand:"無印良品",color:"白",subtype:"シャツ",sleeve:"長袖",pattern:"無地",formal:4,tags:["仕事","きれいめ"]}),
  makeItem("pants",{id:"pants-navy",name:"ネイビースラックス",brand:"UNIQLO",color:"ネイビー",subtype:"スラックス",formal:4,tags:["仕事","きれいめ"]}),
  makeItem("shoes",{id:"shoes-loafer",name:"黒ローファー",brand:"REGAL",color:"黒",subtype:"ローファー",material:"スムースレザー",formal:4,walk:4,easyOff:5,favorite:true,useCount:12,tags:["仕事","革靴","きれいめ"]}),
  makeItem("shoes",{id:"shoes-sneaker",name:"茶スニーカー",brand:"SKECHERS",color:"ブラウン",subtype:"スニーカー",material:"メッシュ",formal:2,walk:5,easyOff:4,rain:"bad",useCount:3,tags:["休日","歩きやすい"]}),
  makeItem("shoes",{id:"shoes-plain",name:"黒プレーントゥ",brand:"SCOTCH GRAIN",color:"黒",subtype:"プレーントゥ",material:"スムースレザー",formal:5,walk:3,rain:"good",useCount:6,tags:["仕事","フォーマル","雨"]})
];

let state = loadState();
let ui = {tab:"today",kind:"shirt",plan:"仕事",shirtId:"shirt-white",pantsId:"pants-navy",showRecommendations:false,editing:null,completion:null};
let weather = {area:"現在地",condition:"確認中",temperature:"--",rainChance:0,yesterday:"確認中"};
const app = document.querySelector("#app");

function loadState(){
  try { const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)); if(saved?.items) return saved; } catch(e){}
  return {items:samples,histories:[]};
}
function saveState(){ try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){alert("写真が多すぎて保存できません。古い写真を減らしてください。");} }
function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function today(){return new Date().toLocaleDateString("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit"}).replaceAll("/0","/");}
function itemPhoto(i){return i?.image?`<img class="photo" src="${i.image}" alt="${esc(i.name)}">`:`<div class="photo placeholder">${ICON[i?.kind]||"👞"}</div>`;}
function find(id){return state.items.find(x=>x.id===id);}

function render(){
  app.innerHTML=`<div class="shell"><header class="top"><div><p class="eyebrow">SHOES FIRST</p><h1>OUTFIT AI</h1></div><div class="weather">${weather.condition}　<strong>${weather.temperature}℃</strong><br><small>${weather.area}</small></div></header><main class="content">${view()}</main>${tabs()}</div>${ui.editing?editor(ui.editing):""}`;
  bind();
}
function tabs(){return `<nav class="tabs">${[["today","今日","☀️"],["master","マスター","▦"],["history","履歴","◷"],["analysis","分析","▥"]].map(([id,label,icon])=>`<button data-tab="${id}" class="${ui.tab===id?"active":""}"><span>${icon}</span>${label}</button>`).join("")}</nav>`;}
function view(){if(ui.tab==="master")return masterView();if(ui.tab==="history")return historyView();if(ui.tab==="analysis")return analysisView();return todayView();}

function todayView(){
  if(ui.completion)return completionView();
  const shirts=state.items.filter(x=>x.kind==="shirt"), pants=state.items.filter(x=>x.kind==="pants"), shoes=state.items.filter(x=>x.kind==="shoes");
  const shirt=find(ui.shirtId)||shirts[0], pant=find(ui.pantsId)||pants[0];
  const results=scoreShoes(shoes,shirt,pant,ui.plan);
  return `<div class="stack"><section class="hero"><p class="eyebrow">TODAY</p><h2>今日の靴を決めましょう</h2><p>登録済みのシャツとパンツを選ぶと、条件に合う靴を3足提案します。</p></section>
  <section class="panel"><h3>今日の条件</h3><div class="grid three"><label>予定<select id="plan">${PLANS.map(x=>`<option ${x===ui.plan?"selected":""}>${x}</option>`).join("")}</select></label><label>シャツ<select id="shirt">${shirts.map(x=>`<option value="${x.id}" ${x.id===shirt?.id?"selected":""}>${esc(x.name)}</option>`).join("")}</select></label><label>パンツ<select id="pants">${pants.map(x=>`<option value="${x.id}" ${x.id===pant?.id?"selected":""}>${esc(x.name)}</option>`).join("")}</select></label></div><p class="muted">昨日の天気：${esc(weather.yesterday)}</p><button id="recommend" class="primary" ${!shirt||!pant||!shoes.length?"disabled":""}>おすすめ3足を表示</button></section>
  ${ui.showRecommendations?`<section class="stack"><div class="section-title"><div><p class="eyebrow">RECOMMENDED</p><h2>おすすめの靴 3足</h2></div></div>${results.map((r,i)=>recommendCard(r,i)).join("")}</section>`:""}</div>`;
}
function recommendCard(r,i){return `<article class="card recommendation"><div class="rank">${i+1}</div>${itemPhoto(r.shoe)}<div><div class="score"><b>${esc(r.shoe.name)}</b><strong>${r.score}<small>点</small></strong></div><p>${esc(r.reason)}</p><div class="chips">${r.shoe.tags.slice(0,3).map(t=>`<span>${esc(t)}</span>`).join("")}</div><button class="${i===0?"primary":"secondary"} wear" data-id="${r.shoe.id}" data-reason="${esc(r.reason)}">今日これを履く</button></div></article>`;}
function scoreShoes(shoes,shirt,pants,plan){return shoes.map(shoe=>{let score=50,reasons=[];if(["仕事","営業","フォーマル"].includes(plan)){shoe.formal>=4?(score+=22,reasons.push("予定に合うフォーマル度")):(score-=10,reasons.push("少しカジュアル"));}if(plan==="休日"&&shoe.formal<=3){score+=12;reasons.push("休日向き");}if(plan==="長時間歩く"){score+=shoe.walk*6;reasons.push("歩きやすさを重視");}if(weather.rainChance>=50||plan==="雨"){if(shoe.rain==="good"){score+=25;reasons.push("雨に強い");}if(shoe.rain==="bad"){score-=30;reasons.push("雨には不向き");}if(shoe.material==="スエード"){score-=25;reasons.push("雨の日はスエードを避けたい");}}if(shirt?.color==="白"&&shoe.color==="黒"){score+=10;reasons.push("白シャツと黒靴の相性");}if(pants?.color==="ネイビー"&&["黒","ブラウン"].includes(shoe.color)){score+=10;reasons.push("ネイビーパンツとの相性");}if(pants?.color==="グレー"&&shoe.color==="黒"){score+=10;reasons.push("グレーパンツとの相性");}if(shoe.favorite){score+=8;reasons.push("お気に入り");}if(shoe.useCount===0){score+=12;reasons.push("まだ履いていない");}if(shoe.lastUsed===today()){score-=25;reasons.push("今日は使用済み");}return{shoe,score:Math.max(0,Math.min(100,score)),reason:reasons.join("・")||"全体のバランスが良い"};}).sort((a,b)=>b.score-a.score).slice(0,3);}

function completionView(){const c=ui.completion;return `<section class="completion"><div class="check">✓</div><p class="eyebrow">RECORDED</p><h2>今日のコーデを記録しました</h2><p class="muted">${esc(weather.condition)}・${weather.temperature}℃</p><div class="outfit">${outfitPiece(c.shirt,"シャツ")}${outfitPiece(c.pants,"パンツ")}${outfitPiece(c.shoe,"靴")}</div><div class="panel"><b>この靴を選んだ理由</b><p>${esc(c.reason)}</p></div><br><button id="home" class="primary">メインに戻る</button></section>`;}
function outfitPiece(i,label){return `<div>${itemPhoto(i)}<small>${label}</small><br><b>${esc(i.name)}</b></div>`;}

function masterView(){const list=state.items.filter(x=>x.kind===ui.kind);return `<div class="stack"><div class="section-title"><div><p class="eyebrow">WARDROBE</p><h2>マスター</h2></div><button id="add" class="primary">＋ 登録</button></div><div class="segmented">${["shirt","pants","shoes"].map(k=>`<button class="kind ${ui.kind===k?"active":""}" data-kind="${k}">${LABEL[k]}</button>`).join("")}</div><section class="master-grid">${list.map(i=>`<button class="card item-card edit" data-id="${i.id}">${itemPhoto(i)}<div><b>${esc(i.name)} ${i.favorite?"★":""}</b><p>${esc(i.brand||"ブランド未設定")} / ${esc(i.color)}</p><small>${esc(i.subtype)}${i.kind==="shoes"?`・${esc(i.material)}・歩きやすさ${i.walk}`:""}</small><small>使用 ${i.useCount}回・最終 ${esc(i.lastUsed)}</small></div></button>`).join("")||`<div class="empty">まだ登録されていません</div>`}</section></div>`;}

function editor(item){const exists=state.items.some(x=>x.id===item.id);return `<div class="modal"><section class="editor"><div class="editor-head"><div><p class="eyebrow">REGISTER & EDIT</p><h2>${LABEL[item.kind]}の情報</h2></div><button id="close" class="secondary">閉じる</button></div><div class="photo-stage">${item.image?`<img src="${item.image}" alt="登録写真">`:`<div class="empty">${ICON[item.kind]}<br>写真を追加してください</div>`}</div><div class="photo-actions"><button id="camera" class="secondary">カメラで撮影</button><button id="library" class="secondary">写真ライブラリ</button></div><input id="cameraInput" class="hidden" type="file" accept="image/*" capture="environment"><input id="libraryInput" class="hidden" type="file" accept="image/*"><p class="muted">写真を選ぶとすぐ表示し、代表色を候補入力します。すべて後から修正できます。</p><div class="grid"><label>名前<input id="name" value="${esc(item.name)}"></label><label>ブランド<input id="brand" value="${esc(item.brand)}" placeholder="自由に修正できます"></label><label>色<select id="color">${COLORS.map(x=>`<option ${x===item.color?"selected":""}>${x}</option>`).join("")}</select></label><label>種類<input id="subtype" value="${esc(item.subtype)}"></label>${typeFields(item)}</div><div class="panel"><b>再読み込み・メンテナンス</b><div class="actions"><button id="tagPhoto" class="secondary">タグを撮影</button>${item.kind==="shoes"?`<button id="shoeBox" class="secondary">靴箱を撮影</button><button id="maintenance" class="secondary">今日メンテした</button>`:""}</div><input id="tagInput" class="hidden" type="file" accept="image/*" capture="environment"></div><label><input id="favorite" type="checkbox" ${item.favorite?"checked":""}> お気に入り</label><div class="actions">${exists?`<button id="delete" class="danger">削除</button>`:""}<button id="cancel" class="secondary">キャンセル</button><button id="save" class="primary">この内容で保存</button></div></section></div>`;}
function typeFields(i){if(i.kind==="shirt")return `<label>袖<select id="sleeve">${["未設定","半袖","長袖","七分袖"].map(x=>`<option ${x===i.sleeve?"selected":""}>${x}</option>`).join("")}</select></label><label>柄<select id="pattern">${["未設定","無地","ストライプ","チェック","プリント"].map(x=>`<option ${x===i.pattern?"selected":""}>${x}</option>`).join("")}</select></label>`;if(i.kind==="pants")return `<label>丈<select id="length">${["ロング","クロップド","ショート"].map(x=>`<option ${x===i.length?"selected":""}>${x}</option>`).join("")}</select></label>`;return `<label>素材<select id="material">${["未設定","スムースレザー","スエード","キャンバス","メッシュ","合皮"].map(x=>`<option ${x===i.material?"selected":""}>${x}</option>`).join("")}</select></label><label>雨対応<select id="rain"><option value="good" ${i.rain==="good"?"selected":""}>強い</option><option value="normal" ${i.rain==="normal"?"selected":""}>普通</option><option value="bad" ${i.rain==="bad"?"selected":""}>弱い</option></select></label><label>歩きやすさ：<span id="walkValue">${i.walk}</span><input id="walk" type="range" min="1" max="5" value="${i.walk}"></label><label>脱ぎやすさ：<span id="easyValue">${i.easyOff}</span><input id="easyOff" type="range" min="1" max="5" value="${i.easyOff}"></label>`;}

function historyView(){return `<div class="stack"><div class="section-title"><div><p class="eyebrow">JOURNAL</p><h2>コーデ履歴</h2></div><span>${state.histories.length}件</span></div><section class="timeline">${state.histories.map(h=>`<article class="history"><b>${esc(h.date)}　${esc(h.shoes)}</b><p>${esc(h.shirt)}・${esc(h.pants)}</p><small>${esc(h.plan)} / ${esc(h.weather)}</small><small>${esc(h.reason)}</small></article>`).join("")||`<div class="empty">「今日これを履く」を押すと、ここに記録されます。</div>`}</section></div>`;}
function analysisView(){const shoes=state.items.filter(x=>x.kind==="shoes").sort((a,b)=>b.useCount-a.useCount);return `<div class="stack"><div class="section-title"><div><p class="eyebrow">INSIGHTS</p><h2>靴の分析</h2></div></div><section class="stats"><div class="stat"><strong>${shoes.length}</strong><span>登録靴</span></div><div class="stat"><strong>${state.histories.length}</strong><span>コーデ履歴</span></div><div class="stat"><strong>${shoes.filter(x=>x.useCount===0).length}</strong><span>未使用</span></div><div class="stat"><strong>${shoes.filter(x=>x.maintenanceCount===0).length}</strong><span>手入れ未記録</span></div></section><section class="panel"><h3>使用回数ランキング</h3>${shoes.map((s,i)=>`<div class="ranking"><span>${i+1}</span>${itemPhoto(s)}<div><b>${esc(s.name)}</b><small class="muted">最終使用 ${esc(s.lastUsed)}</small></div><strong>${s.useCount}回</strong></div>`).join("")}</section><section class="panel"><h3>メンテナンス</h3>${shoes.map(s=>`<div class="ranking"><span>🧴</span>${itemPhoto(s)}<div><b>${esc(s.name)}</b><small class="muted">最終手入れ ${esc(s.maintenanceDate)}</small></div><strong>${s.maintenanceCount?`${s.maintenanceCount}回`:"確認推奨"}</strong></div>`).join("")}</section></div>`;}

function bind(){
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{ui.tab=b.dataset.tab;ui.completion=null;render();});
  const plan=document.querySelector("#plan");if(plan)plan.onchange=e=>{ui.plan=e.target.value;ui.showRecommendations=false;render();};
  const shirt=document.querySelector("#shirt");if(shirt)shirt.onchange=e=>{ui.shirtId=e.target.value;ui.showRecommendations=false;render();};
  const pants=document.querySelector("#pants");if(pants)pants.onchange=e=>{ui.pantsId=e.target.value;ui.showRecommendations=false;render();};
  const rec=document.querySelector("#recommend");if(rec)rec.onclick=()=>{ui.showRecommendations=true;render();};
  document.querySelectorAll(".wear").forEach(b=>b.onclick=()=>recordWear(b.dataset.id,b.dataset.reason));
  const home=document.querySelector("#home");if(home)home.onclick=()=>{ui.completion=null;ui.showRecommendations=false;render();};
  document.querySelectorAll(".kind").forEach(b=>b.onclick=()=>{ui.kind=b.dataset.kind;render();});
  const add=document.querySelector("#add");if(add)add.onclick=()=>{ui.editing=makeItem(ui.kind);render();};
  document.querySelectorAll(".edit").forEach(b=>b.onclick=()=>{ui.editing=structuredClone(find(b.dataset.id));render();});
  if(ui.editing)bindEditor();
}
function recordWear(id,reason){const shoe=find(id),shirt=find(ui.shirtId),pants=find(ui.pantsId);if(!shoe||!shirt||!pants)return;shoe.useCount++;shoe.lastUsed=today();state.histories.unshift({id:crypto.randomUUID(),date:today(),plan:ui.plan,weather:`${weather.condition} ${weather.temperature}℃`,shirt:shirt.name,pants:pants.name,shoes:shoe.name,reason});ui.completion={shoe:structuredClone(shoe),shirt,pants,reason};saveState();render();}

function bindEditor(){
  const close=()=>{ui.editing=null;render();};document.querySelector("#close").onclick=close;document.querySelector("#cancel").onclick=close;
  document.querySelector("#camera").onclick=()=>document.querySelector("#cameraInput").click();document.querySelector("#library").onclick=()=>document.querySelector("#libraryInput").click();
  document.querySelector("#cameraInput").onchange=photoChanged;document.querySelector("#libraryInput").onchange=photoChanged;
  const tag=document.querySelector("#tagPhoto");if(tag)tag.onclick=()=>document.querySelector("#tagInput").click();const box=document.querySelector("#shoeBox");if(box)box.onclick=()=>document.querySelector("#tagInput").click();
  const tagInput=document.querySelector("#tagInput");if(tagInput)tagInput.onchange=()=>{ui.editing.tags=[...new Set([...ui.editing.tags,"タグ撮影済み"])];alert("タグ写真を確認しました。候補は自由に修正してください。");};
  const maint=document.querySelector("#maintenance");if(maint)maint.onclick=()=>{ui.editing.maintenanceDate=today();ui.editing.maintenanceCount++;alert("メンテナンスを記録しました。");};
  const walk=document.querySelector("#walk");if(walk)walk.oninput=e=>document.querySelector("#walkValue").textContent=e.target.value;const easy=document.querySelector("#easyOff");if(easy)easy.oninput=e=>document.querySelector("#easyValue").textContent=e.target.value;
  const del=document.querySelector("#delete");if(del)del.onclick=()=>{if(confirm("この登録を削除しますか？")){state.items=state.items.filter(x=>x.id!==ui.editing.id);saveState();close();}};
  document.querySelector("#save").onclick=saveEditor;
}
async function photoChanged(e){const file=e.target.files?.[0];if(!file)return;ui.editing.image=await compressImage(file);ui.editing.color=await analyzeColor(file);if(!ui.editing.name)ui.editing.name=`${ui.editing.color}${LABEL[ui.editing.kind]}`;ui.editing.tags=[...new Set([...ui.editing.tags,ui.editing.color])];render();}
function saveEditor(){const i=ui.editing;i.name=document.querySelector("#name").value.trim();i.brand=document.querySelector("#brand").value.trim();i.color=document.querySelector("#color").value;i.subtype=document.querySelector("#subtype").value.trim();i.favorite=document.querySelector("#favorite").checked;if(i.kind==="shirt"){i.sleeve=document.querySelector("#sleeve").value;i.pattern=document.querySelector("#pattern").value;}if(i.kind==="pants")i.length=document.querySelector("#length").value;if(i.kind==="shoes"){i.material=document.querySelector("#material").value;i.rain=document.querySelector("#rain").value;i.walk=Number(document.querySelector("#walk").value);i.easyOff=Number(document.querySelector("#easyOff").value);}if(!i.name)return alert("名前を入力してください。");const n=state.items.findIndex(x=>x.id===i.id);n>=0?state.items[n]=i:state.items.push(i);saveState();ui.editing=null;render();}

function compressImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onload=()=>{const max=1000,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement("canvas");canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.76));};img.src=reader.result;};reader.readAsDataURL(file);});}
async function analyzeColor(file){try{const bitmap=await createImageBitmap(file),canvas=document.createElement("canvas");canvas.width=24;canvas.height=24;const ctx=canvas.getContext("2d");ctx.drawImage(bitmap,0,0,24,24);const d=ctx.getImageData(0,0,24,24).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=4){if(d[i+3]<100)continue;r+=d[i];g+=d[i+1];b+=d[i+2];n++;}r/=n;g/=n;b/=n;const max=Math.max(r,g,b),min=Math.min(r,g,b),sat=max-min,bright=(r+g+b)/3;if(bright<55)return"黒";if(bright>215&&sat<35)return"白";if(sat<35)return"グレー";if(b>r*1.2&&b>g*1.1)return bright<115?"ネイビー":"青";if(r>g*1.25&&r>b*1.25)return"赤";if(r>90&&g>55&&g<r*.85&&b<g*.9)return bright<130?"ブラウン":"ベージュ";if(g>r*1.05&&g>b*1.1)return"グリーン";return"その他";}catch(e){return"その他";}}

async function loadWeather(){const fallback=()=>{weather={area:"現在地",condition:"晴れ",temperature:28,rainChance:20,yesterday:"取得できませんでした"};render();};if(!navigator.geolocation)return fallback();navigator.geolocation.getCurrentPosition(async p=>{try{const {latitude,longitude}=p.coords,url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,precipitation_probability_max&past_days=1&forecast_days=2&timezone=auto`,d=await fetch(url).then(r=>r.json()),label=c=>c>=51?"雨":c>=2?"くもり":"晴れ";weather={area:"現在地",condition:label(d.current.weather_code),temperature:Math.round(d.current.temperature_2m),rainChance:d.daily.precipitation_probability_max[1]||0,yesterday:`${label(d.daily.weather_code[0])} ${Math.round(d.daily.temperature_2m_max[0])}℃`};render();}catch(e){fallback();}},fallback,{timeout:8000});}

render();loadWeather();if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
