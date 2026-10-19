import TshetUinh from "tshet-uinh";

const text = "七月流火九月授衣";
const uniqueCharacters = [...new Set([...text])];

const records = uniqueCharacters.map((character) => ({
  character,
  readings: TshetUinh.資料.query字頭(character).map((entry) => {
    const position = entry.音韻地位;

    return {
      position: position.描述,
      initial: position.母,
      openness: position.呼,
      division: position.等,
      type: position.類,
      rime: position.韻,
      rimeGroup: position.攝,
      tone: position.聲,
      fanqie: entry.反切,
      source: entry.來源,
      gloss: entry.釋義,
    };
  }),
}));

console.log(JSON.stringify({ text, records }, null, 2));
