export function calculatePlan(values, todayString){
 const keys=['gifts','food','travel','celebrations','cushion','saved','earnings'];
 const v={};
 for(const key of keys){const n=Number(values[key]);if(!Number.isFinite(n)||n<0||n>1000000)return {error:'Use amounts between $0 and $1,000,000.'};v[key]=Math.round(n*100)/100;}
 const parseDay=text=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(text||''))return NaN;const [y,m,d]=text.split('-').map(Number);const date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?date.getTime():NaN;};
 const target=parseDay(values.deadline),today=parseDay(todayString);
 if(!Number.isFinite(target)||!Number.isFinite(today))return {error:'Choose a valid target date.'};
 const days=Math.round((target-today)/86400000);
 if(days<0)return {error:'That date has passed. Choose today or a future date.'};
 const weeks=Math.max(1,Math.ceil(days/7));
 const budgetCents=['gifts','food','travel','celebrations','cushion'].reduce((total,k)=>total+Math.round(v[k]*100),0);
 const gapCents=Math.max(0,budgetCents-Math.round(v.saved*100));
 const remainingCents=Math.max(0,gapCents-Math.round(v.earnings*100));
 return {budget:budgetCents/100,gap:gapCents/100,remaining:remainingCents/100,weeks,days,weekly:Math.ceil(remainingCents/weeks)/100,earnings:v.earnings,saved:v.saved,deadline:values.deadline};
}
