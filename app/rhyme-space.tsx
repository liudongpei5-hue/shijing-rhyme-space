'use client';

import precomputed from '../data/bundles-precomputed.json';
import audioManifest from '../data/audio-manifest.json';
import qiyueData from '../data/qiyue-display.json';
import jianjiaData from '../data/jianjia-display.json';
import taoyaoData from '../data/taoyao-display.json';
import wuyiData from '../data/wuyi-display.json';
import caiweiData from '../data/caiwei-display.json';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';

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

function FieldPlane({ axis, position, color }: { axis: 'x' | 'y' | 'z'; position: number; color: string }) {
  const rotation: [number, number, number] = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  const at: [number, number, number] = axis === 'x' ? [position, 0, 0] : axis === 'y' ? [0, position, 0] : [0, 0, position];
  return <mesh position={at} rotation={rotation}><planeGeometry args={[15, 10]} /><meshBasicMaterial color={color} transparent opacity={0.027} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} /></mesh>;
}

function CameraRail({ selected }: { selected: Entry | null }) {
  const controls = useRef<React.ElementRef<typeof OrbitControls>>(null);
  const motion = useRef({ active: false, elapsed: 0, fromPosition: new THREE.Vector3(), toPosition: new THREE.Vector3(), fromTarget: new THREE.Vector3(), toTarget: new THREE.Vector3() });

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const nextTarget = selected ? new THREE.Vector3(...selected.coord) : new THREE.Vector3(0, 0, 0);
    const nextPosition = selected ? new THREE.Vector3(selected.coord[0] + 2.7, selected.coord[1] + 1.6, selected.coord[2] + 6.4) : new THREE.Vector3(11, 8, 19);
    motion.current = { active: true, elapsed: 0, fromPosition: orbit.object.position.clone(), toPosition: nextPosition, fromTarget: orbit.target.clone(), toTarget: nextTarget };
  }, [selected]);

  useFrame((state, delta) => {
    const orbit = controls.current;
    const path = motion.current;
    if (!orbit || !path.active) return;
    state.invalidate();
    path.elapsed = Math.min(path.elapsed + delta, 1.35);
    const raw = path.elapsed / 1.35;
    const eased = raw * raw * (3 - 2 * raw);
    orbit.object.position.lerpVectors(path.fromPosition, path.toPosition, eased);
    orbit.target.lerpVectors(path.fromTarget, path.toTarget, eased);
    orbit.update();
    if (raw >= 1) path.active = false;
  });

  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.065} enablePan={false} minDistance={3.2} maxDistance={38} minPolarAngle={0.38} maxPolarAngle={2.28} rotateSpeed={0.48} zoomSpeed={0.65} />;
}

function Glyph({ entries, entry, index, selected, onSelect }: { entries: Entry[]; entry: Entry; index: number; selected: boolean; onSelect: () => void }) {
  const orders = entries.flatMap((e, i) => e.coord.join() === entry.coord.join() ? [i + 1] : []);
  return <group position={entry.coord}>
    <Html center distanceFactor={16} zIndexRange={[15, 0]}>
      <button type="button" style={{ animationDelay: `${2.05 + index * 0.08}s` }} className={`sound-glyph is-arriving ${selected ? 'is-selected' : ''}`} onClick={onSelect} aria-label={`查看第${orders.join('、')}字${entry.char}的音韵信息`}>
        <span className="glyph-order">{orders.map(n => String(n).padStart(2, '0')).join(' / ')}</span>
        <span className="glyph-char">{[...new Set(entries.filter(e=>e.coord.join()===entry.coord.join()).map(e=>e.char))].join(' / ')}</span>
        <span className="glyph-coordinate">{entry.initial} · {entry.group}摄 · {entry.tone}</span>
      </button>
    </Html>
  </group>;
}

function AxisTick({ position, label, axis }: { position: [number, number, number]; label: string; axis: 'x' | 'y' | 'z' }) {
  return <group position={position}><WorldLabel text={label} position={axis === 'x' ? [0, -0.28, 0] : [-0.32, 0, 0]} color={axis === 'y' ? '#c8b98f' : axis === 'z' ? '#91aa9f' : '#c6ccc4'} scale={axis === 'x' ? 0.72 : 0.78} /></group>;
}

