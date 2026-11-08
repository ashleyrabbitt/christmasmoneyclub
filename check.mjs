import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {calculatePlan} from './dist/assets/planner-math.js';
import {earningTools, challengeSteps} from './content/holiday.mjs';
const base={gifts:350,food:100,travel:0,celebrations:50,cushion:50,saved:150,earnings:0,deadline:'2026-12-25'};
assert.deepEqual(calculatePlan(base,'2026-11-05'),{budget:550,gap:400,remaining:400,weeks:8,days:50,weekly:50,earnings:0,saved:150,deadline:'2026-12-25'});
assert.equal(calculatePlan({...base,earnings:100},'2026-11-05').weekly,37.5);
assert.equal(calculatePlan({...base,saved:650},'2026-11-05').weekly,0);
assert.equal(calculatePlan({...base,gifts:350.01},'2026-11-05').weekly,50.01);
assert.equal(calculatePlan(base,'2026-12-25').weekly,400);
assert.ok(calculatePlan(base,'2026-12-26').error);
assert.ok(calculatePlan({...base,gifts:-1},'2026-11-05').error);
assert.ok(calculatePlan({...base,deadline:'2026-02-30'},'2026-01-01').error);
assert.equal(calculatePlan({...base,deadline:'2028-03-01'},'2028-02-28').days,2);
const root=path.resolve('dist');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const htmls=walk(root).filter(p=>p.endsWith('.html'));
let localLinks=0;const failures=[];
for(const file of htmls){const text=fs.readFileSync(file,'utf8');
 if(!/<title>[^<]+<\/title>/.test(text))failures.push(file+': missing title');
 if((text.match(/<h1[ >]/g)||[]).length!==1)failures.push(file+': invalid h1 count');
 for(const m of text.matchAll(/(?:href|src)="(\/[^"]*)"/g)){const link=m[1].split(/[?#]/)[0];if(!link)continue;localLinks++;let dest=path.join(root,link);if(link.endsWith('/'))dest=path.join(dest,'index.html');if(!fs.existsSync(dest))failures.push(file+': broken '+link);}
 for(const m of text.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g))JSON.parse(m[1]);
}
const articles=JSON.parse(fs.readFileSync('content/articles.json','utf8'));
assert.ok(articles.length>=8,'Expected at least eight completed articles');
assert.equal(new Set(articles.map(a=>a.slug)).size,articles.length,'Unique article slugs');
assert.ok(articles.every(a=>a.sources.length>0 && a.sections.length>0),'Every article needs content and sources');
// Keep the published disclosure aligned with the links actually rendered.
const earnHtml=fs.readFileSync(path.join(root,'earn/index.html'),'utf8');
const creditHtml=fs.readFileSync(path.join(root,'credit/index.html'),'utf8');
const disclosureHtml=fs.readFileSync(path.join(root,'disclosure/index.html'),'utf8');
const creditNinjaHtml=fs.readFileSync(path.join(root,'guides/creditninja-loan-guide/index.html'),'utf8');
const sponsoredLinks=htmls.flatMap(file=>[...fs.readFileSync(file,'utf8').matchAll(/<a\b[^>]*\brel="[^"]*\bsponsored\b[^"]*"[^>]*>/g)]);
assert.equal(sponsoredLinks.length,earningTools.length,'Expected only documented affiliate placements');
for(const tool of earningTools){
 assert.ok(sponsoredLinks.some(link=>link[0].includes('href=\"'+tool.url+'\"')),'Missing documented affiliate destination: '+tool.name);
 assert.ok(disclosureHtml.includes(tool.name),'Disclosure must name '+tool.name);
 assert.ok(earnHtml.indexOf('Affiliate disclosure:')<earnHtml.indexOf(tool.url),'Disclosure must precede '+tool.name);
}
assert.ok(earnHtml.includes('Affiliate disclosure:'));
assert.ok(earnHtml.indexOf('Affiliate disclosure:')<earnHtml.indexOf('https://get.descript.com/'),'Commission disclosure must precede the Descript link');
assert.match(disclosureHtml,/Last updated November 7, 2026/);
assert.match(disclosureHtml,/direct retailer search links, without our affiliate tracking/);
const giftHtml=fs.readFileSync(path.join(root,'gifts/index.html'),'utf8');
assert.ok(!/rel="[^"]*sponsored/.test(giftHtml),'Unverified retailer tracking must not be activated');
assert.ok(!giftHtml.includes('tag=thefamilygr0a-20'),'Amazon domain listing remains unverified');
assert.equal((giftHtml.match(/data-gift /g)||[]).length,12,'Gift finder should contain twelve ideas');
const challengeHtml=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
assert.equal((challengeHtml.match(/data-challenge-step=/g)||[]).length,challengeSteps.length);
assert.equal(challengeSteps.length,7);
for(const route of ['/gifts/','/christmas-fun/','/challenge/'])assert.ok(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('href=\"'+route+'\"'),'Homepage should lead to '+route);
const directProviders=[
 ['CreditNinja','https://www.creditninja.com/personal-loans/'],
 ['Indigo Mastercard','https://indigocard.com/faq'],
 ['Kikoff Credit Account','https://kikoff.com/credit-account'],
 ['Credible','https://www.credible.com/personal-loan'],
 ['Wayfair','https://www.wayfair.com/'],
 ['Klarna','https://www.klarna.com/us/'],
 ['Affirm','https://www.affirm.com/how-it-works'],
 ['Cherry','https://withcherry.com/consumers']
];
for(const [name,url] of directProviders){
 assert.ok(disclosureHtml.includes(name),'Disclosure must name '+name);
 assert.ok(creditHtml.includes(`href="${url}" rel="noopener noreferrer"`),'Expected direct informational link for '+name);
}
assert.match(creditNinjaHtml,/"dateModified":"2026-11-07"/);
assert.ok(creditNinjaHtml.indexOf('<strong>Link disclosure:</strong>')<creditNinjaHtml.indexOf('<div class="article-layout">'),'Guide link disclosure must precede the article');
assert.match(creditNinjaHtml,/does not claim campaign or content approval from CreditNinja/);
for(const file of htmls){
 assert.ok(fs.readFileSync(file,'utf8').includes('Financial-provider and Wayfair links currently use direct informational URLs, without our affiliate tracking.'),'Global disclosure missing from '+file);
}
assert.deepEqual(failures,[]);
console.log(JSON.stringify({status:'passed',calculatorCases:9,htmlPages:htmls.length,internalLinksAndAssets:localLinks,articles:articles.length,trackedAffiliateLinks:sponsoredLinks.length,directProviderLinks:directProviders.length,disclosureChecks:'passed'}));
