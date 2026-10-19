// @ts-nocheck
import * as THREE from 'three';
import fs from 'node:fs';
type Entry = { index: number; chapter: number; review: string; candidates: {position:string;initial:string;rhyme:string;group:string;tone:string;fanqie:string;gloss:string;originalPosition:string}[]; char: string; initial: string; rhyme: string; group: string; tone: string; fanqie: string; position: string; originalPosition: string; coord: [number, number, number] };
const initials = ['帮','滂','并','明','端','透','定','泥','知','彻','澄','娘','精','清','从','心','邪','庄','初','崇','生','俟','章','昌','常','书','船','日','见','溪','群','疑','影','晓','匣','云','以','来'];
const rhymeGroups = ['通','江','止','遇','蟹','臻','山','效','果','假','宕','梗','曾','流','深','咸'];
const toneY: Record<string, number> = { 平: -2.4, 上: -0.8, 去: 0.8, 入: 2.4 };
const INITIAL_STEP = 0.5;
const TONE_STEP = 1.6;
const BEAM_SIZE = .5;
const GROUP_STEP = 0.72;
const initialX = (initial: string) => (initials.indexOf(initial) - (initials.length - 1) / 2) * 0.5;
const groupZ = (group: string) => ((rhymeGroups.length - 1) / 2 - rhymeGroups.indexOf(group)) * 0.72;
const locate = (initial: string, tone: string, group: string): [number, number, number] => [initialX(initial), toneY[tone], groupZ(group)];


function calculate(paths:Entry[][],strength:number){
    const edges=paths.flatMap(path=>path.slice(1).map((end,i)=>({a:new THREE.Vector3(...path[i].coord),b:new THREE.Vector3(...end.coord),id:`${path[0].chapter}-${path[0].index}`,pair:`${path[i].char}→${end.char}`,transition:`${path[i].position} → ${end.position}`}))).filter(e=>e.a.distanceTo(e.b)>.001);
    if(!strength)return edges.map(e=>({points:[e.a,e.b],id:e.id,pair:e.pair,transition:e.transition,width:.8}));
    const mid=edges.map(e=>e.a.clone().add(e.b).multiplyScalar(.5));
    const dirs=edges.map(e=>e.b.clone().sub(e.a));
    const visibility=(i:number,j:number)=>{
      const e=edges[i],f=edges[j],u=dirs[i].clone().normalize();
      const p=e.a.clone().addScaledVector(u,f.a.clone().sub(e.a).dot(u));
      const q=e.a.clone().addScaledVector(u,f.b.clone().sub(e.a).dot(u));
      const length=p.distanceTo(q);if(length<.001)return 0;
      return Math.max(0,1-2*mid[i].distanceTo(p.add(q).multiplyScalar(.5))/length);
    };
    const neighbors=edges.map((_,i)=>edges.flatMap((_,j)=>{
      if(i===j)return [];
      const a=dirs[i].length(),b=dirs[j].length(),average=(a+b)/2;
      const dot=dirs[i].clone().normalize().dot(dirs[j].clone().normalize());
      const scale=2/(average/Math.min(a,b)+Math.max(a,b)/average);
      const position=average/(average+mid[i].distanceTo(mid[j]));
      const weight=Math.abs(dot)*scale*position*Math.min(visibility(i,j),visibility(j,i));
      return weight>.05?[{j,weight,aligned:dot>=0}]:[];
    }));
    const resample=(row:THREE.Vector3[],count:number)=>{
      const cumulative=[0];for(let i=1;i<row.length;i++)cumulative.push(cumulative[i-1]+row[i].distanceTo(row[i-1]));
      const total=cumulative[cumulative.length-1];
      return Array.from({length:count+2},(_,i)=>{if(i===0)return row[0].clone();if(i===count+1)return row[row.length-1].clone();const distance=total*i/(count+1);let k=1;while(k<cumulative.length-1&&cumulative[k]<distance)k++;return row[k-1].clone().lerp(row[k],(distance-cumulative[k-1])/Math.max(1e-8,cumulative[k]-cumulative[k-1]));});
    };
    let samples=edges.map(e=>[e.a.clone(),e.a.clone().lerp(e.b,.5),e.b.clone()]);
    // Holten & van Wijk 2009 §3.2–3.3; fixed project scale and parameters.
    const iterations=[50,33,22,15,9,7];
    for(let cycle=0;cycle<6;cycle++){
      const count=2**cycle,stepSize=.04/(2**cycle);
      if(cycle)samples=samples.map(row=>resample(row,count));
      for(let iteration=0;iteration<iterations[cycle];iteration++)samples=samples.map((row,i)=>row.map((point,k)=>{
        if(k===0||k===row.length-1)return point.clone();
        const spring=.085/(dirs[i].length()*(count+1));
        const force=row[k-1].clone().add(row[k+1]).addScaledVector(point,-2).multiplyScalar(spring);
        neighbors[i].forEach(({j,weight,aligned})=>{
          const delta=samples[j][aligned?k:row.length-1-k].clone().sub(point);const distance=delta.length();
          if(distance>1e-6)force.addScaledVector(delta,weight/(distance*distance));
        });
        if(force.lengthSq()>1e-16)force.normalize().multiplyScalar(stepSize);
        return point.clone().add(force);
      }));
    }
    return samples.map((row,i)=>{
      const density=neighbors[i].reduce((total,{j})=>total+(row[16].distanceTo(samples[j][16])<.4?1:0),0);
      return {points:new THREE.CatmullRomCurve3(row).getPoints(40),id:edges[i].id,pair:edges[i].pair,transition:edges[i].transition,width:Math.min(3.2,.65+Math.sqrt(density)*.3)};
    });

}
const data=JSON.parse(fs.readFileSync(process.argv[2]||'data/qiyue-display.json','utf8'));
const paragraphs=data.map(c=>{let offset=0;return (c.text.match(/[^。？！]+[。？！]?/g)||[]).map(text=>{const length=[...text.replace(/[^\p{Script=Han}]/gu,'')].length;const line=c.entries.slice(offset,offset+length).map(e=>({...e,coord:locate(e.initial,e.tone,e.group)}));offset+=length;return line;});});
const key=paths=>paths.map(path=>path.map(e=>e.position).join(',')).join('|');const output=JSON.parse(fs.readFileSync('data/bundles-precomputed.json','utf8'));
for(const paths of [...paragraphs,paragraphs.flat()]){const start=performance.now();output[key(paths)]=calculate(paths,1).map(c=>({...c,points:c.points.map(p=>p.toArray().map(n=>Math.round(n*10000)/10000))}));console.log(paths.length+' sentences: '+Math.round(performance.now()-start)+' ms');}
fs.writeFileSync('data/bundles-precomputed.json',JSON.stringify(output));