function TickMark({ position, axis }: { position: [number, number, number]; axis: 'x' | 'y' | 'z' }) {
  const points: [[number, number, number], [number, number, number]] = axis === 'x' ? [[0, 0, 0], [0, 0.2, 0]] : [[0, 0, 0], [0.2, 0, 0]];
  return <group position={position}><Line points={points} color="#aebdb5" transparent opacity={0.42} lineWidth={0.55} /></group>;
}

function WorldLabel({ text, position, color, scale = 0.32 }: { text: string; position: [number, number, number]; color: string; scale?: number }) {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.clearRect(0, 0, 512, 128);
    context.fillStyle = color;
    context.font = '500 56px "Songti SC", "STSong", serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 256, 64);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.minFilter = THREE.LinearFilter;
    return map;
  }, [text, color]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return <mesh position={position} scale={[scale * 4, scale, 1]}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={texture} transparent depthWrite={false} side={THREE.DoubleSide} /></mesh>;
}

function AxisScaffold() {
  const xMin = initialX(initials[0]) - INITIAL_STEP / 2;
  const xMax = initialX(initials[initials.length - 1]) + INITIAL_STEP / 2;
  const zNear = groupZ(rhymeGroups[0]) + GROUP_STEP / 2;
  const zFar = groupZ(rhymeGroups[rhymeGroups.length - 1]) - GROUP_STEP / 2;
  const yMin = toneY['平'] - TONE_STEP / 2;
  const yMax = toneY['入'] + TONE_STEP / 2;
  const baseY = yMin;
  return <group>
    <Line points={[[xMin, baseY, zNear], [xMax, baseY, zNear]]} color="#91a79f" transparent opacity={0.42} lineWidth={0.7} />
    <Line points={[[xMin, baseY, zNear], [xMin, yMax, zNear]]} color="#b6a983" transparent opacity={0.42} lineWidth={0.7} />
    <Line points={[[xMin, baseY, zNear], [xMin, baseY, zFar]]} color="#82988f" transparent opacity={0.42} lineWidth={0.7} />
    {initials.map((label) => <AxisTick key={`ix-${label}`} axis="x" label={label} position={[initialX(label), baseY, zNear]} />)}
    {Object.entries(toneY).map(([label, y]) => <AxisTick key={`ty-${label}`} axis="y" label={label} position={[xMin, y, zNear]} />)}
    {rhymeGroups.map((label) => <AxisTick key={`gz-${label}`} axis="z" label={label} position={[xMin, baseY, groupZ(label)]} />)}
    {Array.from({ length: initials.length + 1 }, (_, index) => <TickMark key={`ix-boundary-${index}`} axis="x" position={[xMin + index * INITIAL_STEP, baseY, zNear]} />)}
    {Array.from({ length: 5 }, (_, index) => <TickMark key={`ty-boundary-${index}`} axis="y" position={[xMin, yMin + index * TONE_STEP, zNear]} />)}
    {Array.from({ length: rhymeGroups.length + 1 }, (_, index) => <TickMark key={`gz-boundary-${index}`} axis="z" position={[xMin, baseY, zNear - index * GROUP_STEP]} />)}
    <WorldLabel text="X 声母三十八" position={[xMax + 1.05, baseY, zNear]} color="#bd6659" scale={0.65} />
    <WorldLabel text="Y 四声" position={[xMin - 0.6, yMax + 0.55, zNear]} color="#bd6659" scale={0.65} />
    <WorldLabel text="Z 十六摄" position={[xMin - 0.7, baseY, zFar - 0.7]} color="#bd6659" scale={0.65} />
  </group>;
}

