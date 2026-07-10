"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Kind = "shirt" | "pants" | "shoes";
type Tab = "today" | "master" | "history" | "analysis";
type Rain = "good" | "normal" | "bad";

type Item = {
  id: string;
  kind: Kind;
  name: string;
  brand: string;
  color: string;
  imageUrl: string;
  favorite: boolean;
  useCount: number;
  lastUsed: string;
  formal: number;
  tags: string[];
  subtype: string;
  sleeve: string;
  pattern: string;
  length: string;
  material: string;
  walk: number;
  easyOff: number;
  rain: Rain;
  maintenanceDate: string;
  maintenanceCount: number;
};

type History = {
  id: string;
  date: string;
  plan: string;
  weather: string;
  shirt: string;
  pants: string;
  shoes: string;
  reason: string;
};

type Weather = {
  area: string;
  condition: string;
  temperature: number;
  rainChance: number;
  yesterday: string;
};

type AppState = { items: Item[]; histories: History[] };

const colors = ["白", "黒", "グレー", "ネイビー", "青", "ベージュ", "ブラウン", "グリーン", "赤", "その他"];
const plans = ["仕事", "営業", "休日", "長時間歩く", "雨", "旅行", "フォーマル"];

const sampleItems: Item[] = [
  makeItem("shirt", "白シャツ", "白", { id: "sample-shirt-white", brand: "無印良品", subtype: "シャツ", sleeve: "長袖", pattern: "無地", formal: 4 }),
  makeItem("pants", "ネイビースラックス", "ネイビー", { id: "sample-pants-navy", brand: "UNIQLO", subtype: "スラックス", length: "ロング", formal: 4 }),
  makeItem("shoes", "黒ローファー", "黒", { id: "sample-shoes-loafer", brand: "REGAL", subtype: "ローファー", material: "スムースレザー", formal: 4, walk: 4, easyOff: 5, favorite: true, useCount: 12 }),
  makeItem("shoes", "茶スニーカー", "ブラウン", { id: "sample-shoes-sneaker", brand: "SKECHERS", subtype: "スニーカー", material: "メッシュ", formal: 2, walk: 5, easyOff: 4, rain: "bad", useCount: 3 }),
  makeItem("shoes", "黒プレーントゥ", "黒", { id: "sample-shoes-plain", brand: "SCOTCH GRAIN", subtype: "プレーントゥ", material: "スムースレザー", formal: 5, walk: 3, rain: "good", useCount: 6 }),
];

function makeItem(kind: Kind, name = "", color = "その他", patch: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID(), kind, name, brand: "", color, imageUrl: "", favorite: false,
    useCount: 0, lastUsed: "未使用", formal: 3, tags: [kindLabel(kind), color], subtype: "未設定",
    sleeve: kind === "shirt" ? "未設定" : "", pattern: kind === "shirt" ? "未設定" : "",
    length: kind === "pants" ? "ロング" : "", material: kind === "shoes" ? "未設定" : "",
    walk: 3, easyOff: 3, rain: "normal", maintenanceDate: "未実施", maintenanceCount: 0, ...patch,
  };
}

function kindLabel(kind: Kind) { return kind === "shirt" ? "シャツ" : kind === "pants" ? "パンツ" : "靴"; }
function today() { return new Date().toISOString().slice(0, 10).replaceAll("-", "/"); }

