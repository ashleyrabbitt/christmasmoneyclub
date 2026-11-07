import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {calculatePlan} from './dist/assets/planner-math.js';
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
assert.equal(sponsoredLinks.length,1,'Update disclosures when adding or removing affiliate links');
assert.match(sponsoredLinks[0][0],/href="https:\/\/get\.descript\.com\/o1zqq5l1l1m4"/);
assert.ok(earnHtml.includes('Affiliate disclosure:'));
assert.ok(earnHtml.indexOf('Affiliate disclosure:')<earnHtml.indexOf('https://get.descript.com/'),'Commission disclosure must precede the Descript link');
assert.match(disclosureHtml,/Last updated November 7, 2026/);
assert.match(disclosureHtml,/currently the only tracked affiliate link on this site/);
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