function ConstructionLight({ entry, delay, selected }: { entry: Entry; delay: number; selected: boolean }) {
  const x = useRef<THREE.Mesh>(null), y = useRef<THREE.Mesh>(null), z = useRef<THREE.Mesh>(null);
  const elapsed = useRef(-delay);
  const [px, py, pz] = entry.coord;
  useFrame((_, delta) => {
    elapsed.current += delta;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const progress=[0,.65,1.3].map(start=>reduced?1:THREE.MathUtils.smoothstep(elapsed.current,start,start+.65));
    const a=px+9.5,b=5.76-pz,c=py+3.2;
    if(x.current){x.current.scale.set(a*progress[0],BEAM_SIZE,BEAM_SIZE);x.current.position.set(-9.5+a*progress[0]/2,-3.2,pz);}
    if(y.current){y.current.scale.set(BEAM_SIZE,BEAM_SIZE,b*progress[1]);y.current.position.set(px,-3.2,5.76-b*progress[1]/2);}
    if(z.current){z.current.scale.set(BEAM_SIZE,c*progress[2],BEAM_SIZE);z.current.position.set(px,-3.2+c*progress[2]/2,pz);}
  });
  return <group>{[x,y,z].map((ref,i)=><mesh key={i} ref={ref} scale={[0,0,0]}><boxGeometry args={[1,1,1]}/><meshBasicMaterial color={['#85e6dc','#91bddf','#f4d79a'][i]} transparent opacity={selected ? .48 : .29} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}/></mesh>)}</group>;
}

function GrowingSegment({ from, to, delay }: { from: Entry; to: Entry; delay: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const elapsed = useRef(-delay);
  const start = useMemo(()=>new THREE.Vector3(...from.coord),[from]);
  const direction = useMemo(()=>new THREE.Vector3(...to.coord).sub(start),[to,start]);
  const rotation = useMemo(()=>new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize()),[direction]);
  useFrame((_,delta)=>{
    elapsed.current+=delta;
    if(!mesh.current)return;
    const t=window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : THREE.MathUtils.smoothstep(elapsed.current,0,.38);
    mesh.current.visible=t>0 && direction.length()>0;
    mesh.current.position.copy(start).addScaledVector(direction,t/2);
    mesh.current.scale.set(1,direction.length()*t,1);
  });
  return <mesh ref={mesh} quaternion={rotation} visible={false}><cylinderGeometry args={[.012,.012,1,8]}/><meshBasicMaterial color="#f0e9cb" transparent opacity={.88} toneMapped={false}/></mesh>;
}

function PoemPath({ entries }: { entries: Entry[] }) {
  return <group>{entries.slice(1).map((entry,i)=><GrowingSegment key={i} from={entries[i]} to={entry} delay={2.8+i*.32}/>)}</group>;
}

type Inspection = { title: string; note: string; ids: string[]; items: string[] };
function BundledPaths({ onLineSelect, paths, strength, highlighted, inspection, onInspect }: { onLineSelect:(id:string)=>void; paths: Entry[][]; strength: number; highlighted: string | null; inspection: Inspection | null; onInspect: (value: Inspection)=>void }) {
  const [hovered,setHovered]=useState<number[]>([]);
  const [pinned,setPinned]=useState<number[]>([]);
  const curves=useMemo(()=>{
    const key=paths.map(path=>path.map(e=>e.position).join(',')).join('|');
    const saved=(precomputed as Record<string,{points:number[][];id:string;pair:string;transition:string;width:number}[]>)[key];
    if(strength && saved)return saved.map(curve=>({...curve,points:curve.points.map(p=>new THREE.Vector3(p[0],p[1],p[2]))}));

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
  },[paths,strength]);
  const neighborsAt=(index:number,point:THREE.Vector3)=>curves.flatMap((curve,i)=>i===index||curve.points.some(p=>Math.hypot(p.x-point.x,p.z-point.z)<.25)?[i]:[]);
  const activeIndices=hovered.length?hovered:pinned;
  const labels=activeIndices.flatMap(i=>{const c=curves[i];return [{point:c.points[0],text:c.pair.split('→')[0]},{point:c.points[c.points.length-1],text:c.pair.split('→')[1]}];}).filter((v,i,all)=>all.findIndex(other=>other.text===v.text&&other.point.distanceTo(v.point)<.01)===i);
  return <group>{curves.map(({points,id,width},i)=>{
    const active=activeIndices.includes(i)||highlighted===id;
    const filtering=activeIndices.length>0||!!highlighted;
    return <group key={i}><Line points={points} color={active?'#ffe4a8':'#b9d9ca'} lineWidth={active?2.5:width} transparent opacity={filtering?(active?1:.13):.42} depthWrite={false} depthTest={false} renderOrder={active?10:1} onClick={e=>{e.stopPropagation();setPinned([i]);onLineSelect(id);}} onPointerMove={e=>{e.stopPropagation();const next=[i];setHovered(old=>old.length===next.length&&old.every((v,k)=>v===next[k])?old:next);document.body.style.cursor='pointer';}} onPointerOut={()=>{setHovered([]);document.body.style.cursor='';}}/></group>;
  })}{labels.map(({point,text},i)=><Html key={i} position={point} center style={{pointerEvents:'none'}}><span className="trace-hover-letter">{text}</span></Html>)}</group>;
}

