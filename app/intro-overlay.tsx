'use client';

import './intro-overlay.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ---------- 编排时间轴（ms，相对组件挂载） ---------- */
const T_HANDS = 2600;    // 阶段2：双手撤出（mask 洞扩大 + 整体压暗）
const T_LIFT = 4600;     // 阶段3：照片淡出，丝线画布淡入
const T_FLOAT = 6200;    // 阶段4：漂浮 + 文字
const T_FALL = 9800;     // 阶段5：收拢落轴
const T_AXIS = 12200;    // 阶段6：坐标轴定格发光
const GLOW_MS = 400;     // 定格发光时长
const FADE_MS = 800;     // 遮罩整体淡出时长
const TITLE_MS = 6800;
const CONTACT_MS = 7600;
const TEXT_OUT_MS = 9400;
const REDUCED_MS = 700;  // prefers-reduced-motion：只短暂显示标题

/* 照片真实构图（像素分析得出）：自然尺寸 1600×883，左手重心约 (24%, 62%)，右手约 (78%, 62%) */
const NATURAL_AR = 1600 / 883;
const HAND_L = { x: 0.24, y: 0.62 };
const HAND_R = { x: 0.78, y: 0.62 };
const HOLE_RX = 0.17;    // 手部遮罩洞水平半径（显示宽度比例）
const HOLE_RY = 0.52;    // 手部遮罩洞垂直半径（显示高度比例）
const ORIGIN_X = 0.30;
const ORIGIN_Y = 0.78;
const THREAD_COUNT = 14;
const SURVIVORS = [0, 5, 10]; // 收拢后存活为 X/Y/Z 三臂的三条线