function scoreShoes(shoes: Item[], shirt: Item | undefined, pants: Item | undefined, plan: string, weather: Weather) {
  return shoes.map((shoe) => {
    let score = 50;
    const reasons: string[] = [];
    if (["仕事", "営業", "フォーマル"].includes(plan)) {
      if (shoe.formal >= 4) { score += 22; reasons.push("仕事向きのフォーマル度"); }
      else { score -= 10; reasons.push("少しカジュアル"); }
    }
    if (plan === "休日" && shoe.formal <= 3) { score += 12; reasons.push("休日向き"); }
    if (plan === "長時間歩く") { score += shoe.walk * 6; reasons.push("歩きやすさを重視"); }
    if (weather.rainChance >= 50 || plan === "雨") {
      if (shoe.rain === "good") { score += 25; reasons.push("雨に強い"); }
      if (shoe.rain === "bad") { score -= 30; reasons.push("雨には不向き"); }
      if (shoe.material === "スエード") { score -= 25; reasons.push("雨の日はスエードを避けたい"); }
    }
    if (shirt?.color === "白" && shoe.color === "黒") { score += 10; reasons.push("白シャツと黒靴の相性"); }
    if (pants?.color === "ネイビー" && ["黒", "ブラウン"].includes(shoe.color)) { score += 10; reasons.push("ネイビーパンツと相性"); }
    if (pants?.color === "グレー" && shoe.color === "黒") { score += 10; reasons.push("グレーパンツと相性"); }
    if (shoe.favorite) { score += 8; reasons.push("お気に入り"); }
    if (shoe.useCount === 0) { score += 12; reasons.push("まだ履いていない"); }
    if (shoe.lastUsed === today()) { score -= 25; reasons.push("今日は使用済み"); }
    return { shoe, score: Math.max(0, Math.min(100, score)), reason: reasons.length ? reasons.join("・") : "全体のバランスが良い" };
  }).sort((a, b) => b.score - a.score).slice(0, 3);
}

export default function OutfitApp() {
  const [tab, setTab] = useState<Tab>("today");
  const [state, setState] = useState<AppState>({ items: sampleItems, histories: [] });
  const [ready, setReady] = useState(false);
  const [weather, setWeather] = useState<Weather>({ area: "現在地", condition: "取得中", temperature: 0, rainChance: 0, yesterday: "確認中" });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/state").then((r) => r.ok ? r.json() : null).then((saved) => {
      if (saved?.items) setState(saved);
    }).catch(() => {
      const local = localStorage.getItem("outfit-ai-backup");
      if (local) setState(JSON.parse(local));
    }).finally(() => setReady(true));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    loadWeather(setWeather);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("outfit-ai-backup", JSON.stringify(state));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => fetch("/api/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(state) }).catch(() => undefined), 500);
  }, [state, ready]);

  const updateItem = (item: Item) => setState((s) => ({ ...s, items: s.items.some((x) => x.id === item.id) ? s.items.map((x) => x.id === item.id ? item : x) : [...s.items, item] }));
  const deleteItem = (id: string) => setState((s) => ({ ...s, items: s.items.filter((x) => x.id !== id) }));
  const recordWear = (shoe: Item, shirt: Item, pants: Item, plan: string, reason: string) => {
    const updated = { ...shoe, useCount: shoe.useCount + 1, lastUsed: today() };
    const history: History = { id: crypto.randomUUID(), date: today(), plan, weather: `${weather.condition} ${weather.temperature}℃`, shirt: shirt.name, pants: pants.name, shoes: shoe.name, reason };
    setState((s) => ({ items: s.items.map((x) => x.id === shoe.id ? updated : x), histories: [history, ...s.histories] }));
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">SHOES FIRST</p><h1>OUTFIT AI</h1></div>
        <div className="weather-pill"><span>{weather.condition === "雨" ? "☂" : "☀"}</span><div><strong>{weather.temperature || "--"}℃</strong><small>{weather.area}</small></div></div>
      </header>

      <section className="content">
        {tab === "today" && <Today items={state.items} weather={weather} onWear={recordWear} onHome={() => setTab("today")} />}
        {tab === "master" && <Master items={state.items} onSave={updateItem} onDelete={deleteItem} />}
        {tab === "history" && <HistoryView histories={state.histories} />}
        {tab === "analysis" && <Analysis items={state.items} histories={state.histories} />}
      </section>

      <nav className="tabbar" aria-label="メインメニュー">
        {([['today','今日','⌂'],['master','マスター','▦'],['history','履歴','◷'],['analysis','分析','▥']] as const).map(([id,label,icon]) =>
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><span>{icon}</span>{label}</button>
        )}
      </nav>
    </main>
  );
}

