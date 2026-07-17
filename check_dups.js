const fs = require('fs');

function checkFile(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const m = raw.match(/window\.ALL_DRAWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
  // 处理非标准JSON（无引号key、尾逗号等）
  let jsonStr = m[1]
    .replace(/'/g, '"')
    .replace(/(\w+)\s*:/g, '"$1":')  // 给key加引号
    .replace(/,\s*}/g, '}')
    .replace(/,\s*\]/g, ']');
  let D = JSON.parse(jsonStr);
  console.log(`\n=== ${path} ===`);
  console.log(`总条数: ${D.length}`);
  
  const seen = new Map();
  let dups = 0;
  D.forEach(d => {
    const k = d.front.slice().sort((a,b)=>a-b).join(',') + '|' + d.back.slice().sort((a,b)=>a-b).join(',');
    if (seen.has(k)) {
      dups++;
      console.log(`  重复: ${d.issue} 与 ${seen.get(k)} (号码相同)`);
    } else {
      seen.set(k, d.issue);
    }
  });
  
  // 也检查期号重复
  const issueSeen = new Map();
  let issueDups = 0;
  D.forEach(d => {
    if (issueSeen.has(d.issue)) {
      issueDups++;
      console.log(`  期号重复: ${d.issue} 出现多次`);
    } else {
      issueSeen.set(d.issue, true);
    }
  });
  
  console.log(`号码重复: ${dups}, 期号重复: ${issueDups}, 去重后: ${D.length - dups}`);
}

checkFile('./all_draws.js');
checkFile('./all_draws (2).js');