type Thread = {
  ax: number; ay: number;      // 左指尖锚点（视口比例）
  bx: number; by: number;      // 右指尖锚点
  c1x: number; c1y: number;    // 贝塞尔控制点（中部编织区）
  c2x: number; c2y: number;
  amp: number;                 // 起伏幅度（视口高比例）
  freq: number;                // 起伏角速度 rad/s
  seed: number;                // 相位
  fade: number;                // 收拢阶段错峰淡出起点（0–0.35）
  arm: number;                 // 0=X 1=Y 2=Z，-1 = 非存活线
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (v: number) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
const easeIn = (v: number) => Math.pow(clamp01(v), 3);
const easeInOut = (v: number) => { const t = clamp01(v); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* 固定种子：丝线形态每次进入页面一致 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildThreads(): Thread[] {
  const rnd = mulberry32(0x5b27);
  const list: Thread[] = [];
  for (let i = 0; i < THREAD_COUNT; i++) {
    const spread = i / (THREAD_COUNT - 1) - 0.5;   // -0.5 … 0.5 纵向铺开
    const cross = i % 2 === 0 ? 1 : -1;            // 交错方向 → 中部形成编织交叉
    list.push({
      ax: HAND_L.x + (rnd() - 0.5) * 0.03,
      ay: HAND_L.y + spread * 0.10 + (rnd() - 0.5) * 0.02,
      bx: HAND_R.x + (rnd() - 0.5) * 0.03,
      by: HAND_R.y + spread * 0.10 + (rnd() - 0.5) * 0.02,
      c1x: 0.35 + rnd() * 0.06,
      c1y: 0.425 + cross * 0.115 + (rnd() - 0.5) * 0.03,
      c2x: 0.61 + rnd() * 0.06,
      c2y: 0.425 - cross * 0.115 + (rnd() - 0.5) * 0.03,
      amp: 0.004 + rnd() * 0.006,
      freq: 0.5 + rnd() * 0.55,
      seed: rnd() * Math.PI * 2,
      fade: (i / THREAD_COUNT) * 0.35,
      arm: SURVIVORS.indexOf(i),
    });
  }
  return list;
}

export function IntroOverlay({ onDone }: { onDone: () => void }) {
  const [reduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [phase, setPhase] = useState(1);
  const [copy, setCopy] = useState(0);   // 0 无文字 / 1 标题 / 2 标题+联系 / 3 整体淡出
  const [leaving, setLeaving] = useState(false);

  const shotRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timersRef = useRef<number[]>([]);
  const rafRef = useRef(0);
  const doneRef = useRef(false);
  const skipRef = useRef(false);
  const clockRef = useRef({ t0: 0, jump: 0 });   // elapsed = now - t0 + jump
  const sizeRef = useRef({ w: 0, h: 0, dirty: true });
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const threads = useMemo(() => buildThreads(), []);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  }, []);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);
  const schedule = useCallback((ms: number, fn: () => void) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);

  /* 主时间轴：状态机 + setTimeout 推进阶段 */
  useEffect(() => {
    if (reduced) return;
    clockRef.current = { t0: performance.now(), jump: 0 };
    schedule(T_HANDS, () => setPhase(2));
    schedule(T_LIFT, () => setPhase(3));
    schedule(T_FLOAT, () => setPhase(4));
    schedule(T_FALL, () => setPhase(5));
    schedule(T_AXIS, () => setPhase(6));
    schedule(TITLE_MS, () => setCopy(1));
    schedule(CONTACT_MS, () => setCopy(2));
    schedule(TEXT_OUT_MS, () => setCopy(3));
    schedule(T_AXIS + GLOW_MS, () => setLeaving(true));
    schedule(T_AXIS + GLOW_MS + FADE_MS, finish);
    return clearTimers;
  }, [reduced, schedule, clearTimers, finish]);

  /* prefers-reduced-motion：跳过全部动画，短暂显示标题后淡出交棒 */
  useEffect(() => {
    if (!reduced) return;
    const t1 = window.setTimeout(() => setLeaving(true), REDUCED_MS);
    const t2 = window.setTimeout(finish, REDUCED_MS + 500);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [reduced, finish]);

  /* 跳过：快进到阶段6（坐标轴定格），随后照常发光、淡出 */
  const skip = useCallback(() => {
    if (doneRef.current || reduced || skipRef.current) return;
    skipRef.current = true;
    clearTimers();
    clockRef.current.jump = T_AXIS - (performance.now() - clockRef.current.t0);
    setPhase(6);
    setCopy(0);
    schedule(GLOW_MS, () => setLeaving(true));
    schedule(GLOW_MS + FADE_MS, finish);
  }, [clearTimers, finish, reduced, schedule]);

  /* Esc 也可跳过（与跳过按钮等价），已进入交棒阶段则忽略 */
  useEffect(() => {
    if (reduced) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') skip(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reduced, skip]);

  useEffect(() => {
    const mark = () => { sizeRef.current.dirty = true; };
    window.addEventListener('resize', mark);
    window.addEventListener('orientationchange', mark);
    return () => {
      window.removeEventListener('resize', mark);
      window.removeEventListener('orientationchange', mark);
    };
  }, []);

  /* 主循环：照片 mask / 压暗 / 推近由 CSS 变量驱动，丝线由 canvas 绘制 */
  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    const shot = shotRef.current;
    if (!canvas || !shot) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const step = (now: number) => {
      rafRef.current = requestAnimationFrame(step);
      const el = now - clockRef.current.t0 + clockRef.current.jump;
      const s = sizeRef.current;
      if (s.dirty) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        s.w = w;
        s.h = h;
        s.dirty = false;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // 视口比照片窄 → contain（双手保证可见）；视口比照片宽 → cover 竖向裁切（双手居中不受影响）
        shot.classList.toggle('is-contain', w / h < NATURAL_AR);
      }
      const w = s.w;
      const h = s.h;

      // 照片在 cover/contain 下的实际显示几何，用于反算双手的屏幕坐标
      const contain = w / h < NATURAL_AR;
      const dispW = contain ? w : h * NATURAL_AR;
      const dispH = contain ? w / NATURAL_AR : h;
      const offX = (w - dispW) / 2;
      const offY = (h - dispH) / 2;

      // 阶段1：黑场淡入 + Ken Burns 缓推；阶段2：双手遮罩洞扩大 + 整体压暗；阶段3：照片淡出
      const shotOp = smoothstep(el / 1200) * (1 - smoothstep((el - T_LIFT) / (T_FLOAT - T_LIFT)));
      const zoom = 1 + 0.045 * easeOut(el / T_LIFT);
      const hole = smoothstep((el - T_HANDS) / (T_LIFT - T_HANDS));
      const dim = 0.62 * smoothstep((el - T_HANDS - 200) / (T_LIFT - T_HANDS));
      shot.style.setProperty('--intro-shot-op', shotOp.toFixed(3));
      shot.style.setProperty('--intro-zoom', zoom.toFixed(4));
      shot.style.setProperty('--intro-hole-cx1', (offX + HAND_L.x * dispW).toFixed(1) + 'px');
      shot.style.setProperty('--intro-hole-cy1', (offY + HAND_L.y * dispH).toFixed(1) + 'px');
      shot.style.setProperty('--intro-hole-cx2', (offX + HAND_R.x * dispW).toFixed(1) + 'px');
      shot.style.setProperty('--intro-hole-cy2', (offY + HAND_R.y * dispH).toFixed(1) + 'px');
      shot.style.setProperty('--intro-hole-x', (hole * HOLE_RX * dispW).toFixed(1) + 'px');
      shot.style.setProperty('--intro-hole-y', (hole * HOLE_RY * dispH).toFixed(1) + 'px');
      shot.style.setProperty('--intro-dim', dim.toFixed(3));

      const canvasOp = smoothstep((el - T_LIFT) / 1200);
      canvas.style.opacity = canvasOp.toFixed(3);
      if (canvasOp <= 0.001) return;

      // 阶段4：水母触须式起伏 + 极慢下漂；阶段5：收拢落轴；阶段6：发光
      const morph = easeInOut((el - T_FALL) / (T_AXIS - T_FALL));
      const glow = smoothstep((el - T_AXIS) / GLOW_MS);
      const drift = 0.008 * h * Math.max(0, (el - T_FLOAT) / 1000);
      const armPx = Math.min((w <= 720 ? 0.30 : 0.22) * w, h * 0.30);
      const ox = ORIGIN_X * w;
      const oy = ORIGIN_Y * h;
      const tips: [number, number][] = [
        [ox + armPx, oy],
        [ox, oy - armPx],
        [ox - armPx * 0.7071, oy + armPx * 0.7071],
      ];

      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';
      const tt = el / 1000;
      const paths: { path: Path2D; alpha: number }[] = [];
      for (let i = 0; i < threads.length; i++) {
        const t = threads[i];
        const sway1 = Math.sin(tt * t.freq + t.seed);
        const sway2 = Math.sin(tt * t.freq * 1.37 + t.seed * 1.7 + 0.9);
        const amp = t.amp * h;
        let p0x = offX + t.ax * dispW; let p0y = offY + t.ay * dispH + drift + sway1 * amp * 0.35;
        let p3x = offX + t.bx * dispW; let p3y = offY + t.by * dispH + drift + sway2 * amp * 0.35;
        let c1x = offX + t.c1x * dispW + sway2 * amp * 0.5; let c1y = offY + t.c1y * dispH + drift + sway1 * amp;
        let c2x = offX + t.c2x * dispW + sway1 * amp * 0.5; let c2y = offY + t.c2y * dispH + drift + sway2 * amp;
        let alpha = 0.92;
        if (morph > 0) {
          if (t.arm >= 0) {
            // 存活线：端点先行、控制点滞后 → 触须拉伸感地收拢成笔直轴臂
            const [tx, ty] = tips[t.arm];
            const sCtl = morph * (1 - 0.18 * Math.sin(Math.PI * morph));
            p0x = lerp(p0x, ox, morph); p0y = lerp(p0y, oy, morph);
            p3x = lerp(p3x, tx, morph); p3y = lerp(p3y, ty, morph);
            c1x = lerp(c1x, ox + (tx - ox) / 3, sCtl); c1y = lerp(c1y, oy + (ty - oy) / 3, sCtl);
            c2x = lerp(c2x, ox + (tx - ox) * 2 / 3, sCtl); c2y = lerp(c2y, oy + (ty - oy) * 2 / 3, sCtl);
          } else {
            // 其余线：锚点向原点收拢、加速下坠、错峰淡出
            const sEnd = morph * 0.85;
            const drop = 0.1 * h * easeIn(morph);
            p0x = lerp(p0x, ox, sEnd); p0y = lerp(p0y, oy, sEnd) + drop;
            p3x = lerp(p3x, ox, sEnd); p3y = lerp(p3y, oy, sEnd) + drop;
            c1x = lerp(c1x, ox, sEnd * 0.8); c1y = lerp(c1y, oy, sEnd * 0.8) + drop;
            c2x = lerp(c2x, ox, sEnd * 0.8); c2y = lerp(c2y, oy, sEnd * 0.8) + drop;
            alpha *= 1 - smoothstep((morph - t.fade) / 0.4);
          }
        }
        if (alpha <= 0.01) continue;
        const path = new Path2D();
        path.moveTo(p0x, p0y);
        path.bezierCurveTo(c1x, c1y, c2x, c2y, p3x, p3y);
        paths.push({ path, alpha });
      }
      // 微发光 = 外层宽而淡 + 内层实线，避免每帧 shadowBlur / blur 大面积合成
      ctx.lineWidth = 3.2 + glow * 1.6;
      ctx.strokeStyle = 'rgba(240,233,203,0.085)';
      for (const p of paths) { ctx.globalAlpha = p.alpha * (0.85 + glow * 1.6); ctx.stroke(p.path); }
      ctx.lineWidth = 1.3 + glow * 0.25;
      ctx.strokeStyle = '#f0e9cb';
      for (const p of paths) { ctx.globalAlpha = p.alpha * (0.9 + glow * 0.1); ctx.stroke(p.path); }
      ctx.globalAlpha = 1;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [reduced, threads]);

  if (reduced) {
    return (
      <div className={`intro-veil${leaving ? ' is-out' : ''}`}>
        <div className="intro-backdrop" />
        <div className="intro-copy">
          <div className="intro-hero is-in">
            <h1 className="intro-hero-title">诗经 · 声迹</h1>
            <p className="intro-hero-sub">一根线，牵出声音的空间</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`intro-veil${phase >= 3 ? ' is-thread' : ''}${leaving ? ' is-out' : ''}`}>
      <div className="intro-backdrop" />
      <div className="intro-shot" ref={shotRef}>
        <img className="intro-shot-img" src="./intro/hands.jpg" alt="" aria-hidden="true" draggable={false} />
        <div className="intro-shot-breath" />
        <div className="intro-shot-dim" />
      </div>
      <canvas className="intro-thread-canvas" ref={canvasRef} aria-hidden="true" />
      <div className={`intro-copy${copy >= 3 ? ' is-out' : ''}`}>
        <div className={`intro-hero${copy >= 1 ? ' is-in' : ''}`}>
          <h1 className="intro-hero-title">诗经 · 声迹</h1>
          <p className="intro-hero-sub">一根线，牵出声音的空间</p>
        </div>
        <div className={`intro-contact${copy >= 2 ? ' is-in' : ''}`}>
          <span className="intro-mail">刘东沛 · 134011730@qq.com</span>
          <span className="intro-site">liudongpei5-hue.github.io/shijing-rhyme-space</span>
        </div>
      </div>
      <button type="button" className="intro-skip-btn" onClick={skip}>跳过 ›</button>
    </div>
  );
}
