import { calculatePlan } from './planner-math.js';
const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
if(menuButton && nav) menuButton.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation');menuButton.textContent=open?'Close':'Menu';});
const closeMenu=()=>{if(!menuButton||!nav)return;nav.classList.remove('open');menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Open navigation');menuButton.textContent='Menu';};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav?.classList.contains('open')){closeMenu();menuButton.focus();}});
nav?.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});

// Count calendar days, so daylight-saving changes do not move the countdown.
const countdown=document.querySelector('[data-christmas-countdown]');
if(countdown){
 const now=new Date();let year=now.getFullYear();
 if(now.getMonth()===11&&now.getDate()>25)year++;
 const days=Math.round((Date.UTC(year,11,25)-Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/86400000);
 countdown.textContent=days===0?'Merry Christmas. Make room for what matters.':`${days} ${days===1?'day':'days'} until Christmas · A little more magic starts here.`;
}
const snowToggle=document.querySelector('.snow-toggle');
const snowLayer=document.querySelector('.snow-layer');
if(snowToggle&&snowLayer){
 const setSnow=on=>{snowLayer.hidden=!on;snowToggle.setAttribute('aria-pressed',String(on));snowToggle.setAttribute('aria-label',on?'Turn off decorative snow':'Turn on decorative snow');snowToggle.textContent=on?'Snow off ❄':'Let it snow ❄';};
 try{setSnow(sessionStorage.getItem('cmc-snow')==='on');}catch{setSnow(false);}
 snowToggle.addEventListener('click',()=>{const on=snowLayer.hidden;setSnow(on);try{sessionStorage.setItem('cmc-snow',on?'on':'off');}catch{}});
}

const giftCards=[...document.querySelectorAll('[data-gift]')];
const recipientInput=document.querySelector('#gift-recipient');
const budgetInput=document.querySelector('#gift-budget');
if(giftCards.length&&recipientInput&&budgetInput){
 const filterGifts=()=>{
  let count=0;
  giftCards.forEach(card=>{const recipientMatches=recipientInput.value==='all'||card.dataset.recipient.split('|').includes(recipientInput.value);const budgetMatches=budgetInput.value==='all'||Number(card.dataset.budget)<=Number(budgetInput.value);card.hidden=!(recipientMatches&&budgetMatches);if(!card.hidden)count++;});
  document.querySelector('#gift-count').textContent=`${count} thoughtful ${count===1?'idea':'ideas'} to explore`;
  document.querySelector('#gift-empty').hidden=count!==0;
 };
 const resetGifts=()=>{recipientInput.value='all';budgetInput.value='all';filterGifts();};
 recipientInput.addEventListener('change',filterGifts);budgetInput.addEventListener('change',filterGifts);
 document.querySelector('#reset-gifts').addEventListener('click',resetGifts);
 document.querySelector('[data-reset-gifts]').addEventListener('click',resetGifts);
 filterGifts();
}

const steps=[...document.querySelectorAll('[data-challenge-step]')];
if(steps.length){
 const key='cmc-christmas-checklist-v1';
 const status=document.querySelector('#challenge-status');
 const updateChallenge=()=>{
  const count=steps.filter(step=>step.checked).length;
  document.querySelector('#challenge-progress').textContent=`${count} of ${steps.length} small steps complete`;
  const progress=document.querySelector('.holiday-progress-track');
  progress.setAttribute('aria-valuenow',String(count));progress.firstElementChild.style.width=`${count/steps.length*100}%`;
  document.querySelector('#challenge-encouragement').textContent=count===steps.length?'All seven steps complete. That deserves a little celebration.':count===0?'Choose the easiest step and begin there.':'A little progress counts. Keep going at your own pace.';
  steps.forEach(step=>step.closest('.challenge-step').classList.toggle('complete',step.checked));
 };
 steps.forEach(step=>step.addEventListener('change',()=>{updateChallenge();status.textContent='Progress updated. Choose Save my progress to keep these changes on this device.';}));
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(saved)){steps.forEach((step,i)=>step.checked=saved[i]===true);status.textContent='Loaded your saved Christmas checklist on this device.';}}catch{}
 document.querySelector('#save-challenge').addEventListener('click',()=>{try{localStorage.setItem(key,JSON.stringify(steps.map(step=>step.checked)));status.textContent='Progress saved on this device. Come back to this browser to pick up where you left off.';}catch{status.textContent='This browser could not save your progress. You can print the checklist instead.';}});
 document.querySelector('#reset-challenge').addEventListener('click',()=>{steps.forEach(step=>step.checked=false);try{localStorage.removeItem(key);}catch{}updateChallenge();status.textContent='Checklist reset. Any saved progress on this device was removed.';});
 document.querySelector('#print-challenge').addEventListener('click',()=>window.print());
 updateChallenge();
}

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