function Today({ items, weather, onWear, onHome }: { items: Item[]; weather: Weather; onWear: (s: Item, sh: Item, p: Item, plan: string, r: string) => void; onHome: () => void }) {
  const shirts = items.filter((x) => x.kind === "shirt");
  const pantsList = items.filter((x) => x.kind === "pants");
  const [shirtId, setShirtId] = useState(shirts[0]?.id || "");
  const [pantsId, setPantsId] = useState(pantsList[0]?.id || "");
  const [plan, setPlan] = useState("仕事");
  const [show, setShow] = useState(false);
  const [done, setDone] = useState<{ shoe: Item; reason: string } | null>(null);
  const shirt = shirts.find((x) => x.id === shirtId);
  const pants = pantsList.find((x) => x.id === pantsId);
  const results = useMemo(() => scoreShoes(items.filter((x) => x.kind === "shoes"), shirt, pants, plan, weather), [items, shirt, pants, plan, weather]);

  if (done && shirt && pants) return <Completion shirt={shirt} pants={pants} shoe={done.shoe} weather={weather} reason={done.reason} onClose={() => { setDone(null); setShow(false); onHome(); }} />;

  return <div className="stack">
    <section className="hero-card"><div><p className="eyebrow">TODAY</p><h2>今日の靴を決めましょう</h2><p>シャツとパンツはあなたが選び、靴だけを提案します。</p></div><div className="today-weather"><b>{weather.condition}</b><strong>{weather.temperature || "--"}℃</strong><small>降水 {weather.rainChance}%</small></div></section>
    <section className="panel"><h3>今日の条件</h3><div className="form-grid three"><label>予定<select value={plan} onChange={(e) => { setPlan(e.target.value); setShow(false); }}>{plans.map((x) => <option key={x}>{x}</option>)}</select></label><label>シャツ<select value={shirtId} onChange={(e) => { setShirtId(e.target.value); setShow(false); }}>{shirts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>パンツ<select value={pantsId} onChange={(e) => { setPantsId(e.target.value); setShow(false); }}>{pantsList.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div><div className="yesterday">昨日の天気：{weather.yesterday}</div><button className="primary" disabled={!shirt || !pants || !results.length} onClick={() => setShow(true)}>おすすめ3足を見る</button></section>
    {show && <section className="recommendations"><div className="section-title"><div><p className="eyebrow">RECOMMENDED</p><h3>おすすめの靴 3足</h3></div><span>天気・TPO・使用状況を反映</span></div>{results.map((r, i) => <article className={`shoe-card rank-${i+1}`} key={r.shoe.id}><div className="rank">{i+1}</div><ItemPhoto item={r.shoe}/><div className="shoe-copy"><div className="score"><b>{r.shoe.name}</b><strong>{r.score}<small>点</small></strong></div><p>{r.reason}</p><div className="tags">{r.shoe.tags.slice(0,3).map((t) => <span key={t}>{t}</span>)}</div><button className={i === 0 ? "primary" : "secondary"} onClick={() => { onWear(r.shoe, shirt!, pants!, plan, r.reason); setDone({ shoe: r.shoe, reason: r.reason }); }}>今日これを履く</button></div></article>)}</section>}
  </div>;
}

function Completion({ shirt, pants, shoe, weather, reason, onClose }: { shirt: Item; pants: Item; shoe: Item; weather: Weather; reason: string; onClose: () => void }) {
  return <section className="completion"><div className="check">✓</div><p className="eyebrow">RECORDED</p><h2>今日のコーデを記録しました</h2><p className="muted">{weather.condition}・{weather.temperature}℃</p><div className="outfit-row"><OutfitPiece item={shirt} label="シャツ"/><OutfitPiece item={pants} label="パンツ"/><OutfitPiece item={shoe} label="靴"/></div><div className="reason-box"><b>この靴を選んだ理由</b><p>{reason}</p></div><button className="primary" onClick={onClose}>メインに戻る</button></section>;
}

function OutfitPiece({ item, label }: { item: Item; label: string }) { return <div><ItemPhoto item={item}/><small>{label}</small><b>{item.name}</b></div>; }

function Master({ items, onSave, onDelete }: { items: Item[]; onSave: (i: Item) => void; onDelete: (id: string) => void }) {
  const [kind, setKind] = useState<Kind>("shirt");
  const [editing, setEditing] = useState<Item | null>(null);
  const filtered = items.filter((x) => x.kind === kind);
  return <div className="stack"><section className="section-title"><div><p className="eyebrow">WARDROBE</p><h2>マスター</h2></div><button className="primary compact" onClick={() => setEditing(makeItem(kind))}>＋ 登録</button></section><div className="segmented">{(["shirt","pants","shoes"] as Kind[]).map((x) => <button className={kind === x ? "active" : ""} onClick={() => setKind(x)} key={x}>{kindLabel(x)}</button>)}</div><section className="master-grid">{filtered.map((item) => <article className="item-card" key={item.id} onClick={() => setEditing(item)}><ItemPhoto item={item}/><div><div className="card-title"><b>{item.name}</b>{item.favorite && <span>★</span>}</div><p>{item.brand || "ブランド未設定"} / {item.color}</p><small>{item.kind === "shoes" ? `${item.subtype}・${item.material}・歩きやすさ${item.walk}` : `${item.subtype}${item.sleeve ? `・${item.sleeve}` : ""}`}</small><small>使用 {item.useCount}回・最終 {item.lastUsed}</small></div></article>)}</section>{editing && <Editor initial={editing} onCancel={() => setEditing(null)} onSave={(item) => { onSave(item); setEditing(null); }} onDelete={items.some((x) => x.id === editing.id) ? () => { onDelete(editing.id); setEditing(null); } : undefined}/>}</div>;
}

function Editor({ initial, onSave, onCancel, onDelete }: { initial: Item; onSave: (i: Item) => void; onCancel: () => void; onDelete?: () => void }) {
  const [item, setItem] = useState(initial);
  const [preview, setPreview] = useState(initial.imageUrl);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const tagRef = useRef<HTMLInputElement>(null);

  const receivePhoto = async (e: ChangeEvent<HTMLInputElement>, mode: "main" | "tag") => {
    const file = e.target.files?.[0]; if (!file) return;
    if (mode === "tag") { setItem((x) => ({ ...x, tags: [...new Set([...x.tags, "タグ読取済み"])], brand: x.brand || "候補を確認" })); return; }
    const url = await fileToDataUrl(file); setPreview(url);
    const color = await analyzeColor(file);
    setItem((x) => ({ ...x, color, name: x.name || `${color}${kindLabel(x.kind)}`, tags: [...new Set([kindLabel(x.kind), color, ...x.tags])] }));
    setBusy(true);
    try {
      const key = `${item.id}-${Date.now()}.jpg`;
      const res = await fetch(`/api/images/${key}`, { method: "PUT", headers: { "content-type": file.type || "image/jpeg" }, body: file });
      if (res.ok) { const data = await res.json(); setItem((x) => ({ ...x, imageUrl: data.url })); }
    } finally { setBusy(false); }
  };

  const reloadTags = () => tagRef.current?.click();
  return <div className="modal-backdrop" role="presentation"><section className="editor" role="dialog" aria-modal="true"><div className="editor-head"><div><p className="eyebrow">REGISTER & EDIT</p><h2>{kindLabel(item.kind)}の情報</h2></div><button className="icon-button" onClick={onCancel}>×</button></div><div className="photo-stage">{preview ? <img src={preview} alt="登録するアイテム"/> : <div className="photo-empty"><span>▧</span><b>写真を追加</b><small>撮影またはライブラリから選択</small></div>}</div><div className="photo-actions"><button className="secondary" onClick={() => cameraRef.current?.click()}>カメラで撮影</button><button className="secondary" onClick={() => libraryRef.current?.click()}>写真ライブラリ</button></div><input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={(e) => receivePhoto(e,"main")}/><input ref={libraryRef} hidden type="file" accept="image/*" onChange={(e) => receivePhoto(e,"main")}/><input ref={tagRef} hidden type="file" accept="image/*" capture="environment" onChange={(e) => receivePhoto(e,"tag")}/><p className="analysis-note">写真から色を仮入力しました。違う場合は下で修正できます。</p><div className="form-grid"><label>名前<input value={item.name} onChange={(e) => setItem({...item,name:e.target.value})}/></label><label>ブランド<input value={item.brand} onChange={(e) => setItem({...item,brand:e.target.value})} placeholder="未設定でも保存できます"/></label><label>色<select value={item.color} onChange={(e) => setItem({...item,color:e.target.value})}>{colors.map((x)=><option key={x}>{x}</option>)}</select></label><label>種類<input value={item.subtype} onChange={(e) => setItem({...item,subtype:e.target.value})}/></label>{item.kind === "shirt" && <><label>袖<select value={item.sleeve} onChange={(e)=>setItem({...item,sleeve:e.target.value})}>{["未設定","半袖","長袖","七分袖"].map(x=><option key={x}>{x}</option>)}</select></label><label>柄<select value={item.pattern} onChange={(e)=>setItem({...item,pattern:e.target.value})}>{["未設定","無地","ストライプ","チェック","プリント"].map(x=><option key={x}>{x}</option>)}</select></label></>}{item.kind === "pants" && <label>丈<select value={item.length} onChange={(e)=>setItem({...item,length:e.target.value})}>{["ロング","クロップド","ショート"].map(x=><option key={x}>{x}</option>)}</select></label>}{item.kind === "shoes" && <><label>素材<select value={item.material} onChange={(e)=>setItem({...item,material:e.target.value})}>{["未設定","スムースレザー","スエード","キャンバス","メッシュ","合皮"].map(x=><option key={x}>{x}</option>)}</select></label><label>雨対応<select value={item.rain} onChange={(e)=>setItem({...item,rain:e.target.value as Rain})}><option value="good">強い</option><option value="normal">普通</option><option value="bad">弱い</option></select></label><label>歩きやすさ <b>{item.walk}</b><input type="range" min="1" max="5" value={item.walk} onChange={(e)=>setItem({...item,walk:Number(e.target.value)})}/></label><label>脱ぎやすさ <b>{item.easyOff}</b><input type="range" min="1" max="5" value={item.easyOff} onChange={(e)=>setItem({...item,easyOff:Number(e.target.value)})}/></label></>}</div><div className="assist-box"><b>情報を追加・再解析</b><p>最初は写真だけで登録し、必要なときに情報を育てられます。</p><div><button className="secondary" onClick={reloadTags}>タグを撮影</button>{item.kind === "shoes" && <button className="secondary" onClick={reloadTags}>靴箱を撮影</button>}{item.kind === "shoes" && <button className="secondary" onClick={() => setItem({...item,maintenanceDate:today(),maintenanceCount:item.maintenanceCount+1})}>今日メンテナンスした</button>}</div></div><label className="favorite"><input type="checkbox" checked={item.favorite} onChange={(e)=>setItem({...item,favorite:e.target.checked})}/> お気に入り</label><div className="editor-actions">{onDelete && <button className="danger" onClick={onDelete}>削除</button>}<button className="secondary" onClick={onCancel}>キャンセル</button><button className="primary" disabled={busy || !item.name} onClick={() => onSave({...item,imageUrl:item.imageUrl || preview})}>{busy ? "写真を保存中…" : "この内容で保存"}</button></div></section></div>;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function analyzeColor(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas"); canvas.width = 24; canvas.height = 24;
  const ctx = canvas.getContext("2d"); if (!ctx) return "その他";
  ctx.drawImage(bitmap, 0, 0, 24, 24); const data = ctx.getImageData(0,0,24,24).data;
  let r=0,g=0,b=0,n=0; for(let i=0;i<data.length;i+=4){ if(data[i+3]<100) continue; r+=data[i];g+=data[i+1];b+=data[i+2];n++; }
  r/=n;g/=n;b/=n; const max=Math.max(r,g,b), min=Math.min(r,g,b), sat=max-min, bright=(r+g+b)/3;
  if(bright<55) return "黒"; if(bright>215 && sat<35) return "白"; if(sat<35) return "グレー";
  if(b>r*1.2 && b>g*1.1) return bright<115?"ネイビー":"青"; if(r>g*1.25 && r>b*1.25) return "赤";
  if(r>90 && g>55 && g<r*.85 && b<g*.9) return bright<130?"ブラウン":"ベージュ"; if(g>r*1.05 && g>b*1.1) return "グリーン";
  return "その他";
}

function HistoryView({ histories }: { histories: History[] }) { return <div className="stack"><section className="section-title"><div><p className="eyebrow">JOURNAL</p><h2>コーデ履歴</h2></div><span>{histories.length}件</span></section>{histories.length ? <section className="timeline">{histories.map((h)=><article key={h.id}><time>{h.date}</time><div><b>{h.shoes}</b><p>{h.shirt}・{h.pants}</p><small>{h.plan} / {h.weather}</small><small>{h.reason}</small></div></article>)}</section> : <Empty text="今日のコーデを決定すると、ここに記録されます。"/>}</div>; }

function Analysis({ items, histories }: { items: Item[]; histories: History[] }) {
  const shoes = items.filter((x)=>x.kind==="shoes").sort((a,b)=>b.useCount-a.useCount);
  return <div className="stack"><section className="section-title"><div><p className="eyebrow">INSIGHTS</p><h2>靴の分析</h2></div></section><section className="stats"><div><strong>{shoes.length}</strong><span>登録靴</span></div><div><strong>{histories.length}</strong><span>コーデ履歴</span></div><div><strong>{shoes.filter(x=>x.useCount===0).length}</strong><span>未使用</span></div><div><strong>{shoes.filter(x=>x.maintenanceCount===0).length}</strong><span>手入れ未実施</span></div></section><section className="panel"><h3>使用回数ランキング</h3>{shoes.map((s,i)=><div className="ranking" key={s.id}><span>{i+1}</span><ItemPhoto item={s}/><div><b>{s.name}</b><small>最終使用 {s.lastUsed}</small></div><strong>{s.useCount}回</strong></div>)}</section><section className="panel"><h3>メンテナンス</h3>{shoes.map((s)=><div className="maintenance" key={s.id}><div><b>{s.name}</b><small>最終手入れ {s.maintenanceDate}</small></div><span className={s.maintenanceCount===0?"warning":"ok"}>{s.maintenanceCount===0?"確認推奨":`${s.maintenanceCount}回`}</span></div>)}</section></div>;
}

function ItemPhoto({ item }: { item: Item }) { return item.imageUrl ? <img className="item-photo" src={item.imageUrl} alt={item.name}/> : <div className="item-photo placeholder">{item.kind === "shoes" ? "◡" : item.kind === "shirt" ? "♙" : "│"}</div>; }
function Empty({ text }: { text: string }) { return <section className="empty"><span>○</span><p>{text}</p></section>; }

function loadWeather(setWeather: (w: Weather) => void) {
  if (!navigator.geolocation) return setWeather({ area:"現在地", condition:"晴れ", temperature:28, rainChance:20, yesterday:"晴れ 27℃" });
  navigator.geolocation.getCurrentPosition(async ({coords}) => {
    try {
      const url=`https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,precipitation_probability_max&past_days=1&forecast_days=2&timezone=auto`;
      const d=await fetch(url).then(r=>r.json());
      const label=(code:number)=>code>=51?"雨":code>=2?"くもり":"晴れ";
      setWeather({area:"現在地",condition:label(d.current.weather_code),temperature:Math.round(d.current.temperature_2m),rainChance:d.daily.precipitation_probability_max[1]||0,yesterday:`${label(d.daily.weather_code[0])} ${Math.round(d.daily.temperature_2m_max[0])}℃`});
    } catch { setWeather({ area:"現在地", condition:"晴れ", temperature:28, rainChance:20, yesterday:"取得できませんでした" }); }
  },()=>setWeather({area:"現在地",condition:"晴れ",temperature:28,rainChance:20,yesterday:"位置情報未許可"}),{enableHighAccuracy:false,timeout:8000});
}
