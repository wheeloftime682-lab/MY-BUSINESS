import { useEffect, useMemo, useState } from "react";
import { supabase, isCloudConfigured } from "./supabase";
import {
  Home, BookOpen, Package, ChartNoAxesCombined, Users, Settings,
  Plus, Search, Bell, ArrowDownLeft, ArrowUpRight, Wallet,
  TrendingUp, ShoppingBag, Receipt, Download, Upload, Menu, X,
  Trash2, Pencil, ChevronRight, CircleDollarSign, Boxes, CalendarDays, LogOut
} from "lucide-react";

type TxType = "sale" | "purchase" | "expense" | "collection" | "payment";
type Tx = { id: string; type: TxType; title: string; party: string; amount: number; date: string; note?: string };
type Customer = { id: string; name: string; phone: string; opening: number; kind: "customer" | "supplier" };
type Product = { id: string; name: string; sku: string; stock: number; buy: number; sell: number };
type SamitiPayout = { id: string; amount: number; date: string };
type SamitiMember = { id: string; name: string; phone: string; deposit: number; monthlyPayout: number; startDate: string; payouts: SamitiPayout[]; note?: string };
type DebtEntry = { id:string; kind:"increase"|"settlement"; amount:number; date:string };
type DebtAccount = { id:string; direction:"payable"|"receivable"; name:string; phone:string; opening:number; date:string; note?:string; entries:DebtEntry[] };

const today = () => { const d = new Date(); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,"0"); const day = String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; };
const initialTx: Tx[] = [];
const initialCustomers: Customer[] = [];
const initialProducts: Product[] = [];
const initialSamiti: SamitiMember[] = [];

function read<T,>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
}
const money = (n: number) => "৳" + Math.round(n).toLocaleString("en-BD");
const dateLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("bn-BD", { day:"numeric", month:"short", year:"numeric" });

