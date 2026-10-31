import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dataDir = join(root, 'data');

const all = {
  qiyue: ['七月', '豳风'],
  jianjia: ['蒹葭', '秦风'],
  taoyao: ['桃夭', '周南'],
  wuyi: ['无衣', '秦风'],
  caiwei: ['采薇', '小雅'],
  luming: ['鹿鸣', '小雅'],
  shuoshu: ['硕鼠', '魏风'],
  mang: ['氓', '卫风'],
  beifeng: ['北风', '邶风'],
  jigu: ['击鼓', '邶风']
};
const wanted = process.argv.slice(2).filter(a => all[a]);
const ids = wanted.length ? wanted : ['qiyue'];
const poems = ids.map(id => [id, all[id][0], all[id][1]]);

const SENTENCE = /[^。？！]+[。？！]?/g;
const hanCount = t => (t.match(/[一-鿿]/g) || []).length;

// 切韵TTS 的字数上限是 50，且标点也算一个字，所以按句累积、含标点一起算
const LIMIT = 50;
function chunkSentences(list) {
  const total = list.reduce((a, s) => a + s.length, 0);
  const n = Math.max(1, Math.ceil(total / LIMIT));
  const target = total / n;
  const suffix = new Array(list.length + 1).fill(0);
  for (let i = list.length - 1; i >= 0; i -= 1) suffix[i] = suffix[i + 1] + list[i].length;
  const groups = [];
  let cur = [];
  let len = 0;
  list.forEach((s, i) => {
    const groupsLeftAfter = n - groups.length - 1;
    const tooLong = len + s.length > LIMIT;
    const balanced = len >= target && suffix[i] <= groupsLeftAfter * LIMIT;
    if (cur.length && (tooLong || balanced)) { groups.push(cur); cur = []; len = 0; }
    cur.push(s); len += s.length;
  });
  if (cur.length) groups.push(cur);
  return groups;
}

const segments = {};
let rows = '';
let total = 0;
let chaptersCount = 0;
let segCount = 0;

for (const [id, title, section] of poems) {
  const chapters = JSON.parse(readFileSync(join(dataDir, `${id}-text.json`), 'utf8'));
  segments[id] = {};
  chaptersCount += chapters.length;
  let block = `<details class="poem" data-poem="${id}" open><summary><b>${title}</b><span>${section} · ${chapters.length}章</span></summary>`;
  chapters.forEach((text, c) => {
    const sentences = text.match(SENTENCE) || [];
    const groups = chunkSentences(sentences);
    const map = [];
    groups.forEach((g, i) => g.forEach(() => map.push(i)));
    segments[id][String(c)] = map;
    block += `<div class="chapter"><div class="chapter-head">第${c + 1}章<span>${hanCount(text)}字 · 含标点${text.length}字符 · 拆成${groups.length}段</span></div>`;
    groups.forEach((group, seg) => {
      const piece = group.join('');
      segCount += 1;
      const name = `para-${id}-${c}-${seg}.mp3`;
      block += `<div class="row para"><label><input type="checkbox" data-key="${name}"/><code>${name}</code></label><button class="copy" data-copy="${piece}">复制这段 · ${piece.length}字</button><input class="text" readonly value="${piece}"/><span class="ok">可直接粘贴</span></div>`;
    });
    block += `<details class="sub"><summary>或按句下载（${sentences.length}句）</summary>`;
    sentences.forEach((line, s) => {
      total += 1;
      const name = `sent-${id}-${c}-${s}.mp3`;
      block += `<div class="row"><label><input type="checkbox" data-key="${name}"/><code>${name}</code></label><button class="copy" data-copy="${line}">复制这句 · ${line.length}字</button><input class="text" readonly value="${line}"/></div>`;
    });
    block += `</details></div>`;
  });
  block += `</details>`;
  rows += block;
}