function TraceNode({ entry, entries, activeNode, onNodeSelect }: {entry: Entry; entries: Entry[]; activeNode:string|null; onNodeSelect:(key:string)=>void}) {
  const [hover,setHover]=useState(false);const key=entry.coord.join();const open=activeNode===key;
  const words=[...new Set(entries.filter(e=>e.coord.join()===entry.coord.join()).map(e=>e.char))];
  return <group position={entry.coord}>
    <mesh onPointerOver={e=>{e.stopPropagation();setHover(true);document.body.style.cursor='pointer';}} onPointerOut={()=>{setHover(false);document.body.style.cursor='';}} onClick={e=>{e.stopPropagation();onNodeSelect(open?'':key);}}><sphereGeometry args={[.2,16,16]}/><meshBasicMaterial color="#ffe3a0" transparent opacity={hover||open?.8:0} depthWrite={false} depthTest={false}/></mesh>
    {(hover||open)&&<Html center position={[0,.3,0]} style={{pointerEvents:'none'}}><span className="node-word-tooltip">{open?words.join(' · '):'点击查看字'}</span></Html>}
  </group>;
}

function FadingContext({ opacity, children }: { opacity: number; children: React.ReactNode }) {
  const group=useRef<THREE.Group>(null);
  useFrame(()=>group.current?.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    materials.forEach(material=>{if(material.userData.baseOpacity===undefined)material.userData.baseOpacity=material.opacity;material.transparent=true;material.opacity=material.userData.baseOpacity*opacity;material.depthWrite=false;});
  }));
  return <group ref={group} visible={opacity>.005}>{children}</group>;
}

function Scene({ onLineSelect, inspection, onInspect, traceView, highlighted, contextOpacity, entries, paths, strength, selected, onSelect, generation }: { onLineSelect:(id:string)=>void; inspection: Inspection | null; onInspect: (value: Inspection)=>void; traceView: boolean; highlighted: string | null; contextOpacity: number; entries: Entry[]; paths: Entry[][]; strength: number; selected: Entry | null; onSelect: (entry: Entry) => void; generation: number }) {
  const [activeNode,setActiveNode]=useState<string|null>(null);
  const unique=entries.filter((entry,i)=>entries.findIndex(e=>e.coord.join()===entry.coord.join())===i);
  return <>
    <color attach="background" args={['#0b1315']} /><ambientLight intensity={.3}/><CameraRail selected={selected}/><AxisScaffold/>
    {contextOpacity>.005 && <FadingContext opacity={contextOpacity}>{unique.map((entry,index)=><ConstructionLight key={`light-${generation}-${index}`} entry={entry} delay={paths.length>1?index*.025:0} selected={selected?.position===entry.position}/>)}</FadingContext>}
    {paths.length>1?<BundledPaths onLineSelect={id=>{setActiveNode(null);onLineSelect(id);}} paths={paths} strength={strength} highlighted={highlighted} inspection={inspection} onInspect={onInspect}/>:<PoemPath entries={entries}/>}
    {traceView && unique.map((entry,i)=><TraceNode key={`node-${i}`} entry={entry} entries={entries} activeNode={activeNode} onNodeSelect={setActiveNode}/>)}
    {contextOpacity>.005 && unique.map((entry,index)=><Glyph entries={entries} key={`${generation}-${index}`} entry={entry} index={paths.length>1?0:index} selected={selected?.position===entry.position} onSelect={()=>onSelect(entry)}/>)}
  </>;
}