function BusinessWorkspace({ onAccountClick, accountLabel }: { onAccountClick: () => void; accountLabel?: string }) {
  const [page, setPage] = useState("home");
  const [transactions, setTransactions] = useState<Tx[]>(() => read("mb-tx", initialTx));
  const [customers, setCustomers] = useState<Customer[]>(() => read("mb-customers", initialCustomers));
  const [products, setProducts] = useState<Product[]>(() => read("mb-products", initialProducts));
  const [samitiMembers, setSamitiMembers] = useState<SamitiMember[]>(() => read("mb-samiti", initialSamiti));
  const [debtAccounts, setDebtAccounts] = useState<DebtAccount[]>(() => read("mb-debts", []));
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<"transaction"|"customer"|"product"|"samiti"|"debt"|null>(null);
  const [editing, setEditing] = useState<string|null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [form, setForm] = useState<Record<string,string>>({ type:"sale", title:"", party:"", amount:"", date:today(), note:"" });

  useEffect(() => { localStorage.setItem("mb-tx", JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem("mb-customers", JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem("mb-products", JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem("mb-samiti", JSON.stringify(samitiMembers)); }, [samitiMembers]);
  useEffect(() => { localStorage.setItem("mb-debts", JSON.stringify(debtAccounts)); }, [debtAccounts]);

  const totals = useMemo(() => {
    const sum = (types: TxType[]) => transactions.filter(t => types.includes(t.type)).reduce((a,t)=>a+t.amount,0);
    const sales = sum(["sale"]), purchases = sum(["purchase"]), expenses = sum(["expense"]);
    return { sales, purchases, expenses, profit: sales-purchases-expenses, receivable: customers.filter(c=>c.kind==="customer").reduce((a,c)=>a+c.opening,0), payable: customers.filter(c=>c.kind==="supplier").reduce((a,c)=>a+c.opening,0) };
  }, [transactions, customers]);

  const nav = [
    { id:"home", label:"হোম", en:"Home", icon:Home },
    { id:"ledger", label:"হিসাব", en:"Ledger", icon:BookOpen },
    { id:"products", label:"পণ্য", en:"Products", icon:Package },
    { id:"customers", label:"কাস্টমার", en:"Parties", icon:Users },
    { id:"samiti", label:"সমিতি", en:"Samiti", icon:CircleDollarSign },
    { id:"debts", label:"দেনা-পাওনা", en:"Due Accounts", icon:Wallet },
    { id:"reports", label:"রিপোর্ট", en:"Reports", icon:ChartNoAxesCombined },
  ];
  const openModal = (m: "transaction"|"customer"|"product"|"samiti"|"debt") => {
    setEditing(null);
    setForm({ type:"sale", title:"", party:"", amount:"", date:today(), note:"", name:"", phone:"", kind:"customer", sku:"", stock:"0", buy:"0", sell:"0", deposit:"", monthlyPayout:"", startDate:today(), direction:"payable", opening:"" });
    setModal(m);
  };
  const saveTransaction = () => {
    const amount = Number(form.amount);
    if (!form.title.trim() || !amount || amount <= 0) return alert("বিবরণ ও সঠিক টাকার পরিমাণ দিন।");
    const tx: Tx = { id: editing || crypto.randomUUID(), type:form.type as TxType, title:form.title, party:form.party, amount, date:form.date || today(), note:form.note };
    setTransactions(old => editing ? old.map(t=>t.id===editing?tx:t) : [tx,...old]);
    setModal(null);
  };
  const saveCustomer = () => {
    const opening=Number(form.opening||0);
    if (!form.name?.trim() || !Number.isFinite(opening) || opening<0) return alert("সঠিক নাম ও প্রারম্ভিক বাকি লিখুন।");
    const c: Customer = { id:editing||crypto.randomUUID(), name:form.name.trim(), phone:form.phone||"", opening, kind:(form.kind as "customer"|"supplier")||"customer" };
    setCustomers(old=>editing?old.map(x=>x.id===editing?c:x):[c,...old]); setModal(null); setEditing(null);
  };
  const saveProduct = () => {
    const stock=Number(form.stock||0), buy=Number(form.buy||0), sell=Number(form.sell||0);
    if (!form.name?.trim() || ![stock,buy,sell].every(n=>Number.isFinite(n)&&n>=0)) return alert("পণ্যের নাম এবং শূন্য বা তার বেশি সঠিক সংখ্যা দিন।");
    const p: Product = { id:editing||crypto.randomUUID(), name:form.name.trim(), sku:form.sku||"", stock, buy, sell };
    setProducts(old=>editing?old.map(x=>x.id===editing?p:x):[p,...old]); setModal(null); setEditing(null);
  };
  const saveSamiti = () => {
    const deposit=Number(form.deposit), monthlyPayout=Number(form.monthlyPayout);
    if (!form.name?.trim() || ![deposit,monthlyPayout].every(n=>Number.isFinite(n)&&n>0)) return alert("সদস্যের নাম, জমার মূল টাকা ও মাসিক প্রদেয় টাকা দিন।");
    const previous=samitiMembers.find(x=>x.id===editing);
    const member:SamitiMember={id:editing||crypto.randomUUID(),name:form.name.trim(),phone:form.phone||"",deposit,monthlyPayout,startDate:form.startDate||today(),payouts:previous?.payouts||[],note:form.note};
    setSamitiMembers(old=>editing?old.map(x=>x.id===editing?member:x):[member,...old]); setModal(null); setEditing(null);
  };
  const deleteCustomer=(id:string)=>{if(confirm("এই পার্টির তথ্য মুছবেন?"))setCustomers(old=>old.filter(x=>x.id!==id));};
  const deleteProduct=(id:string)=>{if(confirm("এই পণ্যটি মুছবেন?"))setProducts(old=>old.filter(x=>x.id!==id));};
  const deleteSamiti=(id:string)=>{if(confirm("এই সদস্য ও তার প্রদানের ইতিহাস মুছবেন?"))setSamitiMembers(old=>old.filter(x=>x.id!==id));};
  const recordSamitiPayout = (id:string) => {
    const m=samitiMembers.find(x=>x.id===id); if(!m)return;
    const raw=prompt(`${m.name} — কত টাকা প্রদান করেছেন?`,String(m.monthlyPayout)); if(raw===null)return;
    const amount=Number(raw); if(!Number.isFinite(amount)||amount<=0)return alert("সঠিক টাকার পরিমাণ দিন।");
    setSamitiMembers(old=>old.map(x=>x.id===id?{...x,payouts:[...(x.payouts||[]),{id:crypto.randomUUID(),amount,date:today()}]}:x));
  };
  const saveDebt = () => {
    const opening=Number(form.opening);
    if(!form.name?.trim()||!Number.isFinite(opening)||opening<=0)return alert("নাম ও শুরুর টাকার সঠিক পরিমাণ দিন।");
    const previous=debtAccounts.find(x=>x.id===editing);
    const a:DebtAccount={id:editing||crypto.randomUUID(),direction:(form.direction as "payable"|"receivable")||"payable",name:form.name.trim(),phone:form.phone||"",opening,date:form.date||today(),note:form.note,entries:previous?.entries||[]};
    setDebtAccounts(old=>editing?old.map(x=>x.id===editing?a:x):[a,...old]);setModal(null);setEditing(null);
  };
  const balance=(a:DebtAccount)=>a.opening+(a.entries||[]).filter(e=>e.kind==="increase").reduce((n,e)=>n+e.amount,0)-(a.entries||[]).filter(e=>e.kind==="settlement").reduce((n,e)=>n+e.amount,0);
  const addDebtEntry=(id:string,k:"increase"|"settlement")=>{
    const a=debtAccounts.find(x=>x.id===id);if(!a)return;
    const promptText=k==="increase"?"নতুন বাকি টাকার পরিমাণ লিখুন":"পরিশোধ / আদায় করা টাকার পরিমাণ লিখুন";
    const raw=prompt(promptText,"0");if(raw===null)return;const amount=Number(raw);if(!Number.isFinite(amount)||amount<=0)return alert("সঠিক টাকার পরিমাণ দিন।");
    if(k==="settlement"&&amount>balance(a))return alert("বর্তমান বকেয়ার চেয়ে বেশি পরিশোধ/আদায় করা যাবে না।");
    setDebtAccounts(old=>old.map(x=>x.id===id?{...x,entries:[...(x.entries||[]),{id:crypto.randomUUID(),kind:k,amount,date:today()}]}:x));
  };
  const deleteDebt=(id:string)=>{if(confirm("এই রেকর্ডটি মুছবেন?"))setDebtAccounts(old=>old.filter(x=>x.id!==id));};
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ app:"MY BUSINESS", schemaVersion:1, transactions, customers, products, samitiMembers, debtAccounts, exportedAt:new Date().toISOString() }, null, 2)], {type:"application/json"});
    const url=URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download=`my-business-backup-${today()}.json`; a.click(); window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const importData = (file?: File) => {
    if (!file) return;
    if(file.size>15*1024*1024){alert("Backup ফাইল ১৫ MB-এর বেশি হতে পারবে না।");return;}
    const r = new FileReader(); r.onload = () => { try {
      const d=JSON.parse(String(r.result));
      const isArray=(v:unknown)=>Array.isArray(v);
      if(!d||!isArray(d.transactions)||!isArray(d.customers)||!isArray(d.products)||
        (d.samitiMembers!==undefined&&!isArray(d.samitiMembers))||(d.debtAccounts!==undefined&&!isArray(d.debtAccounts))) throw new Error("invalid backup");
      if(!confirm("বর্তমান হিসাবের সব তথ্য Backup-এর তথ্য দিয়ে প্রতিস্থাপন হবে। চালিয়ে যাবেন?"))return;
      setTransactions(d.transactions);setCustomers(d.customers);setProducts(d.products);setSamitiMembers(d.samitiMembers||[]);setDebtAccounts(d.debtAccounts||[]);alert("Backup Restore সফল হয়েছে।");
    } catch { alert("ফাইলটি সঠিক MY BUSINESS Backup নয় অথবা ক্ষতিগ্রস্ত।"); } }; r.onerror=()=>alert("Backup ফাইল পড়া যায়নি।"); r.readAsText(file);
  };
  const filteredTx = transactions.filter(t => (t.title+" "+t.party).toLowerCase().includes(query.toLowerCase()));
  const deleteTx = (id:string) => { if(confirm("এই হিসাবটি মুছে ফেলবেন?")) setTransactions(old=>old.filter(t=>t.id!==id)); };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu?"show":""}`}>
      <div className="brand"><div className="brand-mark">MB</div><div><strong>MY BUSINESS</strong><small>Business Manager</small></div><button className="close-menu" onClick={()=>setMobileMenu(false)}><X size={18}/></button></div>
      <button type="button" className="workspace workspace-button" onClick={onAccountClick} aria-label="বিজনেস অ্যাকাউন্ট খুলুন"><span className="avatar">M</span><div><b>আমার ব্যবসা</b><small>{accountLabel || "বিজনেস অ্যাকাউন্ট · Login"}</small></div><ChevronRight size={16}/></button>
      <div className="nav-caption">WORKSPACE</div>
      <nav>{nav.map(n=><button key={n.id} className={page===n.id?"active":""} onClick={()=>{setPage(n.id);setMobileMenu(false)}}><n.icon size={19}/><span>{n.label}</span><small>{n.en}</small></button>)}</nav>
      <div className="sidebar-bottom"><button onClick={()=>setPage("settings")} className={page==="settings"?"active":""}><Settings size={19}/>Settings</button><div className="side-note">সহজ হিসাব, সুন্দর ব্যবসা।</div></div>
    </aside>
    {mobileMenu && <div className="scrim" onClick={()=>setMobileMenu(false)}/>}
    <main className="main">
      <header className="topbar"><button className="menu-btn" onClick={()=>setMobileMenu(true)}><Menu/></button><div><div className="crumb">MY BUSINESS <span>/</span> {nav.find(n=>n.id===page)?.label || "Settings"}</div><h1>{nav.find(n=>n.id===page)?.label || "সেটিংস"}</h1></div><div className="top-actions"><span className="today-pill"><CalendarDays size={15}/>{dateLabel(today())}</span><button className="icon-btn" title="Notifications"><Bell size={19}/></button><button type="button" className="profile-chip profile-button" onClick={onAccountClick} aria-label="অ্যাকাউন্ট খুলুন">M</button></div></header>

      {page==="home" && <section className="content">
        <div className="welcome-row"><div><h2>স্বাগতম! 👋</h2><p>আজকের ব্যবসার অবস্থা এক নজরে দেখে নিন।</p></div><button className="primary" onClick={()=>openModal("transaction")}><Plus size={18}/> নতুন হিসাব</button></div>
        <div className="stats-grid">
          <Stat title="মোট বিক্রি" en="Total Sales" value={money(totals.sales)} icon={<TrendingUp/>} tone="green"/>
          <Stat title="মোট ক্রয়" en="Total Purchase" value={money(totals.purchases)} icon={<ShoppingBag/>} tone="blue"/>
          <Stat title="মোট খরচ" en="Total Expenses" value={money(totals.expenses)} icon={<Receipt/>} tone="orange"/>
          <Stat title="আনুমানিক লাভ" en="Estimated Profit" value={money(totals.profit)} icon={<Wallet/>} tone="purple"/>
        </div>
        <div className="two-col">
          <div className="panel"><div className="panel-head"><div><h3>সাম্প্রতিক লেনদেন</h3><p>Recent Transactions</p></div><button className="text-btn" onClick={()=>setPage("ledger")}>সব দেখুন <ChevronRight size={15}/></button></div><TransactionList items={transactions.slice(0,5)} onDelete={deleteTx}/></div>
          <div className="panel"><div className="panel-head"><div><h3>ব্যবসার সারাংশ</h3><p>Business Overview</p></div><span className="soft-tag">All time</span></div><div className="overview-line"><span>মোট পাওনা</span><b className="green-text">{money(totals.receivable)}</b></div><div className="overview-line"><span>মোট দেনা</span><b className="red-text">{money(totals.payable)}</b></div><div className="overview-line"><span>মোট পণ্য</span><b>{products.length} টি</b></div><div className="overview-line"><span>কাস্টমার ও সাপ্লায়ার</span><b>{customers.length} জন</b></div><div className="quick-actions"><button onClick={()=>openModal("customer")}><Plus size={16}/> কাস্টমার যোগ</button><button onClick={()=>openModal("product")}><Plus size={16}/> পণ্য যোগ</button></div></div>
        </div>
        <div className="quick-grid"><Quick icon={<ArrowDownLeft/>} title="বিক্রি এন্ট্রি" desc="নতুন বিক্রির হিসাব" onClick={()=>{openModal("transaction");setForm(f=>({...f,type:"sale",title:"বিক্রি"}))}}/><Quick icon={<ArrowUpRight/>} title="খরচ এন্ট্রি" desc="ব্যবসার খরচ লিখুন" onClick={()=>{openModal("transaction");setForm(f=>({...f,type:"expense",title:"খরচ"}))}}/><Quick icon={<Users/>} title="নতুন কাস্টমার" desc="কাস্টমার তালিকায় যোগ" onClick={()=>openModal("customer")}/><Quick icon={<Boxes/>} title="নতুন পণ্য" desc="স্টকে পণ্য যোগ করুন" onClick={()=>openModal("product")}/></div>
      </section>}

      {page==="ledger" && <section className="content"><div className="section-head"><div><h2>লেনদেনের হিসাব</h2><p>সকল বিক্রি, ক্রয়, খরচ ও টাকা আদায়ের তালিকা</p></div><button className="primary" onClick={()=>openModal("transaction")}><Plus size={18}/> নতুন হিসাব</button></div><div className="panel"><div className="toolbar"><div className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="বিবরণ বা পার্টির নাম খুঁজুন..."/></div><span className="soft-tag">{filteredTx.length} টি এন্ট্রি</span></div><TransactionList items={filteredTx} onDelete={deleteTx} onEdit={t=>{setEditing(t.id);setForm({type:t.type,title:t.title,party:t.party,amount:String(t.amount),date:t.date,note:t.note||""});setModal("transaction")}}/></div></section>}

      {page==="products" && <section className="content"><div className="section-head"><div><h2>পণ্য ও স্টক</h2><p>Product & Inventory Management</p></div><button className="primary" onClick={()=>openModal("product")}><Plus size={18}/> পণ্য যোগ করুন</button></div><div className="stats-grid compact"><Stat title="মোট পণ্য" en="Total Products" value={String(products.length)} icon={<Package/>} tone="green"/><Stat title="মোট স্টক ইউনিট" en="Stock Units" value={String(products.reduce((a,p)=>a+p.stock,0))} icon={<Boxes/>} tone="blue"/><Stat title="স্টকের ক্রয়মূল্য" en="Stock Value" value={money(products.reduce((a,p)=>a+p.stock*p.buy,0))} icon={<CircleDollarSign/>} tone="purple"/></div><div className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>পণ্যের নাম</th><th>SKU</th><th>স্টক</th><th>ক্রয়মূল্য</th><th>বিক্রয়মূল্য</th><th>সম্ভাব্য লাভ/টি</th><th>অ্যাকশন</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td><b>{p.name}</b></td><td>{p.sku||"—"}</td><td><span className={p.stock<10?"low-stock":"stock"}>{p.stock} টি</span></td><td>{money(p.buy)}</td><td>{money(p.sell)}</td><td className="green-text">{money(p.sell-p.buy)}</td><td><button className="tiny-btn" title="Edit" onClick={()=>{setEditing(p.id);setForm({name:p.name,sku:p.sku,stock:String(p.stock),buy:String(p.buy),sell:String(p.sell)});setModal("product")}}><Pencil size={14}/></button><button className="tiny-btn danger" title="Delete" onClick={()=>deleteProduct(p.id)}><Trash2 size={14}/></button></td></tr>)}</tbody></table>{!products.length&&<Empty text="এখনো কোনো পণ্য যোগ করা হয়নি।"/>}</div></div></section>}

      {page==="customers" && <section className="content"><div className="section-head"><div><h2>কাস্টমার ও সাপ্লায়ার</h2><p>Customer & Supplier Directory</p></div><button className="primary" onClick={()=>openModal("customer")}><Plus size={18}/> নতুন পার্টি</button></div><div className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>নাম</th><th>ধরন</th><th>মোবাইল</th><th>প্রারম্ভিক বাকি</th><th>অ্যাকশন</th></tr></thead><tbody>{customers.map(c=><tr key={c.id}><td><b>{c.name}</b></td><td><span className={c.kind==="customer"?"type-customer":"type-supplier"}>{c.kind==="customer"?"কাস্টমার":"সাপ্লায়ার"}</span></td><td>{c.phone||"—"}</td><td>{money(c.opening)}</td><td><button className="tiny-btn" title="Edit" onClick={()=>{setEditing(c.id);setForm({name:c.name,phone:c.phone,opening:String(c.opening),kind:c.kind});setModal("customer")}}><Pencil size={14}/></button><button className="tiny-btn danger" title="Delete" onClick={()=>deleteCustomer(c.id)}><Trash2 size={14}/></button></td></tr>)}</tbody></table>{!customers.length&&<Empty text="কোনো কাস্টমার বা সাপ্লায়ার নেই।"/>}</div></div></section>}

      {page==="samiti" && <section className="content"><div className="section-head"><div><h2>সমিতির হিসাব</h2><p>জমার টাকা ও মাসিক প্রদানের হিসাব রাখুন</p></div><button className="primary" onClick={()=>openModal("samiti")}><Plus size={18}/> সদস্য যোগ করুন</button></div><div className="stats-grid compact"><Stat title="মোট সদস্য" en="Members" value={String(samitiMembers.length)} icon={<Users/>} tone="green"/><Stat title="মোট জমা" en="Total Deposits" value={money(samitiMembers.reduce((a,m)=>a+m.deposit,0))} icon={<Wallet/>} tone="blue"/><Stat title="মোট প্রদান" en="Total Paid Out" value={money(samitiMembers.reduce((a,m)=>a+(m.payouts||[]).reduce((x,p)=>x+p.amount,0),0))} icon={<ArrowUpRight/>} tone="purple"/></div><div className="samiti-grid">{samitiMembers.map(m=><div className="panel samiti-card" key={m.id}><div className="samiti-top"><div className="party-avatar">{m.name.slice(0,1)}</div><div className="samiti-person"><b>{m.name}</b><small>{m.phone||"মোবাইল নম্বর দেওয়া হয়নি"}</small></div><button className="tiny-btn" title="Edit" onClick={()=>{setEditing(m.id);setForm({name:m.name,phone:m.phone,deposit:String(m.deposit),monthlyPayout:String(m.monthlyPayout),startDate:m.startDate,note:m.note||""});setModal("samiti")}}><Pencil size={14}/></button><button className="tiny-btn danger" title="Delete" onClick={()=>deleteSamiti(m.id)}><Trash2 size={14}/></button></div><div className="samiti-values"><div><small>জমার মূল টাকা</small><b>{money(m.deposit)}</b></div><div><small>মাসিক প্রদেয়</small><b className="green-text">{money(m.monthlyPayout)}</b></div><div><small>এ পর্যন্ত প্রদান</small><b>{money((m.payouts||[]).reduce((a,p)=>a+p.amount,0))}</b></div><div><small>প্রদান হয়েছে</small><b>{(m.payouts||[]).length} মাস/বার</b></div></div><div className="samiti-footer"><small>শুরুর তারিখ: {dateLabel(m.startDate)}</small><button className="secondary" onClick={()=>recordSamitiPayout(m.id)}><Plus size={15}/> মাসিক টাকা প্রদান</button></div>{(m.payouts||[]).length>0&&<details className="payout-history"><summary>প্রদানের ইতিহাস দেখুন ({(m.payouts||[]).length})</summary>{(m.payouts||[]).slice().reverse().map(pay=><div className="payout-row" key={pay.id}><span>{dateLabel(pay.date)}</span><b>{money(pay.amount)}</b></div>)}</details>}</div>)}{!samitiMembers.length&&<div className="panel samiti-empty"><CircleDollarSign size={34}/><b>এখনো কোনো সমিতির সদস্য যোগ করা হয়নি</b><span>সদস্যের নাম, জমার মূল টাকা এবং মাসিক প্রদেয় টাকার পরিমাণ দিয়ে শুরু করুন।</span><button className="primary" onClick={()=>openModal("samiti")}><Plus size={17}/> প্রথম সদস্য যোগ করুন</button></div>}</div><p className="hint">এখানে জমার মূল টাকা ও মাসিক প্রদানের হিসাব আলাদাভাবে রাখা হয়। এটি নিজে থেকে লাভ, সুদ, মেয়াদ বা ফেরতযোগ্য মূলধন নির্ধারণ করে না—প্রকৃত চুক্তি অনুযায়ী তথ্য এন্ট্রি করুন।</p></section>}

      {page==="debts" && <section className="content"><div className="section-head"><div><h2>দেনা-পাওনার হিসাব</h2><p>আপনার দেনা ও পাওনা আলাদা করে রাখুন</p></div><button className="primary" onClick={()=>openModal("debt")}><Plus size={18}/> নতুন হিসাব</button></div><div className="stats-grid compact"><Stat title="আমার মোট দেনা" en="I Owe" value={money(debtAccounts.filter(a=>a.direction==="payable").reduce((n,a)=>n+balance(a),0))} icon={<ArrowUpRight/>} tone="orange"/><Stat title="আমার মোট পাওনা" en="They Owe Me" value={money(debtAccounts.filter(a=>a.direction==="receivable").reduce((n,a)=>n+balance(a),0))} icon={<ArrowDownLeft/>} tone="green"/><Stat title="মোট হিসাব" en="Accounts" value={String(debtAccounts.length)} icon={<Users/>} tone="blue"/></div><div className="debt-columns">{(["payable","receivable"] as const).map(dir=><div className="panel debt-panel" key={dir}><div className="panel-head"><div><h3>{dir==="payable"?"আমার দেনা (I Owe)":"আমার পাওনা (They Owe Me)"}</h3><p>{dir==="payable"?"যাদের টাকা আপনাকে দিতে হবে":"যাদের কাছ থেকে টাকা পাবেন"}</p></div></div>{debtAccounts.filter(a=>a.direction===dir).map(a=><div className="debt-item" key={a.id}><div className="debt-item-head"><div className="party-avatar">{a.name.slice(0,1)}</div><div className="samiti-person"><b>{a.name}</b><small>{a.phone||"মোবাইল নেই"} · {dateLabel(a.date)}</small></div><button className="tiny-btn" title="Edit" onClick={()=>{setEditing(a.id);setForm({direction:a.direction,name:a.name,phone:a.phone,opening:String(a.opening),date:a.date,note:a.note||""});setModal("debt")}}><Pencil size={14}/></button><button className="tiny-btn danger" onClick={()=>deleteDebt(a.id)}><Trash2 size={15}/></button></div><div className="debt-amount-line"><span>বর্তমান বাকি</span><b className={dir==="payable"?"red-text":"green-text"}>{money(balance(a))}</b></div><div className="debt-actions"><button className="secondary" onClick={()=>addDebtEntry(a.id,"settlement")}>টাকা {dir==="payable"?"পরিশোধ":"আদায়"}</button><button className="secondary" onClick={()=>addDebtEntry(a.id,"increase")}><Plus size={14}/> নতুন বাকি যোগ</button></div>{(a.entries||[]).length>0&&<details className="payout-history"><summary>ইতিহাস ({a.entries.length})</summary>{(a.entries||[]).slice().reverse().map(e=><div className="payout-row" key={e.id}><span>{dateLabel(e.date)} · {e.kind==="increase"?"বাকি বৃদ্ধি":"পরিশোধ / আদায়"}</span><b>{e.kind==="increase"?"+":"−"}{money(e.amount)}</b></div>)}</details>}</div>)}{!debtAccounts.some(a=>a.direction===dir)&&<div className="debt-empty"><Wallet size={24}/><span>এখনো কোনো হিসাব নেই।</span><button className="text-btn" onClick={()=>{openModal("debt");setForm(f=>({...f,direction:dir}))}}>+ হিসাব যোগ করুন</button></div>}</div>)}</div><p className="hint">এই হিসাব সমিতি ও সাধারণ ব্যবসার লেনদেন থেকে আলাদা।</p></section>}

      {page==="reports" && <section className="content"><div className="section-head"><div><h2>ব্যবসার রিপোর্ট</h2><p>Sales, Purchase & Profit Summary</p></div><button className="secondary" onClick={exportData}><Download size={17}/> Backup Export</button></div><div className="stats-grid"><Stat title="মোট বিক্রি" en="Sales" value={money(totals.sales)} icon={<TrendingUp/>} tone="green"/><Stat title="মোট ক্রয়" en="Purchase" value={money(totals.purchases)} icon={<ShoppingBag/>} tone="blue"/><Stat title="মোট খরচ" en="Expenses" value={money(totals.expenses)} icon={<Receipt/>} tone="orange"/><Stat title="আনুমানিক লাভ" en="Estimated Profit" value={money(totals.profit)} icon={<Wallet/>} tone="purple"/></div><div className="panel report-panel"><h3>লেনদেনের সারাংশ</h3>{[["বিক্রি",totals.sales],["ক্রয়",totals.purchases],["খরচ",totals.expenses]].map(([label,val])=><div className="report-row" key={String(label)}><span>{label}</span><b>{money(Number(val))}</b></div>)}<div className="report-row total"><span>আনুমানিক লাভ</span><b>{money(totals.profit)}</b></div><p className="hint">নোট: এটি প্রাথমিক সারাংশ। পূর্ণাঙ্গ লাভ-লোকসান রিপোর্টে পণ্যের ক্রয়মূল্য, স্টক ও অন্যান্য সমন্বয় যুক্ত করা হবে।</p></div></section>}

      {page==="settings" && <section className="content"><div className="section-head"><div><h2>সেটিংস</h2><p>App Settings & Data Management</p></div></div><div className="panel settings-panel"><div className="settings-row"><div><b>MY BUSINESS</b><p>Business Management & Accounting App</p></div><span className="soft-tag">Version 1.0</span></div><div className="settings-row"><div><b>মুদ্রা</b><p>বাংলাদেশি টাকা (BDT)</p></div><strong>৳ BDT</strong></div><div className="settings-row"><div><b>ডাটা Backup</b><p>আপনার হিসাব JSON ফাইলে সংরক্ষণ করুন।</p></div><button className="secondary" onClick={exportData}><Download size={16}/> Export</button></div><div className="settings-row"><div><b>Backup Restore</b><p>আগের Backup ফাইল থেকে হিসাব ফিরিয়ে আনুন।</p></div><label className="secondary file-btn"><Upload size={16}/> Import<input type="file" accept=".json,application/json" onChange={e=>importData(e.target.files?.[0])}/></label></div><p className="hint warning">Cloud Sync চালু থাকলে আপনার লগইন করা অ্যাকাউন্টে ডাটা সংরক্ষিত হবে। Offline অবস্থায় পরিবর্তন Local Browser-এ থাকবে এবং সংযোগ ফিরে এলে Sync হবে। নিয়মিত Backup রাখুন।</p></div></section>}
    </main>

    {modal && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null)}}><div className="modal"><div className="modal-head"><div><h3>{modal==="transaction"?(editing?"হিসাব সম্পাদনা":"নতুন হিসাব"):modal==="customer"?(editing?"পার্টি সম্পাদনা":"নতুন কাস্টমার / সাপ্লায়ার"):modal==="product"?(editing?"পণ্য সম্পাদনা":"নতুন পণ্য"):modal==="samiti"?(editing?"সমিতির সদস্য সম্পাদনা":"সমিতির সদস্য যোগ করুন"):modal==="debt"?(editing?"দেনা-পাওনার হিসাব সম্পাদনা":"দেনা-পাওনার হিসাব যোগ করুন"):"হিসাব"}</h3><p>{modal==="transaction"?"Transaction Entry":modal==="customer"?"Party Details":modal==="product"?"Product Details":modal==="samiti"?"Samiti Member Details":"Due Account Details"}</p></div><button className="icon-btn" onClick={()=>setModal(null)}><X/></button></div>
      {modal==="transaction" && <div className="form-grid"><label>হিসাবের ধরন<select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}><option value="sale">বিক্রি (Sales)</option><option value="purchase">ক্রয় (Purchase)</option><option value="expense">খরচ (Expense)</option><option value="collection">বকেয়া আদায় (Collection)</option><option value="payment">সাপ্লায়ার পেমেন্ট (Payment)</option></select></label><label>বিবরণ<input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="যেমন: পণ্য বিক্রি"/></label><label>কাস্টমার / সাপ্লায়ার<input value={form.party} onChange={e=>setForm(f=>({...f,party:e.target.value}))} placeholder="নাম (ঐচ্ছিক)"/></label><label>টাকার পরিমাণ (৳)<input type="number" min="0" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0"/></label><label>তারিখ<input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></label><label className="full">নোট (ঐচ্ছিক)<textarea value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/></label></div>}
      {modal==="customer" && <div className="form-grid"><label>নাম<input value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="নাম লিখুন"/></label><label>ধরন<select value={form.kind||"customer"} onChange={e=>setForm(f=>({...f,kind:e.target.value}))}><option value="customer">কাস্টমার</option><option value="supplier">সাপ্লায়ার</option></select></label><label>মোবাইল নম্বর<input value={form.phone||""} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="01XXXXXXXXX"/></label><label>প্রারম্ভিক বাকি (৳)<input type="number" value={form.opening||""} onChange={e=>setForm(f=>({...f,opening:e.target.value}))} placeholder="0"/></label></div>}
      {modal==="product" && <div className="form-grid"><label>পণ্যের নাম<input value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="পণ্যের নাম"/></label><label>SKU / কোড<input value={form.sku||""} onChange={e=>setForm(f=>({...f,sku:e.target.value}))} placeholder="যেমন: PR-001"/></label><label>স্টক পরিমাণ<input type="number" value={form.stock||""} onChange={e=>setForm(f=>({...f,stock:e.target.value}))}/></label><label>ক্রয়মূল্য (৳)<input type="number" value={form.buy||""} onChange={e=>setForm(f=>({...f,buy:e.target.value}))}/></label><label>বিক্রয়মূল্য (৳)<input type="number" value={form.sell||""} onChange={e=>setForm(f=>({...f,sell:e.target.value}))}/></label></div>}
      {modal==="debt" && <div className="form-grid"><label>হিসাবের ধরন<select value={form.direction||"payable"} onChange={e=>setForm(f=>({...f,direction:e.target.value}))}><option value="payable">আমার দেনা — আমাকে টাকা দিতে হবে</option><option value="receivable">আমার পাওনা — আমি টাকা পাব</option></select></label><label>ব্যক্তি / প্রতিষ্ঠানের নাম<input value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></label><label>মোবাইল নম্বর<input value={form.phone||""} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></label><label>শুরুর বাকি টাকা (৳)<input type="number" min="1" value={form.opening||""} onChange={e=>setForm(f=>({...f,opening:e.target.value}))}/></label><label>তারিখ<input type="date" value={form.date||today()} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></label><label className="full">নোট<textarea value={form.note||""} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/></label></div>}
      {modal==="samiti" && <div className="form-grid"><label>সদস্যের নাম<input value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="সদস্যের নাম লিখুন"/></label><label>মোবাইল নম্বর<input value={form.phone||""} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="01XXXXXXXXX"/></label><label>জমার মূল টাকা (৳)<input type="number" min="1" value={form.deposit||""} onChange={e=>setForm(f=>({...f,deposit:e.target.value}))} placeholder="যেমন: 100000"/></label><label>মাসিক প্রদেয় টাকা (৳)<input type="number" min="1" value={form.monthlyPayout||""} onChange={e=>setForm(f=>({...f,monthlyPayout:e.target.value}))} placeholder="যেমন: 4000"/></label><label>শুরুর তারিখ<input type="date" value={form.startDate||today()} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))}/></label><label className="full">নোট (ঐচ্ছিক)<textarea value={form.note||""} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="চুক্তি বা অতিরিক্ত তথ্য"/></label></div>}
      <div className="modal-actions"><button className="secondary" onClick={()=>setModal(null)}>বাতিল</button><button className="primary" onClick={modal==="transaction"?saveTransaction:modal==="customer"?saveCustomer:modal==="product"?saveProduct:modal==="samiti"?saveSamiti:saveDebt}>সংরক্ষণ করুন</button></div>
    </div></div>}
  </div>;
}

function Stat({title,en,value,icon,tone}:{title:string;en:string;value:string;icon:React.ReactNode;tone:string}) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div><p>{title} <small>{en}</small></p><strong>{value}</strong></div></div>;
}
function Quick({icon,title,desc,onClick}:{icon:React.ReactNode;title:string;desc:string;onClick:()=>void}) {
  return <button className="quick-card" onClick={onClick}><span className="quick-icon">{icon}</span><span><b>{title}</b><small>{desc}</small></span><ChevronRight size={17}/></button>;
}
function TransactionList({items,onDelete,onEdit}:{items:Tx[];onDelete:(id:string)=>void;onEdit?:(t:Tx)=>void}) {
  const meta:Record<TxType,{label:string;sign:string;cls:string}> = {sale:{label:"বিক্রি",sign:"+",cls:"positive"},purchase:{label:"ক্রয়",sign:"−",cls:"negative"},expense:{label:"খরচ",sign:"−",cls:"negative"},collection:{label:"বকেয়া আদায়",sign:"+",cls:"positive"},payment:{label:"পেমেন্ট",sign:"−",cls:"negative"}};
  if(!items.length) return <Empty text="কোনো লেনদেন পাওয়া যায়নি।"/>;
  return <div className="tx-list">{items.map(t=><div className="tx-row" key={t.id}><div className={`tx-icon ${meta[t.type].cls}`}>{t.type==="sale"?<ShoppingBag size={18}/>:t.type==="expense"?<Receipt size={18}/>:<ArrowUpRight size={18}/>}</div><div className="tx-info"><b>{t.title}</b><small>{t.party||meta[t.type].label} · {dateLabel(t.date)}</small></div><div className="tx-amount"><b className={meta[t.type].cls}>{meta[t.type].sign}{money(t.amount)}</b><small>{meta[t.type].label}</small></div>{onEdit&&<button className="tiny-btn" title="Edit" onClick={()=>onEdit(t)}><Pencil size={15}/></button>}<button className="tiny-btn danger" title="Delete" onClick={()=>onDelete(t.id)}><Trash2 size={15}/></button></div>)}</div>;
}
function Empty({text}:{text:string}) { return <div className="empty"><BookOpen size={25}/><span>{text}</span></div>; }


type CloudPayload = {
  transactions: Tx[];
  customers: Customer[];
  products: Product[];
  samitiMembers: SamitiMember[];
  debtAccounts: DebtAccount[];
};

function getLocalPayload(): CloudPayload {
  return {
    transactions: read("mb-tx", []),
    customers: read("mb-customers", []),
    products: read("mb-products", []),
    samitiMembers: read("mb-samiti", []),
    debtAccounts: read("mb-debts", []),
  };
}
function putLocalPayload(data: Partial<CloudPayload>) {
  if (data.transactions) localStorage.setItem("mb-tx", JSON.stringify(data.transactions));
  if (data.customers) localStorage.setItem("mb-customers", JSON.stringify(data.customers));
  if (data.products) localStorage.setItem("mb-products", JSON.stringify(data.products));
  if (data.samitiMembers) localStorage.setItem("mb-samiti", JSON.stringify(data.samitiMembers));
  if (data.debtAccounts) localStorage.setItem("mb-debts", JSON.stringify(data.debtAccounts));
}
function clearLocalPayload() {
  ["mb-tx","mb-customers","mb-products","mb-samiti","mb-debts"].forEach(key=>localStorage.removeItem(key));
}

function AuthScreen({ onSignedIn, onClose, configured = true }: { onSignedIn: () => void; onClose?: () => void; configured?: boolean }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async () => {
    if (!supabase || !configured) {
      setMessage("Cloud Login চালু করতে .env ফাইলে Supabase Project URL ও anon/publishable key যোগ করে অ্যাপ Restart করুন।");
      return;
    }
    if (!email.trim() || password.length < 6) {
      setMessage("সঠিক Email দিন এবং Password কমপক্ষে ৬ অক্ষরের হতে হবে।");
      return;
    }
    setBusy(true); setMessage("");
    try {
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
      if (result.error) setMessage(result.error.message);
      else if (mode === "signup" && !result.data.session) setMessage("অ্যাকাউন্ট তৈরি হয়েছে। আপনার Gmail-এ পাঠানো verification link খুলে তারপর Login করুন।");
      else onSignedIn();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login করা যায়নি। আবার চেষ্টা করুন।");
    } finally { setBusy(false); }
  };
  const googleLogin = async () => {
    if (!supabase || !configured) {
      setMessage("Google Login চালু করতে আগে Supabase সেটআপ এবং Google Provider Enable করতে হবে।");
      return;
    }
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
      if (error) { setMessage(error.message); setBusy(false); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google Login শুরু করা যায়নি।");
      setBusy(false);
    }
  };
  return <div className="auth-screen auth-overlay"><div className="auth-card">
    {onClose && <button className="auth-close" type="button" onClick={onClose} aria-label="বন্ধ করুন">×</button>}
    <div className="brand-mark auth-mark">MB</div><h1>MY BUSINESS</h1>
    <p>আপনার ব্যবসার হিসাব নিরাপদে সংরক্ষণ করুন</p>
    <button className="google-login" type="button" onClick={googleLogin} disabled={busy}><GoogleMark/> Continue with Google</button>
    <div className="auth-divider"><span>অথবা Email দিয়ে</span></div>
    <div className="auth-tabs"><button type="button" className={mode==="login"?"selected":""} onClick={()=>{setMode("login");setMessage("");}}>Login</button><button type="button" className={mode==="signup"?"selected":""} onClick={()=>{setMode("signup");setMessage("");}}>Create Account</button></div>
    <label>Email Address<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@gmail.com"/></label>
    <label>Password<input type="password" autoComplete={mode==="login"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="কমপক্ষে ৬ অক্ষর"/></label>
    {message && <div className="auth-message">{message}</div>}
    {!configured && <div className="auth-setup-note">এখন Local Mode চালু আছে। Google/Email Login সক্রিয় করতে Supabase Cloud সেটআপ প্রয়োজন।</div>}
    <button className="primary auth-submit" type="button" disabled={busy} onClick={submit}>{busy?"অপেক্ষা করুন…":mode==="login"?"Login করুন":"অ্যাকাউন্ট তৈরি করুন"}</button>
    <small>আপনার তথ্য ব্যক্তিগত অ্যাকাউন্টে সংরক্ষিত থাকবে।</small>
  </div></div>;
}

function GoogleMark() {
  return <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.9 6-15z"/><path fill="#FF3D00" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9v5.2A20 20 0 0 0 24 44z"/><path fill="#4CAF50" d="M12.8 27.7a12 12 0 0 1 0-7.4v-5.2H5.9a20 20 0 0 0 0 17.8z"/><path fill="#1976D2" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4A20 20 0 0 0 5.9 15.1l6.9 5.2c1.6-4.7 6-8.2 11.2-8.2z"/></svg>;
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [ready, setReady] = useState(!isCloudConfigured);
  const [syncStatus, setSyncStatus] = useState("Local Mode");
  const [reloadKey, setReloadKey] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session?.user) {
        const { data: row, error } = await supabase.from("business_data").select("payload").eq("user_id", data.session.user.id).maybeSingle();
        if (error) setSyncStatus("Sync error");
        else if (row?.payload) putLocalPayload(row.payload as CloudPayload);
        else clearLocalPayload();
      } else {
        clearLocalPayload();
      }
      if (alive) setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) { clearLocalPayload(); setReloadKey(k=>k+1); setReady(true); setSyncStatus("Signed out"); }
      else {
        setReady(false);
        // Load the signed-in user's cloud data before mounting the bookkeeping workspace.
        void (async () => {
          const { data: row, error } = await supabase!.from("business_data").select("payload").eq("user_id", nextSession.user.id).maybeSingle();
          if (error) setSyncStatus("Sync error");
          else if (row?.payload) putLocalPayload(row.payload as CloudPayload);
          else clearLocalPayload();
          if (alive) { setReloadKey(k => k + 1); setReady(true); }
        })();
      }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) return;
    let active = true;
    let syncing = false;
    let lastLocal = "";
    const userId = session.user.id;
    const sync = async () => {
      if (!active || syncing) return;
      const payload = getLocalPayload();
      const serialized = JSON.stringify(payload);
      if (serialized === lastLocal) return;
      syncing = true;
      try {
        const { error } = await supabase.from("business_data").upsert(
          { user_id: userId, payload, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
        if (!active) return;
        if (!error) { lastLocal = serialized; setSyncStatus("Synced"); }
        else setSyncStatus("Sync pending");
      } catch {
        if (active) setSyncStatus("Sync pending");
      } finally {
        syncing = false;
      }
    };
    const timer = window.setInterval(sync, 2500);
    sync();
    const channel = supabase.channel("business-data-" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "business_data", filter: "user_id=eq." + userId }, async (event) => {
        if (!event.new?.payload) return;
        const incoming = JSON.stringify(event.new.payload);
        const current = JSON.stringify(getLocalPayload());
        if (incoming !== current) {
          putLocalPayload(event.new.payload as CloudPayload);
          lastLocal = incoming;
          setReloadKey(k => k + 1);
        }
      }).subscribe();
    return () => { active = false; window.clearInterval(timer); supabase.removeChannel(channel); };
  }, [session?.user?.id, reloadKey]);

  if (isCloudConfigured && !ready) return <div className="auth-screen"><div className="auth-card"><div className="brand-mark auth-mark">MB</div><h1>MY BUSINESS</h1><p>আপনার ডাটা প্রস্তুত করা হচ্ছে…</p></div></div>;
  if (isCloudConfigured && !session) return <AuthScreen onSignedIn={() => setReady(false)} />;
  return <><div className="sync-indicator">{isCloudConfigured ? `☁ ${syncStatus}` : "● Local Mode"}{session && <button onClick={async()=>{await supabase?.auth.signOut();}}>Logout</button>}</div><BusinessWorkspace key={reloadKey} onAccountClick={()=>setAccountOpen(true)} accountLabel={session?.user?.email || (isCloudConfigured ? "Login করুন" : "Local Mode · Login")}/>{accountOpen && (session ? <div className="auth-screen auth-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setAccountOpen(false)}}><div className="auth-card account-card"><button className="auth-close" type="button" onClick={()=>setAccountOpen(false)}>×</button><div className="brand-mark auth-mark">MB</div><h1>MY BUSINESS</h1><p>আপনার অ্যাকাউন্ট</p><div className="account-email">{session.user.email}</div><button className="primary auth-submit" onClick={async()=>{await supabase?.auth.signOut();setAccountOpen(false);}}><LogOut size={17}/> Logout</button><button className="secondary" onClick={()=>setAccountOpen(false)}>বন্ধ করুন</button></div></div> : <AuthScreen configured={isCloudConfigured} onClose={()=>setAccountOpen(false)} onSignedIn={()=>{setAccountOpen(false);setReady(false);}}/>)}</>;

}