writeFileSync(join(dataDir, 'audio-segments.json'), JSON.stringify(segments, null, 2));

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>中古音音频下载清单 · 诗经声迹</title>
<style>
body{margin:0;padding:32px 28px 60px;background:#f7f6f2;color:#22201c;font:15px/1.7 system-ui,-apple-system,"PingFang SC",serif}
h1{font-size:19px;font-weight:600;margin:0 0 6px}
.lead{margin:0 0 18px;color:#5f5e5a;font-size:14px}
.steps{background:#fff;border:1px solid #e3e0d6;border-radius:12px;padding:16px 18px;margin-bottom:24px}
.steps ol{margin:6px 0 0;padding-left:20px}
.steps li{margin:4px 0}
.path{background:#efeee7;border-radius:6px;padding:2px 6px;font:13px ui-monospace,monospace}
.poem{border:1px solid #e3e0d6;border-radius:12px;background:#fff;margin-bottom:12px;overflow:hidden}
.poem>summary{padding:12px 16px;cursor:pointer;display:flex;gap:10px;align-items:baseline}
.poem>summary span{color:#8a887e;font-size:13px}
.chapter{padding:8px 16px 14px;border-top:1px solid #f0eee6}
.chapter-head{font-size:13px;color:#5f5e5a;margin:8px 0 6px}
.chapter-head span{margin-left:8px;color:#a3a099}
.row{display:flex;gap:8px;align-items:center;padding:4px 0;flex-wrap:wrap}
.row code{font:13px ui-monospace,monospace;background:#efeee7;border-radius:5px;padding:2px 6px}
.row .text{flex:1 1 320px;min-width:260px;color:#4a4842;font:14px/1.5 system-ui,serif;border:1px solid #e3e0d6;border-radius:6px;background:#fbfaf6;padding:4px 8px;cursor:text}
.row .text:focus{outline:2px solid #b5d4f4;background:#fff}
#copy-status{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#22201c;color:#fff;font-size:13px;padding:8px 16px;border-radius:20px;opacity:.95}
.row.para{background:#faf9f5;border-radius:8px;padding:8px;margin-bottom:6px}
.warn{color:#b4531a;font-size:12px}
.ok{color:#3b6d11;font-size:12px}
.sub{margin:4px 0 10px 8px}
.sub>summary{cursor:pointer;font-size:13px;color:#5f5e5a;padding:3px 0}
button.copy{border:1px solid #cfcbc0;background:#fff;border-radius:6px;padding:3px 9px;font-size:12px;cursor:pointer}
button.copy:hover{background:#f2f0e9}
.done{opacity:.45}
footer{margin-top:24px;color:#8a887e;font-size:13px}
</style></head><body>
<h1>中古音音频下载清单 · ${poems.map(p => `《${p[1]}》`).join('')}</h1>
<p class="lead">共 ${chaptersCount} 章 / <b>${segCount} 段</b>（另可选 ${total} 句）。<b>按段下载即可</b>：切韵TTS 上限 50 字且标点也计字，所以每章已按句拆成不超限的片段。点网页里的字，会播它所在那一段。勾掉已下载的，进度存在这台电脑的浏览器里。</p>
<div class="steps">
<b>怎么下载一个音频</b>
<ol>
<li>点「复制这段」→ 打开 <a href="https://qieyun-tts.com/" target="_blank" rel="noopener">qieyun-tts.com</a>，粘进「漢字輸入」框</li>
<li>多音字按《广韵》释义选一下读音，点「生成語音」</li>
<li>生成完点「下載當前音頻」</li>
<li>把文件<b>改名</b>成这一行前面写的名字（比如 <code>para-qiyue-0-0.mp3</code>）</li>
<li>丢进这个文件夹：<span class="path">${root}/public/audio/</span></li>
<li>告诉我一声，我跑一下扫描脚本，网页里点字就能响了</li>
</ol>
<p style="margin:8px 0 0;font-size:13px;color:#5f5e5a">想让点字只念这一个字，就按<b>单字</b>下载，文件名写成 <code>char-简体字-音韵地位.mp3</code>，例：<code>char-七-清開三真入.mp3</code>（音韵地位在网页里点开这个字、「《广韵》音韵地位」那一行）。单字音频优先于整段播放。</p>
</div>
${rows}
<div id="copy-status" aria-live="polite"></div>
<footer>音频来源：切韵TTS（作者 cinix）· 仅用于本作品的学术展示 · 如用于正式投稿请先取得作者许可</footer>
<script>
const status = document.getElementById('copy-status');
const say = msg => { status.textContent = msg; setTimeout(() => { status.textContent = ''; }, 3000); };
function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.left = '0'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  return ok;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('button.copy'); if (!b) return;
  const text = b.dataset.copy;
  let ok = false;
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; } } catch (e) { ok = false; }
  if (!ok) ok = legacyCopy(text);
  const old = b.textContent;
  if (ok) { b.textContent = '已复制 ✓'; say('已复制到剪贴板，去网站粘贴即可'); }
  else { b.textContent = '点右侧框手动复制'; const box = b.parentElement.querySelector('input.text'); box.focus(); box.select(); say('自动复制被浏览器拦住了：右侧框里的字已全选，按 Cmd+C 即可'); }
  setTimeout(() => { b.textContent = old; }, 2000);
});
document.addEventListener('click', e => { const box = e.target.closest('input.text'); if (box) { box.focus(); box.select(); } });
const boxes = [...document.querySelectorAll('input[data-key]')];
const store = 'shijing-audio-progress';
let done = {};
try { done = JSON.parse(localStorage.getItem(store) || '{}'); } catch (e) { done = {}; }
boxes.forEach(box => {
  box.checked = !!done[box.dataset.key];
  box.parentElement.parentElement.classList.toggle('done', box.checked);
  box.addEventListener('change', () => {
    done[box.dataset.key] = box.checked;
    box.parentElement.parentElement.classList.toggle('done', box.checked);
    localStorage.setItem(store, JSON.stringify(done));
  });
});
</script></body></html>`;

writeFileSync(join(root, 'public', 'audio-guide.html'), html);
console.log(`audio-guide.html 已生成：${chaptersCount} 章 / ${segCount} 段（另 ${total} 句）`);
console.log('data/audio-segments.json 已更新（句索引 → 段号映射）');