export function RhymeSpace() {
  const poems={qiyue:{title:'七月',section:'豳风',data:qiyueData},jianjia:{title:'蒹葭',section:'秦风',data:jianjiaData},taoyao:{title:'桃夭',section:'周南',data:taoyaoData},wuyi:{title:'无衣',section:'秦风',data:wuyiData},caiwei:{title:'采薇',section:'小雅',data:caiweiData}};
  const [poemId,setPoemId]=useState<keyof typeof poems>('qiyue');
  const {data:qiyue,title:poemTitle,section:poemSection}=poems[poemId];
  const renderForExport=useRef<(()=>void)|null>(null);
  const [inspection,setInspection]=useState<Inspection|null>(null);
  const handleInspect=(value:Inspection)=>{setInspection(value);setHighlighted(null);};
  const [traceView,setTraceView]=useState(true);
  const [highlighted,setHighlighted]=useState<string|null>(null);
  const [contextOpacity,setContextOpacity]=useState(0);
  const [exportMessage,setExportMessage]=useState('');
  const exportImage=()=>{
    renderForExport.current?.();const source=root.current?.querySelector('canvas');if(!source)return;
    const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1800;const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.fillStyle='#0b1315';ctx.fillRect(0,0,2400,1800);
    const ratio=Math.min(2200/source.width,1330/source.height);const w=source.width*ratio,h=source.height*ratio;ctx.drawImage(source,(2400-w)/2,180+(1330-h)/2,w,h);
    ctx.fillStyle='#e5e4d6';ctx.font='40px serif';ctx.fillText(`诗经 · 声迹｜${poemTitle}`,110,110);ctx.font='22px serif';ctx.fillStyle='#9eb8ac';ctx.fillText('切韵音系 · 声母 × 四声 × 十六摄 · 字序路径',110,160);
    ctx.font='23px serif';ctx.fillText(mode==='all'?'全诗声迹':mode==='paragraph'?'段落声迹':sentences[sentence],110,1590);
    ctx.font='18px serif';ctx.fillText(`${bundlingEnabled?'FDEB 聚束（统一参数）':'原始字序直线'} · 节点位置固定 · 线束粗细表达局部密度`,110,1640);ctx.fillText('中古分类下的诗句路径，不代表先秦真实读音或押韵判定。',110,1680);
    const a=document.createElement('a');a.download=`诗经-${poemTitle}-声迹.png`;a.href=canvas.toDataURL('image/png');a.click();setExportMessage('声迹图片已导出');
  };
  const root = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [mode,setMode] = useState<'sentence'|'paragraph'|'all'>('all');
  const [bundlingEnabled,setBundlingEnabled] = useState(true);
  const strength = bundlingEnabled ? 1 : 0;
  const [sentence, setSentence] = useState(0);
  const [audioMessage, setAudioMessage] = useState('中古拟音 · 待接入授权音源');
  const player = useRef<HTMLAudioElement | null>(null);
  const playReading = (entry: Entry) => { const url = (audioManifest.characters as Record<string, string>)[entry.originalPosition]; if (!url) { setAudioMessage(`「${entry.char}」${entry.position}：暂无授权音源`); return; } player.current?.pause(); const audio = new Audio(url); player.current = audio; audio.play().catch(()=>setAudioMessage('音频播放失败，请重试')); };
  useEffect(()=>()=>{player.current?.pause();},[]);
  const [chapter, setChapter] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [generated, setGenerated] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [inputMessage, setInputMessage] = useState('三向光束定位 → 字浮现 → 依字序连线');

  const paragraphs = useMemo(()=>qiyue.map(c=>{
    let offset=0;
    return (c.text.match(/[^。？！]+[。？！]?/g)||[]).map(text=>{const count=[...text.replace(/[^\p{Script=Han}]/gu,'')].length;const result={text,entries:c.entries.slice(offset,offset+count)};offset+=count;return result;});
  }),[qiyue]);
  const sentences=paragraphs[chapter].map(s=>s.text);
  const paths=useMemo<Entry[][]>(()=>{
    const source=mode==='all'?paragraphs.flat():mode==='paragraph'?paragraphs[chapter]:[paragraphs[chapter][sentence]];
    return source.map(line=>line.entries.map(e=>{
      const choice=overrides[`${e.chapter}-${e.index}`];const reading=choice===undefined?e:{...e,...e.candidates[choice],review:'手动选读'};
      return {...reading,coord:locate(reading.initial,reading.tone,reading.group)};
    }));
  },[mode,chapter,sentence,overrides,paragraphs]);
  const entries=useMemo(()=>paths.flat(),[paths]);
  const mapped=entries.filter(e=>e.initial);
  const chooseSentence=(paragraph:number,line:number)=>{if(traceView){setHighlighted(`${paragraph}-${paragraphs[paragraph][line].entries[0].index}`);return;}setInspection(null);setMode('sentence');setChapter(paragraph);setSentence(line);setSelected(null);setGeneration(n=>n+1);};
  const generatePoem = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSelected(null); setGenerated(true); setGeneration(n=>n+1);
    setInputMessage('三向光束定位 → 字浮现 → 依字序连线');
  };

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.masthead', { autoAlpha: 0, y: -12, duration: 0.9 }).from('.space-stage canvas', { autoAlpha: 0, scale: 0.92, duration: 1.65 }, 0.25).from('.axis-note', { autoAlpha: 0, duration: 1.1, stagger: 0.08 }, 1.15).from('.footer-poem', { autoAlpha: 0, y: 12, duration: 0.8 }, 1.35);
    });
    return () => mm.revert();
  }, { scope: root });

  useGSAP(() => { if (selected) gsap.fromTo('.detail-panel', { autoAlpha: 0, x: 28 }, { autoAlpha: 1, x: 0, duration: 0.7, ease: 'power3.out' }); }, { scope: root, dependencies: [selected], revertOnUpdate: true });
  return <main ref={root} className="rhyme-app" style={{'--context-opacity':contextOpacity} as React.CSSProperties}>
    <header className="masthead"><div className="brand-mark">诗</div><div><h1>音韵空间</h1><p>《诗经·{poemSection}·{poemTitle}》 · 声音的行迹</p></div><button className="text-action" type="button" onClick={() => setSelected(null)}>全览</button></header>
    <aside className="poem-reader" aria-label={`${poemTitle}全文`}><div className="reader-title"><h2>{poemTitle}</h2><label className="poem-switch">切换诗篇<select aria-label="切换诗篇" value={poemId} onChange={event=>{setPoemId(event.target.value as keyof typeof poems);setChapter(0);setSentence(0);setOverrides({});setHighlighted(null);setSelected(null);setInspection(null);setMode('all');setGeneration(n=>n+1);}}>{Object.entries(poems).map(([id,poem])=><option key={id} value={id}>{poem.title} · {poem.section}</option>)}</select></label><p>{poemSection} · 点选诗句，观看声音的路径</p></div><div className="poem-scroll">{qiyue.map((paragraph,p)=><p className="poem-paragraph" key={p}>{(paragraphs[p].map(s=>s.text)).map((line,l)=><button key={l} data-sentence-id={`${p}-${paragraphs[p][l].entries[0].index}`} type="button" className={inspection?.ids.includes(`${p}-${paragraphs[p][l].entries[0].index}`)||highlighted===`${p}-${paragraphs[p][l].entries[0].index}`||(!highlighted&&(mode==='all'||(chapter===p&&(mode==='paragraph'||sentence===l))))?'is-active':''} aria-pressed={chapter===p&&sentence===l} onClick={()=>chooseSentence(p,l)}>{line}</button>)}</p>)}</div></aside>
    <section className="space-stage" aria-label={`${poemTitle}的三维音韵空间`}>
      <Canvas frameloop={traceView?'demand':'always'} camera={{ position: [11, 8, 19], fov: 46 }} dpr={[1, 1.25]} gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }} onCreated={({gl,scene,get})=>{renderForExport.current=()=>gl.render(scene,get().camera);}}><Scene key={`${poemId}-${chapter}-${sentence}-${generation}`} onLineSelect={id=>{setHighlighted(id);setInspection(null);const el=root.current?.querySelector(`[data-sentence-id="${id}"]`);el?.scrollIntoView({behavior:'smooth',block:'center'});}} inspection={inspection} onInspect={handleInspect} traceView={traceView} highlighted={highlighted} contextOpacity={contextOpacity} entries={mapped} paths={paths} strength={strength} selected={selected} onSelect={entry=>{setSelected(entry);playReading(entry);}} generation={generation} /></Canvas>
      <div className="evolution-controls"><button aria-pressed={mode==='paragraph'} onClick={()=>{setMode('paragraph');setSelected(null);setGeneration(n=>n+1);}}>整段演化</button><button aria-pressed={mode==='all'} onClick={()=>{setMode('all');setSelected(null);setGeneration(n=>n+1);}}>全诗演化</button>{mode!=='sentence'&&<button role="switch" aria-checked={bundlingEnabled} onClick={()=>setBundlingEnabled(value=>!value)}>{bundlingEnabled?'聚束：开':'聚束：关'}</button>}</div><div className="trace-controls"><button aria-pressed={contextOpacity===1} onClick={()=>{setContextOpacity(1);setTraceView(false);setHighlighted(null);}}>读诗</button><button aria-pressed={contextOpacity===0} onClick={()=>{setTraceView(true);setHighlighted(null);setContextOpacity(0);setMode('all');setSelected(null);setGeneration(n=>n+1);}}>观迹</button><label>光束与诗字<input aria-label="光束与诗字显隐" type="range" min="0" max="1" step=".01" value={contextOpacity} onChange={e=>setContextOpacity(Number(e.target.value))}/></label><button onClick={exportImage}>导出声迹 ↓</button><span aria-live="polite">{exportMessage}</span></div><div className="orbit-hint">{traceView?'悬停线段看字 · 点击线段定位原文 · 点击节点查看字':'拖动转观 · 滚轮缩放 · 点字寻音'}</div>
      <div className="light-legend"><span><i />声母</span><span><i />十六摄</span><span><i />四声</span></div>
    </section>
    {generated && mode==='sentence' && <nav className="poem-sequence" aria-label="按诗句字序选择"><span className="sequence-label">字序</span>{entries.map((entry, i) => <button key={i} type="button" aria-pressed={selected?.chapter === entry.chapter && selected?.index === entry.index} onClick={() => (setSelected(entry.initial ? entry : null), playReading(entry))} disabled={!entry.initial} title={entry.initial ? entry.review : '字库未收录，待补资料'}><small>{String(i + 1).padStart(2, '0')}</small>{entry.char}</button>)}</nav>}
    <div className="footer-poem"><form className="poem-form" onSubmit={generatePoem}><textarea aria-label="当前章节原文" value={sentences[sentence] || ''} readOnly /><button type="submit">重演光路 ↗</button><small aria-live="polite">{inputMessage}</small></form><span className="system-note" aria-live="polite">{audioMessage}<br/><a href="https://qieyun-tts.com/" target="_blank" rel="noopener noreferrer">到切韵TTS试听 ↗</a></span></div>
    {selected && <aside className="detail-panel" aria-live="polite"><button className="detail-close" type="button" onClick={() => setSelected(null)} aria-label="返回全览">×</button><p className="detail-kicker">音韵位置</p><h2>{selected.char}</h2><dl><div><dt>声母</dt><dd>{selected.initial}</dd></div><div><dt>韵类</dt><dd>{selected.rhyme} · {selected.group}摄</dd></div><div><dt>声调</dt><dd>{selected.tone}</dd></div><div><dt>反切</dt><dd>{selected.fanqie}</dd></div></dl><p className="reading-status">{selected.review}</p>{selected.candidates.length > 1 && <label className="reading-choice">候选读音<select value={overrides[`${selected.chapter}-${selected.index}`] ?? selected.candidates.findIndex(c=>c.position===selected.position)} onChange={event=>{const choice=Number(event.target.value);const candidate=selected.candidates[choice];setOverrides(o=>({...o,[`${selected.chapter}-${selected.index}`]:choice}));setSelected({...selected,...candidate,originalPosition:candidate.originalPosition,review:'手动选读',coord:locate(candidate.initial,candidate.tone,candidate.group)});}}>{selected.candidates.map((c,i)=><option key={i} value={i}>{c.position} · {c.fanqie}</option>)}</select></label>}<p className="detail-source">《广韵》音韵地位　{selected.position}</p></aside>}
  </main>;
}
