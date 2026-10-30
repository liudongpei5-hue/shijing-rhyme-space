import fs from 'node:fs';
import T from 'tshet-uinh';
const texts={
luming:[
'呦呦鹿鳴，食野之苹。我有嘉賓，鼓瑟吹笙。吹笙鼓簧，承筐是將。人之好我，示我周行。',
'呦呦鹿鳴，食野之蒿。我有嘉賓，德音孔昭。視民不恌，君子是則是傚。我有旨酒，嘉賓式燕以敖。',
'呦呦鹿鳴，食野之芩。我有嘉賓，鼓瑟鼓琴。鼓瑟鼓琴，和樂且湛。我有旨酒，以燕樂嘉賓之心。'],
shuoshu:[
'碩鼠碩鼠，無食我黍！三歲貫女，莫我肯顧。逝將去女，適彼樂土。樂土樂土，爰得我所。',
'碩鼠碩鼠，無食我麥！三歲貫女，莫我肯德。逝將去女，適彼樂國。樂國樂國，爰得我直。',
'碩鼠碩鼠，無食我苗！三歲貫女，莫我肯勞。逝將去女，適彼樂郊。樂郊樂郊，誰之永號？'],
mang:[
'氓之蚩蚩，抱布貿絲。匪來貿絲，來即我謀。送子涉淇，至于頓丘。匪我愆期，子無良媒。將子無怒，秋以為期。',
'乘彼垝垣，以望復關。不見復關，泣涕漣漣。既見復關，載笑載言。爾卜爾筮，體無咎言。以爾車來，以我賄遷。',
'桑之未落，其葉沃若。于嗟鳩兮，無食桑葚。于嗟女兮，無與士耽。士之耽兮，猶可說也。女之耽兮，不可說也。',
'桑之落矣，其黃而隕。自我徂爾，三歲食貧。淇水湯湯，漸車帷裳。女也不爽，士貳其行。士也罔極，二三其德。',
'三歲為婦，靡室勞矣。夙興夜寐，靡有朝矣。言既遂矣，至于暴矣。兄弟不知，咥其笑矣。靜言思之，躬自悼矣。',
'及爾偕老，老使我怨。淇則有岸，隰則有泮。總角之宴，言笑晏晏。信誓旦旦，不思其反。反是不思，亦已焉哉。'],
beifeng:[
'北風其涼，雨雪其雱。惠而好我，攜手同行。其虛其邪？既亟只且！',
'北風其喈，雨雪其霏。惠而好我，攜手同歸。其虛其邪？既亟只且！',
'莫赤匪狐，莫黑匪烏。惠而好我，攜手同車。其虛其邪？既亟只且！'],
jigu:[
'擊鼓其鏜，踴躍用兵。土國城漕，我獨南行。',
'從孫子仲，平陳與宋。不我以歸，憂心有忡。',
'爰居爰處，爰喪其馬。于以求之，于林之下。',
'死生契闊，與子成說。執子之手，與子偕老。',
'于嗟闊兮，不我活兮。于嗟洵兮，不我信兮。']
};
for(const [id,chapters] of Object.entries(texts)){
fs.writeFileSync(`data/${id}-text.json`,JSON.stringify(chapters,null,2)+'\n');
const result=chapters.map((text,chapter)=>({text,entries:[...text.replace(/[^\p{Script=Han}]/gu,'')].map((char,index)=>{
const candidates=T.資料.query字頭(({踴:'踊'})[char] || char);
if(!candidates.length)return {char,index,chapter,initial:'',rhyme:'',group:'',tone:'',fanqie:'',position:'未收录',review:'待补资料',candidates:[]};
const chosen=candidates[0],p=chosen.音韻地位;
return {char,index,chapter,initial:p.母,rhyme:p.韻,group:p.攝,tone:p.聲,fanqie:chosen.反切,position:p.描述,review:candidates.length===1?'单一候选':'多音待校订',candidates:candidates.map(e=>({position:e.音韻地位.描述,initial:e.音韻地位.母,rhyme:e.音韻地位.韻,group:e.音韻地位.攝,tone:e.音韻地位.聲,fanqie:e.反切,gloss:e.釋義}))};
})}));
fs.writeFileSync(`data/${id}.json`,JSON.stringify(result,null,2)+'\n');
const all=result.flatMap(c=>c.entries);console.log(id,{chapters:result.length,characters:all.length,pending:all.filter(e=>e.review==='多音待校订').length,missing:[...new Set(all.filter(e=>!e.initial).map(e=>e.char))]});
}
