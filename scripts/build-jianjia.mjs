import fs from 'node:fs';
import T from 'tshet-uinh';
const chapters=JSON.parse(fs.readFileSync('data/jianjia-text.json','utf8'));
const first={};
const result=chapters.map((text,chapter)=>({text,entries:[...text.replace(/[^\p{Script=Han}]/gu,'')].map((char,index)=>{
const candidates=T.資料.query字頭(({鵙:'鶪',樗:'㯉',溯:'遡'})[char] || char);
if(!candidates.length)return {char,index,chapter,initial:'',rhyme:'',group:'',tone:'',fanqie:'',position:'未收录',review:'待补资料',candidates:[]};
const preferred=first[char]?.selectedPosition;
const chosen=candidates.find(e=>e.音韻地位.描述===preferred)||candidates[0];
const p=chosen.音韻地位;
return {char,index,chapter,initial:p.母,rhyme:p.韻,group:p.攝,tone:p.聲,fanqie:chosen.反切,position:p.描述,review:preferred?'首句已校订':candidates.length===1?'单一候选':'多音待校订',candidates:candidates.map(e=>({position:e.音韻地位.描述,initial:e.音韻地位.母,rhyme:e.音韻地位.韻,group:e.音韻地位.攝,tone:e.音韻地位.聲,fanqie:e.反切,gloss:e.釋義}))};
})}));
fs.writeFileSync('data/jianjia.json',JSON.stringify(result,null,2));
console.log({chapters:result.length,characters:result.reduce((n,c)=>n+c.entries.length,0),pending:result.flatMap(c=>c.entries).filter(e=>e.review==='多音待校订').length});
