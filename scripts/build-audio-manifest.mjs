import {readdirSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const audioDir = join(root, 'public', 'audio');

const manifest = {
  scheme: 'local-files',
  source: 'qieyun-tts.com（切韵TTS，作者 cinix）',
  license: '仅用于本作品学术展示，正式投稿前需取得作者许可',
  characters: {},
  sentences: {},
  paragraphs: {}
};

if (!existsSync(audioDir)) {
  mkdirSync(audioDir, {recursive: true});
  console.log('已创建 public/audio/ 文件夹，把下载好的音频放进来再运行一次');
} else {
  const files = readdirSync(audioDir).filter(f => /\.(mp3|wav|ogg|m4a|webm)$/i.test(f));
  for (const file of files) {
    const base = file.replace(/\.[^.]+$/, '');
    const url = `./audio/${file}`;
    const char = base.match(/^char-([^-]+)-(.+)$/);
    const sent = base.match(/^sent-([a-z]+)-(\d+)-(\d+)$/);
    const para = base.match(/^para-([a-z]+)-(\d+)(?:-(\d+))?$/);
    if (char) manifest.characters[`${char[1]}-${char[2]}`] = url;
    else if (sent) manifest.sentences[`${sent[1]}-${sent[2]}-${sent[3]}`] = url;
    else if (para) manifest.paragraphs[para[3] === undefined ? `${para[1]}-${para[2]}` : `${para[1]}-${para[2]}-${para[3]}`] = url;
    else console.log(`未识别的文件名，已跳过：${file}`);
  }
  console.log(`扫描完成：单字 ${Object.keys(manifest.characters).length} 个，整句 ${Object.keys(manifest.sentences).length} 个，整章 ${Object.keys(manifest.paragraphs).length} 个`);
}

writeFileSync(join(root, 'data', 'audio-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('data/audio-manifest.json 已更新');
