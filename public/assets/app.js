import { calculatePlan } from './planner-math.js';
const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
if(menuButton && nav) menuButton.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation');menuButton.textContent=open?'Close':'Menu';});

const cards=[...document.querySelectorAll('[data-article]')];
const filterButtons=[...document.querySelectorAll('[data-filter]')];
const searchInput=document.querySelector('#guide-search');
let category='All';
function filterGuides(){
 const query=(searchInput?.value||'').trim().toLowerCase(); let count=0;
 cards.forEach(card=>{const visible=(category==='All'||card.dataset.category===category)&&card.textContent.toLowerCase().includes(query);card.hidden=!visible;if(visible)count++;});
 const empty=document.querySelector('#no-results');if(empty)empty.hidden=count!==0;
 const status=document.querySelector('#guide-count');if(status)status.textContent=`${count} ${count===1?'guide':'guides'} to explore`;
}
filterButtons.forEach(btn=>btn.addEventListener('click',()=>{category=btn.dataset.filter;filterButtons.forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));filterGuides();}));
searchInput?.addEventListener('input',filterGuides);if(cards.length)filterGuides();

const planner=document.querySelector('#holiday-planner');
if(planner){
 const key='christmas-money-club-plan-v1';
 const fields=['gifts','food','travel','celebrations','cushion','saved','earnings','deadline'];
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
 const now=new Date();const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 let year=now.getFullYear();if(today>`${year}-12-25`)year++;
 const deadline=planner.elements.namedItem('deadline');deadline.min=today;deadline.value=`${year}-12-25`;
 const status=document.querySelector('#plan-status');let lastResult;
 const values=()=>Object.fromEntries(fields.map(f=>[f,planner.elements.namedItem(f).value]));
 const say=text=>{status.textContent=text;};
 const update=()=>{
  const invalid=fields.some(f=>planner.elements.namedItem(f).validity.badInput);
  const result=invalid?{error:'Complete each amount with a valid number.'}:calculatePlan(values(),today);lastResult=result;
  const text=(id,value)=>{document.getElementById(id).textContent=value;};
  if(result.error){text('weekly-amount','—');text('result-caption',result.error);text('total-budget','—');text('already-saved','—');text('remaining-gap','—');text('weeks-left','—');text('earnings-note','Please review the amounts and date above.');return;}
  text('weekly-amount',money(result.weekly));
  text('result-caption',result.remaining===0?'Your plan covers your budget. Keep new spending within it.':result.days===0?'Needed today to cover your plan.':`Set aside each week over ${result.weeks} ${result.weeks===1?'week':'weeks'}.`);
  text('total-budget',money(result.budget));text('already-saved',money(result.saved));text('remaining-gap',money(result.remaining));text('weeks-left',result.days===0?'Today':`${result.days} days / ${result.weeks} weeks`);
  text('earnings-note',result.earnings>0?`This plan assumes ${money(result.earnings)} of extra take-home earnings after costs and taxes. Those earnings are not guaranteed. Set this to $0 for a savings-only plan.`:'This plan uses no assumed side-hustle earnings. Any extra take-home income can reduce the amount you need to save.');
 };
 planner.addEventListener('input',update);planner.addEventListener('submit',event=>event.preventDefault());
 document.querySelector('#save-plan').addEventListener('click',()=>{if(lastResult?.error){say('Fix the highlighted planning issue before saving.');return;}try{localStorage.setItem(key,JSON.stringify(values()));say('Saved on this device. You can return to this browser to continue.');}catch{say('This browser could not save the plan. Use Download my plan instead.');}});
 document.querySelector('#reset-plan').addEventListener('click',()=>{planner.reset();deadline.value=`${year}-12-25`;try{localStorage.removeItem(key);}catch{}update();say('Plan reset. Any saved copy on this device was removed.');});
 document.querySelector('#download-plan').addEventListener('click',()=>{if(lastResult?.error){say('Fix the planning issue before downloading.');return;}const r=lastResult,v=values();const lines=['MY CHRISTMAS MONEY PLAN',`Created: ${today}`,`Target date: ${r.deadline}`,'',...['gifts','food','travel','celebrations','cushion'].map(f=>`${f[0].toUpperCase()+f.slice(1)}: ${money(Number(v[f]))}`),'',`Total budget: ${money(r.budget)}`,`Already saved: ${money(r.saved)}`,`Assumed extra take-home earnings: ${money(r.earnings)}`,`Remaining to save: ${money(r.remaining)}`,`Time left: ${r.days} days (${r.weeks} planning weeks)`,`Weekly savings target: ${money(r.weekly)}`,'','Protect essentials first. Estimates are illustrative; earnings are not guaranteed.','Christmas Money Club — make a little more, spend a little less.'];const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='my-christmas-money-plan.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Your plan download is ready.');});
 document.querySelector('#print-plan').addEventListener('click',()=>window.print());
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved && typeof saved==='object'){fields.forEach(f=>{if(typeof saved[f]==='string')planner.elements.namedItem(f).value=saved[f];});say('Loaded the plan you saved on this device.');}}catch{}
 update();
}
