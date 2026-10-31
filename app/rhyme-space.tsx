'use client';

import precomputed from '../data/bundles-precomputed.json';
import lumingData from '../data/luming-display.json';
import shuoshuData from '../data/shuoshu-display.json';
import mangData from '../data/mang-display.json';
import beifengData from '../data/beifeng-display.json';
import jiguData from '../data/jigu-display.json';
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IntroOverlay } from './intro-overlay';

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

const DEFAULT_VIEW: [number, number, number] = [0, 4.4, 21.5];

function CameraRail({ selected, filmStart }: { selected: Entry | null; filmStart: number | null }) {
  const controls = useRef<React.ElementRef<typeof OrbitControls>>(null);
  const motion = useRef({ active: false, elapsed: 0, fromPosition: new THREE.Vector3(), toPosition: new THREE.Vector3(), fromTarget: new THREE.Vector3(), toTarget: new THREE.Vector3() });

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const nextTarget = selected ? new THREE.Vector3(...selected.coord) : new THREE.Vector3(0, 0, 0);
    const nextPosition = selected ? new THREE.Vector3(selected.coord[0] + 2.7, selected.coord[1] + 1.6, selected.coord[2] + 6.4) : new THREE.Vector3(...DEFAULT_VIEW);
    motion.current = { active: true, elapsed: 0, fromPosition: orbit.object.position.clone(), toPosition: nextPosition, fromTarget: orbit.target.clone(), toTarget: nextTarget };
  }, [selected]);

  useFrame((state, delta) => {
    const orbit = controls.current;
    const path = motion.current;
    if (orbit && filmStart !== null) {
      const t=(performance.now()-filmStart)/1000;
      const ease=(x:number)=>{const a=Math.max(0,Math.min(1,x));return a*a*(3-2*a);};
      const home=new THREE.Vector3(...DEFAULT_VIEW);
      const letter=new THREE.Vector3(-2.75,2.4,1.8);
      const close=letter.clone().add(new THREE.Vector3(2.5,4.5,9));
      let position=home.clone();let target=new THREE.Vector3();
      if(t<12){const a=ease((t-3)/4);position.lerpVectors(home,close,a);target.lerpVectors(new THREE.Vector3(),letter,a);}
      else if(t<19){const a=ease((t-12)/5);position.lerpVectors(close,home,a);target.lerpVectors(letter,new THREE.Vector3(),a);}
      orbit.object.position.copy(position);orbit.target.copy(target);orbit.update();state.invalidate();return;
    }
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

  return <OrbitControls ref={controls} onStart={() => { motion.current.active = false; }} makeDefault enableDamping dampingFactor={0.065} enablePan screenSpacePanning panSpeed={0.9} minDistance={3.2} maxDistance={40} minPolarAngle={0.3} maxPolarAngle={2.35} rotateSpeed={0.48} zoomSpeed={0.65} />;
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

/* 坐标轴：三臂从原点生长（reveal 0→1），刻度与轴名随之淡入 */
function AxisScaffold({ reveal }: { reveal: React.MutableRefObject<number> }) {
  const xMin = initialX(initials[0]) - INITIAL_STEP / 2;
  const xMax = initialX(initials[initials.length - 1]) + INITIAL_STEP / 2;
  const zNear = groupZ(rhymeGroups[0]) + GROUP_STEP / 2;
  const zFar = groupZ(rhymeGroups[rhymeGroups.length - 1]) - GROUP_STEP / 2;
  const yMin = toneY['平'] - TONE_STEP / 2;
  const yMax = toneY['入'] + TONE_STEP / 2;
  const baseY = yMin;
  const arms = useRef<THREE.Group>(null);
  const marks = useRef<THREE.Group>(null);
  useFrame(() => {
    const value = Math.max(0, Math.min(1, reveal.current));
    if (arms.current) {
      arms.current.scale.setScalar(Math.max(value, 0.0001));
      arms.current.visible = value > 0.002;
    }
    if (marks.current) {
      const fade = value <= 0.5 ? 0 : (value - 0.5) / 0.5;
      marks.current.visible = fade > 0.004;
      marks.current.traverse((object) => {
        const material = (object as THREE.Mesh).material as (THREE.Material & { opacity?: number }) | undefined;
        if (!material || typeof material.opacity !== 'number') return;
        const store = object.userData as { baseOpacity?: number };
        if (store.baseOpacity === undefined) store.baseOpacity = material.opacity;
        material.opacity = store.baseOpacity * fade;
      });
    }
  });
  return <group>
    <group ref={arms} position={[xMin, baseY, zNear]}>
      <Line points={[[0, 0, 0], [xMax - xMin, 0, 0]]} color="#91a79f" transparent opacity={0.42} lineWidth={0.7} />
      <Line points={[[0, 0, 0], [0, yMax - baseY, 0]]} color="#b6a983" transparent opacity={0.42} lineWidth={0.7} />
      <Line points={[[0, 0, 0], [0, 0, zFar - zNear]]} color="#82988f" transparent opacity={0.42} lineWidth={0.7} />
    </group>
    <group ref={marks}>
      {initials.map((label) => <AxisTick key={`ix-${label}`} axis="x" label={label} position={[initialX(label), baseY, zNear]} />)}
      {Object.entries(toneY).map(([label, y]) => <AxisTick key={`ty-${label}`} axis="y" label={label} position={[xMin, y, zNear]} />)}
      {rhymeGroups.map((label) => <AxisTick key={`gz-${label}`} axis="z" label={label} position={[xMin, baseY, groupZ(label)]} />)}
      {Array.from({ length: initials.length + 1 }, (_, index) => <TickMark key={`ix-boundary-${index}`} axis="x" position={[xMin + index * INITIAL_STEP, baseY, zNear]} />)}
      {Array.from({ length: 5 }, (_, index) => <TickMark key={`ty-boundary-${index}`} axis="y" position={[xMin, yMin + index * TONE_STEP, zNear]} />)}
      {Array.from({ length: rhymeGroups.length + 1 }, (_, index) => <TickMark key={`gz-boundary-${index}`} axis="z" position={[xMin, baseY, zNear - index * GROUP_STEP]} />)}
      <WorldLabel text="X 声母三十八" position={[xMax + 1.05, baseY, zNear]} color="#bd6659" scale={0.65} />
      <WorldLabel text="Y 四声" position={[xMin - 0.6, yMax + 0.55, zNear]} color="#bd6659" scale={0.65} />
      <WorldLabel text="Z 十六摄" position={[xMin - 0.7, baseY, zFar - 0.7]} color="#bd6659" scale={0.65} />
    </group>
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

function BundledPaths({ onLineSelect, paths, strength, focusId }: { onLineSelect:(id:string)=>void; paths: Entry[][]; strength: number; focusId: string | null }) {
  const [hovered,setHovered]=useState<number[]>([]);
  const curves=useMemo(()=>{
    const key=paths.map(path=>path.map(e=>`${e.chapter}:${e.index}:${e.char}:${e.position}`).join(',')).join('|');
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
  const activeIndices=hovered;
  const labels=activeIndices.flatMap(i=>{const c=curves[i];return [{point:c.points[0],text:c.pair.split('→')[0]},{point:c.points[c.points.length-1],text:c.pair.split('→')[1]}];}).filter((v,i,all)=>all.findIndex(other=>other.text===v.text&&other.point.distanceTo(v.point)<.01)===i);
  // 每条线的目标不透明度：悬停一条 > 单句聚焦 > 全诗常态
  const targets=curves.map((curve,i)=>{
    if(activeIndices.length)return activeIndices.includes(i)?1:.03;
    if(focusId)return curve.id===focusId?.95:.035;
    return .42;
  });
  const targetRef=useRef<number[]>([]);
  targetRef.current=targets;
  const materials=useRef<((THREE.Material & {opacity:number})|undefined)[]>([]);
  useFrame((state,delta)=>{
    const k=1-Math.pow(0.002,Math.min(delta,.1));   // 与帧率无关的阻尼
    let moving=false;
    for(let i=0;i<curves.length;i+=1){
      const material=materials.current[i];
      if(!material)continue;
      const target=targetRef.current[i]??.42;
      if(Math.abs(target-material.opacity)<.003){material.opacity=target;continue;}
      material.opacity+=(target-material.opacity)*k;
      moving=true;
    }
    // 按需渲染模式下，未到位就继续要帧，保证淡入淡出是连续的
    if(moving)state.invalidate();
  });
  return <group>{curves.map(({points,id,width},i)=>{
    const active=activeIndices.includes(i);
    const focused=focusId!==null&&id===focusId;
    return <group key={i}><Line ref={(object)=>{const material=object?.material as (THREE.Material & {opacity:number})|undefined;if(!material)return;materials.current[i]=material;if(material.userData.seeded===undefined){material.opacity=targets[i]??.42;material.userData.seeded=true;}}} points={points} color={active?'#ffe4a8':focused?'#f0e9cb':'#b9d9ca'} lineWidth={active?2.5:focused?Math.max(width,1.7):width} transparent depthWrite={false} depthTest={false} renderOrder={active||focused?10:1} onClick={e=>{e.stopPropagation();onLineSelect(id);}} onPointerMove={e=>{e.stopPropagation();const next=[i];setHovered(old=>old.length===next.length&&old.every((v,k)=>v===next[k])?old:next);document.body.style.cursor='pointer';}} onPointerOut={()=>{setHovered([]);document.body.style.cursor='';}}/></group>;
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

function Scene({ filmStart, onLineSelect, traceView, contextOpacity, entries, paths, strength, selected, onSelect, generation, axisReveal, focusId }: { filmStart: number | null; onLineSelect:(id:string)=>void; traceView: boolean; contextOpacity: number; entries: Entry[]; paths: Entry[][]; strength: number; selected: Entry | null; onSelect: (entry: Entry) => void; generation: number; axisReveal: React.MutableRefObject<number>; focusId: string | null }) {
  const [activeNode,setActiveNode]=useState<string|null>(null);
  const unique=entries.filter((entry,i)=>entries.findIndex(e=>e.coord.join()===entry.coord.join())===i);
  return <>
    <color attach="background" args={['#0b1315']} /><ambientLight intensity={.3}/><CameraRail selected={selected} filmStart={filmStart}/><AxisScaffold reveal={axisReveal}/>
    {contextOpacity>.005 && <FadingContext opacity={contextOpacity}>{unique.map((entry,index)=><ConstructionLight key={`light-${generation}-${index}`} entry={entry} delay={paths.length>1?index*.025:0} selected={selected?.position===entry.position}/>)}</FadingContext>}
    {paths.length>1?<BundledPaths onLineSelect={id=>{setActiveNode(null);onLineSelect(id);}} paths={paths} strength={strength} focusId={focusId}/>:<PoemPath key={generation} entries={entries}/>}
    {traceView && unique.map((entry,i)=><TraceNode key={`node-${i}`} entry={entry} entries={entries} activeNode={activeNode} onNodeSelect={setActiveNode}/>)}
    {contextOpacity>.005 && unique.map((entry,index)=><Glyph entries={entries} key={`${generation}-${index}`} entry={entry} index={paths.length>1?0:index} selected={selected?.position===entry.position} onSelect={()=>onSelect(entry)}/>)}
  </>;
}

/* ---------- 主组件 ---------- */

export function RhymeSpace() {
  const poems={qiyue:{title:'七月',section:'豳风',data:qiyueData},jianjia:{title:'蒹葭',section:'秦风',data:jianjiaData},taoyao:{title:'桃夭',section:'周南',data:taoyaoData},wuyi:{title:'无衣',section:'秦风',data:wuyiData},caiwei:{title:'采薇',section:'小雅',data:caiweiData},luming:{title:'鹿鸣',section:'小雅',data:lumingData},shuoshu:{title:'硕鼠',section:'魏风',data:shuoshuData},mang:{title:'氓',section:'卫风',data:mangData},beifeng:{title:'北风',section:'邶风',data:beifengData},jigu:{title:'击鼓',section:'邶风',data:jiguData}};
  const [introDone,setIntroDone]=useState(()=>new URLSearchParams(location.search).has('film'));
  // 坐标轴生长进度：进门动效尾帧溶解时由 0 → 1，让三维坐标轴在原地渐显
  const axisReveal=useRef(new URLSearchParams(location.search).has('film')?1:0);
  const [axisAnimating,setAxisAnimating]=useState(false);
  const revealAxis=useCallback((immediate?:boolean)=>{
    gsap.killTweensOf(axisReveal);
    setAxisAnimating(true);
    gsap.to(axisReveal,{current:1,duration:immediate?.55:1.7,delay:immediate?0:.85,ease:'power2.inOut',overwrite:true,onComplete:()=>setAxisAnimating(false)});
  },[]);
  const [filmStart,setFilmStart]=useState<number|null>(null);
  useEffect(()=>{
    if(!new URLSearchParams(location.search).has('film'))return;
    const t=setTimeout(()=>setFilmStart(performance.now()),600);
    return()=>clearTimeout(t);
  },[]);
  const [poemId,setPoemId]=useState<keyof typeof poems>('qiyue');
  const {data:qiyue,title:poemTitle,section:poemSection}=poems[poemId];
  const root = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [mode,setMode] = useState<'sentence'|'all'>('all');
  const [sentence, setSentence] = useState(0);
  const [chapter, setChapter] = useState(0);
  const [traceView] = useState(true);
  const [contextOpacity,setContextOpacity]=useState(0);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [generation, setGeneration] = useState(0);
  const [animating, setAnimating] = useState(false);
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 记录按下位置：平移/旋转结束后松手不应被判为「点空白退出」
  const pressRef = useRef<{ x: number; y: number } | null>(null);

  const charAudio = (audioManifest.characters ?? {}) as Record<string, string>;
  const charReading = ((audioManifest as { readings?: Record<string, string> }).readings ?? {}) as Record<string, string>;
  const sentAudio = (audioManifest.sentences ?? {}) as Record<string, string>;
  const audioReady = Object.keys(charAudio).length > 0;
  const [audioMessage, setAudioMessage] = useState(audioReady ? '' : '音频尚未生成');
  const player = useRef<HTMLAudioElement | null>(null);
  const [reading,setReading]=useState(false);
  const seqToken=useRef(0);   // 整诗连读的令牌：自增即打断
  const startAudio = (url: string, msg: string) => {
    seqToken.current+=1;
    if(player.current){player.current.onended=null;player.current.pause();}
    const audio = new Audio(url);
    player.current = audio;
    audio.play().then(() => { setAudioMessage(msg); }).catch((error:unknown)=>setAudioMessage((error as {name?:string})?.name==='NotAllowedError'?'浏览器拦截了自动播放 · 再点一次即可发声':'音频播放失败，请再点一次'));
    return audio;
  };
  const stopReading=()=>{
    seqToken.current+=1;
    if(player.current){player.current.onended=null;player.current.pause();}
    setReading(false);
    setAudioMessage('已暂停');
  };
  const playChar = (entry: Entry) => {
    const url = charAudio[entry.char];
    if (!url) { setAudioMessage(`「${entry.char}」暂无音频 · 目前仅《七月》已生成`); return; }
    const ph = charReading[entry.char];
    setReading(false);
    startAudio(url, `朗读「${entry.char}」${ph ? `　中古音 ${ph}` : ''}`);
  };
  useEffect(()=>()=>{player.current?.pause();if(animTimer.current)clearTimeout(animTimer.current);if(fadeTimer.current)clearTimeout(fadeTimer.current);},[]);

  const paragraphs = useMemo(()=>qiyue.map(c=>{
    let offset=0;
    return (c.text.match(/[^。？！]+[。？！]?/g)||[]).map(text=>{const count=[...text.replace(/[^\p{Script=Han}]/gu,'')].length;const result={text,entries:c.entries.slice(offset,offset+count)};offset+=count;return result;});
  }),[qiyue]);

  // 始终绘制全诗的所有句：单句模式下只靠透明度把其余句子淡出，不再重建场景
  const paths=useMemo<Entry[][]>(()=>{
    return paragraphs.flat().map(line=>line.entries.map(e=>{
      const choice=overrides[`${e.chapter}-${e.index}`];const reading=choice===undefined?e:{...e,...e.candidates[choice],review:'手动选读'};
      return {...reading,coord:locate(reading.initial,reading.tone,reading.group)};
    }));
  },[overrides,paragraphs]);
  // 单句模式要留下的那一句（与线条 id 同格式：章-首字序号）
  const firstEntry=paragraphs[chapter]?.[sentence]?.entries?.[0];
  const focusId=mode==='sentence'&&firstEntry?`${chapter}-${firstEntry.index}`:null;
  const entries=useMemo(()=>paths.flat(),[paths]);
  const mapped=entries.filter(e=>e.initial);

  const kickAnimation=()=>{setGeneration(n=>n+1);setAnimating(true);if(animTimer.current)clearTimeout(animTimer.current);animTimer.current=setTimeout(()=>setAnimating(false),7000);};

  // 点一句：其余句子淡出消失，只留这一句的线条（不重演），并念出这一句
  const chooseSentence=(p:number,l:number,silent?:boolean)=>{
    if(fadeTimer.current)clearTimeout(fadeTimer.current);
    setChapter(p);setSentence(l);setMode('sentence');setSelected(null);setContextOpacity(0);
    if(!silent)speakSentence(p,l);
  };
  // 回全诗（不重演）
  const showAll=()=>{if(fadeTimer.current)clearTimeout(fadeTimer.current);setMode('all');setSelected(null);setContextOpacity(0);};
  // 全诗演化（重演）
  const playAll=()=>{if(fadeTimer.current)clearTimeout(fadeTimer.current);setMode('all');setSelected(null);setContextOpacity(1);kickAnimation();fadeTimer.current=setTimeout(()=>setContextOpacity(0),4500);};

  const soloByLineId=(id:string)=>{
    const dash=id.indexOf('-');if(dash<0)return;
    const p=Number(id.slice(0,dash));const firstIndex=Number(id.slice(dash+1));
    const l=paragraphs[p]?.findIndex(line=>line.entries[0]&&line.entries[0].index===firstIndex);
    if(l!==undefined&&l>=0)chooseSentence(p,l);
  };

  const speakSentence=(p:number,l:number)=>{
    const url=sentAudio[`${poemId}-${p}-${l}`];
    if(!url){setAudioMessage('本句暂无音频 · 目前仅《七月》已生成');return;}
    const audio=startAudio(url,`朗读：${paragraphs[p][l].text}`);
    setReading(true);
    audio.onended=()=>setReading(false);
  };
  const playSentence=()=>speakSentence(chapter,sentence);

  // 朗读键：正在读 → 暂停；没在读 → 单句模式下念这一句，全诗模式下连读全诗
  const toggleReading=()=>{
    if(reading){stopReading();return;}
    if(mode==='sentence'){speakSentence(chapter,sentence);return;}
    const first=sentAudio[`${poemId}-0-0`];
    if(!first){setAudioMessage('整诗暂无音频 · 目前仅《七月》已生成');return;}
    playAll();
    const urls=paragraphs.flatMap((lines,p)=>lines.map((_,l)=>sentAudio[`${poemId}-${p}-${l}`])).filter((u):u is string=>!!u);
    const token=++seqToken.current;
    setReading(true);
    let i=0;
    const next=()=>{
      if(token!==seqToken.current)return;
      if(i>=urls.length){setReading(false);setAudioMessage('朗读完毕');return;}
      const url=urls[i];i+=1;
      if(player.current){player.current.onended=null;player.current.pause();}
      const audio=new Audio(url);player.current=audio;
      audio.onended=next;
      audio.play().then(()=>setAudioMessage(`连读全诗… ${i}/${urls.length}`)).catch(()=>{setReading(false);setAudioMessage('音频播放失败，请再点一次');});
    };
    next();
  };

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSelected(null);if(mode==='sentence')showAll();}};
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[mode]);

  useEffect(()=>{
    if(filmStart===null)return;
    setPoemId('qiyue');setSelected(null);setChapter(0);setSentence(0);setMode('all');setContextOpacity(0);setGeneration(n=>n+1);
    const timers:ReturnType<typeof setTimeout>[]=[];
    timers.push(setTimeout(()=>chooseSentence(0,0,true),4000));
    timers.push(setTimeout(()=>{showAll();},14000));
    return()=>timers.forEach(clearTimeout);
  },[filmStart]);

  useGSAP(() => { if (selected) gsap.fromTo('.detail-panel', { autoAlpha: 0, x: 28 }, { autoAlpha: 1, x: 0, duration: 0.7, ease: 'power3.out' }); }, { scope: root, dependencies: [selected], revertOnUpdate: true });

  return <main ref={root} className="rhyme-app" style={{'--context-opacity':contextOpacity} as React.CSSProperties}>
    {!introDone && <IntroOverlay onDone={()=>setIntroDone(true)} onReveal={revealAxis}/>}

    {/* 悬浮诗句：无框，直接浮在页面上 */}
    <aside className="poem-reader" aria-label={`${poemTitle}全文`}>
      <div className="reader-title">
        <h2>{poemTitle}</h2>
        <p>{poemSection}</p>
        <label className="poem-switch"><select aria-label="切换诗篇" value={poemId} onChange={event=>{setPoemId(event.target.value as keyof typeof poems);setChapter(0);setSentence(0);setOverrides({});setSelected(null);stopReading();showAll();kickAnimation();}}>{Object.entries(poems).map(([id,poem])=><option key={id} value={id}>{poem.title} · {poem.section}</option>)}</select></label>
      </div>
      <div className="poem-scroll">{qiyue.map((paragraph,p)=><p className="poem-paragraph" key={p}>{(paragraphs[p].map(s=>s.text)).map((line,l)=><button key={l} type="button" className={mode==='sentence'&&chapter===p&&sentence===l?'is-active':''} onClick={()=>chooseSentence(p,l)}>{line}</button>)}</p>)}</div>
    </aside>

    <section className="space-stage" aria-label={`${poemTitle}的三维音韵空间`} onPointerDown={e=>{pressRef.current={x:e.clientX,y:e.clientY};}}>
      <Canvas frameloop={filmStart!==null||animating||axisAnimating?'always':'demand'} camera={{ position: DEFAULT_VIEW, fov: 48 }} dpr={[1, 1.25]} gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }} onPointerMissed={e=>{const p=pressRef.current;if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>6)return;if(selected)setSelected(null);else if(mode==='sentence')showAll();}}><Scene filmStart={filmStart} key={`${poemId}-${generation}`} onLineSelect={soloByLineId} traceView={traceView} contextOpacity={contextOpacity} entries={mapped} paths={paths} strength={1} selected={selected} onSelect={entry=>{setSelected(entry);playChar(entry);}} generation={generation} axisReveal={axisReveal} focusId={focusId} /></Canvas>

      {/* 底部悬浮操作坞：朗读 / 重演光路 / 全诗演化 */}
      <div className="action-dock">
        {mode==='sentence'&&<p className="dock-line">{paragraphs[chapter][sentence].text}</p>}
        <div className="dock-buttons">
          <button className="glow-btn" type="button" onClick={toggleReading}><span>{reading?'暂停 ‖':'朗读 ▸'}</span></button>
          <button className="glow-btn" type="button" onClick={kickAnimation}><span>重演光路 ⟳</span></button>
          <button className="glow-btn" type="button" onClick={playAll}><span>全诗演化 ◎</span></button>
        </div>
        <span className="dock-status" aria-live="polite">{audioMessage}</span>
      </div>
    </section>

    {selected && <aside className="detail-panel" aria-live="polite"><button className="detail-close" type="button" onClick={() => setSelected(null)} aria-label="返回全览">×</button><p className="detail-kicker">音韵位置</p><h2>{selected.char}</h2><dl><div><dt>声母</dt><dd>{selected.initial}</dd></div><div><dt>韵类</dt><dd>{selected.rhyme} · {selected.group}摄</dd></div><div><dt>声调</dt><dd>{selected.tone}</dd></div><div><dt>反切</dt><dd>{selected.fanqie}</dd></div></dl><p className="reading-status">{selected.review}</p><div className="detail-audio"><button className="glow-btn" type="button" onClick={() => playChar(selected)}><span>朗读这个字 ▸</span></button><button className="glow-btn" type="button" onClick={() => playSentence()}><span>朗读整句 ▸</span></button>{charReading[selected.char] && <span className="detail-phoneme" title="中古音转写">{charReading[selected.char]}</span>}</div>{selected.candidates.length > 1 && <label className="reading-choice">候选读音<select value={overrides[`${selected.chapter}-${selected.index}`] ?? selected.candidates.findIndex(c=>c.position===selected.position)} onChange={event=>{const choice=Number(event.target.value);const candidate=selected.candidates[choice];setOverrides(o=>({...o,[`${selected.chapter}-${selected.index}`]:choice}));setSelected({...selected,...candidate,originalPosition:candidate.originalPosition,review:'手动选读',coord:locate(candidate.initial,candidate.tone,candidate.group)});}}>{selected.candidates.map((c,i)=><option key={i} value={i}>{c.position} · {c.fanqie}</option>)}</select></label>}<p className="detail-source">《广韵》音韵地位　{selected.position}</p></aside>}
  </main>;
}
