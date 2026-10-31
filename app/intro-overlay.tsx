'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import './intro-overlay.css';

type Stage = 'title' | 'video' | 'morph';

/* ---------- 时间轴（毫秒） ---------- */
const TITLE_MS = 3200;       // 标题屏：作品名 + 邮箱
const PUSH_MS = 2500;        // 尾帧推进时长
const DISSOLVE_DELAY = 620;  // 推进开始后多久开始溶解
const DISSOLVE_MS = 1450;    // 溶解时长
const REVEAL_AT = 820;       // 坐标轴开始生长的时刻
const HOLD_MS = 360;         // 溶解结束后停留
const FADE_MS = 850;         // 遮罩淡出（交棒给三维场景）
const PUSH_SCALE = 2.2;      // 推进倍率

/* 尾帧中「线团」的位置（占画面宽高的比例）——若线团不在画面正中，只改这两个数 */
const PUSH_X = 0.5;
const PUSH_Y = 0.46;

const VIDEO_SRC = './intro/intro.mp4';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => { const x = clamp01(v); return x * x * (3 - 2 * x); };

export function IntroOverlay({ onDone, onReveal }: { onDone: () => void; onReveal?: (immediate?: boolean) => void }) {
  const [stage, setStage] = useState<Stage>('title');
  const [leaving, setLeaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const doneRef = useRef(false);
  const revealedRef = useRef(false);
  // 回调放进 ref：父组件重渲染不会打断进行中的时间轴
  const doneCb = useRef(onDone);
  doneCb.current = onDone;
  const revealCb = useRef(onReveal);
  revealCb.current = onReveal;

  const later = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    clearTimers();
    revealCb.current?.(true);
    setLeaving(true);
    later(FADE_MS, () => doneCb.current());
  }, [clearTimers, later]);

  /* 标题屏 → 视频 */
  useEffect(() => {
    if (stage !== 'title') return;
    const id = window.setTimeout(() => setStage('video'), TITLE_MS);
    timers.current.push(id);
    return () => window.clearTimeout(id);
  }, [stage]);

  /* 视频阶段：起播 + 兜底计时（若 ended 未触发也能继续） */
  useEffect(() => {
    if (stage !== 'video') return;
    const video = videoRef.current;
    if (video) void video.play().catch(() => undefined);
    const id = window.setTimeout(() => setStage((s) => (s === 'video' ? 'morph' : s)), 12000);
    timers.current.push(id);
    return () => window.clearTimeout(id);
  }, [stage]);

  /* 尾帧推进 → 溶解 → 交棒 */
  useEffect(() => {
    if (stage !== 'morph') return;
    if (frameRef.current) frameRef.current.classList.add('is-morph');
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - t0;
      const p = clamp01(elapsed / PUSH_MS);
      const push = 1 + (PUSH_SCALE - 1) * p * p;          // 加速推进
      const fade = 1 - smooth((elapsed - DISSOLVE_DELAY) / DISSOLVE_MS); // 画面与底色的溶解
      const frame = frameRef.current;
      if (frame) {
        frame.style.transform = `scale(${push.toFixed(4)})`;
        frame.style.opacity = fade.toFixed(3);
      }
      if (veilRef.current) veilRef.current.style.setProperty('--intro-bg-op', fade.toFixed(3));
      if (!revealedRef.current && elapsed >= REVEAL_AT) {
        revealedRef.current = true;
        revealCb.current?.();
      }
      if (elapsed < PUSH_MS + HOLD_MS) {
        raf = requestAnimationFrame(tick);
      } else {
        finish();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, finish]);

  /* 卸载清理 */
  useEffect(() => clearTimers, [clearTimers]);

  /* prefers-reduced-motion：只闪一下标题 */
  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setTimeout(finish, 900);
    return () => window.clearTimeout(id);
  }, [finish]);

  const frameOn = stage !== 'title';

  return (
    <div ref={veilRef} className={`intro-veil${leaving ? ' is-out' : ''}`}>
      {stage === 'title' && (
        <div className="intro-titlecard">
          <h1 className="intro-title-main">诗经 · 声迹</h1>
          <span className="intro-hairline" aria-hidden="true" />
          <p className="intro-title-mail">134011730@qq.com</p>
        </div>
      )}

      <div ref={frameRef} className={`intro-frame${frameOn ? ' is-on' : ''}`} style={{ transformOrigin: `${PUSH_X * 100}% ${PUSH_Y * 100}%` }}>
        <video
          ref={videoRef}
          className="intro-video"
          src={VIDEO_SRC}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onEnded={() => setStage((s) => (s === 'video' ? 'morph' : s))}
          onError={finish}
        />
      </div>

      {!leaving && (
        <button type="button" className="intro-skip-btn" onClick={finish}>
          <span>跳过 ›</span>
        </button>
      )}
    </div>
  );
}
