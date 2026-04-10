import { useState, useRef, useCallback } from "react";

/*
카이로스153 생기부 분석기 v11.0  대표 컨설턴트: 신지은
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[v11 변경사항]
1. 학종/교과 로직 완전 분리
2. AI 편향 없는 순수 분석 (탭1) → 보완사항 별도 입력 (탭2)
3. 실입결 DB 교체 (2026 엑셀 4개년 + 2027 수능최저)
4. 학종: 학업40/진로40/공동체20 가중치, c50/c70 구간 판정
5. 교과: 내신만 판정, 전형방법+수능최저 직접 표시
6. 진로별 성적 유불리 분석 추가
7. 탭구조: 분석/보완사항/대학추천/입결검색/리포트
8. 단일화면 (localStorage 제거, PDF로 학생 관리)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*/

// ── 여대 목록 ──────────────────────────────────────────────────────
const WOMENS_UNIV = new Set(["이화여대","숙명여대","성신여대","덕성여대","서울여대"]);

// ── 22개 전공 그룹 매핑 ────────────────────────────────────────────
const MAJOR_GROUPS = [
  { id:"media",   label:"미디어·언론·방송",   recMajor:"미디어커뮤니케이션학과",
    keys:["미디어","언론","방송","PD","커뮤니케이션","저널","홍보","콘텐츠","영상","영화","광고"],
    matchTerms:["미디어","언론","커뮤니케이션","방송","콘텐츠","영상","영화","홍보","저널","광고"] },
  { id:"biz",     label:"경영·경제·무역",      recMajor:"경영학과",
    keys:["경영","경제","회계","마케팅","무역","통상","금융","재무","비즈니스"],
    matchTerms:["경영","경제","회계","마케팅","무역","통상","금융"] },
  { id:"law",     label:"법·정치·행정",        recMajor:"법학과",
    keys:["법학","법","정치","행정","공공","외교"],
    matchTerms:["법학","정치","행정","공공","외교"] },
  { id:"psych",   label:"심리·상담·사회복지",  recMajor:"심리학과",
    keys:["심리","상담","사회복지","복지"],
    matchTerms:["심리","상담","복지"] },
  { id:"social",  label:"사회학·사회과학",     recMajor:"사회학과",
    keys:["사회학","사회과학","사회"],
    matchTerms:["사회학","사회"] },
  { id:"edu",     label:"교육·사범",           recMajor:"교육학과",
    keys:["교육","사범","교직","교원"],
    matchTerms:["교육","사범","교직"] },
  { id:"korean",  label:"국어·국문·문학",      recMajor:"국어국문학과",
    keys:["국어","국문","문학","어문","한국어"],
    matchTerms:["국어","국문","문학","언어"] },
  { id:"history", label:"사학·역사·문화재",    recMajor:"사학과",
    keys:["사학","역사","문화재","고고","문화유산"],
    matchTerms:["사학","역사","문화재","고고","문화유산"] },
  { id:"philo",   label:"철학·윤리",           recMajor:"철학과",
    keys:["철학","윤리","논리"],
    matchTerms:["철학","윤리"] },
  { id:"tourism", label:"관광·호텔·외식",      recMajor:"관광학과",
    keys:["관광","호텔","외식","여행"],
    matchTerms:["관광","호텔","외식","여행"] },
  { id:"design",  label:"디자인·예술·미술",    recMajor:"디자인학과",
    keys:["디자인","예술","미술","시각","패션"],
    matchTerms:["디자인","예술","미술","패션","콘텐츠"] },
  { id:"sport",   label:"체육·스포츠",         recMajor:"체육학과",
    keys:["체육","스포츠","운동"],
    matchTerms:["체육","스포츠"] },
  { id:"cs",      label:"컴퓨터·소프트웨어",   recMajor:"컴퓨터공학과",
    keys:["컴퓨터","소프트웨어","SW","프로그래밍"],
    matchTerms:["컴퓨터","소프트웨어","SW"] },
  { id:"ai",      label:"AI·데이터사이언스",   recMajor:"인공지능학과",
    keys:["AI","인공지능","데이터","빅데이터","머신러닝"],
    matchTerms:["AI","인공지능","데이터사이언스","빅데이터"] },
  { id:"ee",      label:"전기·전자·반도체",    recMajor:"전자공학과",
    keys:["전기","전자","반도체","회로","통신공학"],
    matchTerms:["전기","전자","반도체","통신"] },
  { id:"me",      label:"기계·항공·우주",      recMajor:"기계공학과",
    keys:["기계","항공","우주","로봇","자동차"],
    matchTerms:["기계","항공","우주","로봇"] },
  { id:"arch",    label:"건축·토목·도시",      recMajor:"건축학과",
    keys:["건축","토목","도시","환경","도시계획"],
    matchTerms:["건축","토목","도시","환경"] },
  { id:"bio",     label:"생명·바이오·식품",    recMajor:"생명공학과",
    keys:["생명","바이오","생물","식품"],
    matchTerms:["생명","바이오","생물","식품"] },
  { id:"chem",    label:"화학·신소재·재료",    recMajor:"화학공학과",
    keys:["화학","신소재","재료","고분자","화공"],
    matchTerms:["화학","신소재","재료"] },
  { id:"math",    label:"수학·통계",            recMajor:"통계학과",
    keys:["수학","통계","수리","보험수리"],
    matchTerms:["수학","통계","수리","보험"] },
  { id:"med",     label:"의학·치의·약학·한의", recMajor:"의예과",
    keys:["의학","의예","치의","약학","한의","의대","약대"],
    matchTerms:["의학","의예","치의","약학","한의"] },
  { id:"nurs",    label:"간호·보건",            recMajor:"간호학과",
    keys:["간호","보건","재활","물리치료"],
    matchTerms:["간호","보건","재활"] },
];

function detectMajorGroup(t) {
  if (!t) return null;
  for (const g of MAJOR_GROUPS) {
    if (g.keys.some(k => t.includes(k))) return g;
  }
  return null;
}
function isMajorMatch(m, matchTerms) {
  return matchTerms ? matchTerms.some(t => m && m.includes(t)) : false;
}

// ── DB import ──────────────────────────────────────────────────────
import { DB_V11 } from "./db.js";

// ── 평가 기준표 (학업40/진로40/공동체20) ─────────────────────────
const SCORE_TABLE = {
  학업: {
    "1":  {탁월:97,우수:90,보통:82,빈약:70},
    "2a": {탁월:86,우수:80,보통:74,빈약:64},
    "2b": {탁월:75,우수:70,보통:66,빈약:56},
    "3a": {탁월:64,우수:60,보통:56,빈약:48},
    "3b": {탁월:54,우수:50,보통:46,빈약:40},
    "4":  {탁월:44,우수:40,보통:36,빈약:30},
  },
  진로: {
    완전일관:{탁월:92,우수:84,보통:74,빈약:62},
    부분일관:{탁월:78,우수:71,보통:63,빈약:52},
    불일관:  {탁월:62,우수:55,보통:48,빈약:40},
  },
  공동체:{"임원+리더":88,"임원or리더":75,"없음":60,"미흡":46},
};
function gradeKey(g){
  const f=parseFloat(String(g).trim());
  if(!isFinite(f)||f<=0||f>9)return"3a";
  if(f<2)return"1";if(f<2.5)return"2a";if(f<3)return"2b";
  if(f<3.5)return"3a";if(f<4)return"3b";return"4";
}
function calcScores(mg,sl,cc,ll){
  const r학=SCORE_TABLE.학업[gradeKey(mg)]||SCORE_TABLE.학업["3a"];
  const r진=SCORE_TABLE.진로[cc]||SCORE_TABLE.진로["부분일관"];
  return{
    학업:r학[sl]||r학["보통"],
    진로:r진[sl]||r진["보통"],
    공동체:SCORE_TABLE.공동체[ll]||SCORE_TABLE.공동체["없음"],
  };
}
// 학업40/진로40/공동체20 가중 종합점수
function calcTotal(scores){
  return Math.round(scores.학업*0.4+scores.진로*0.4+scores.공동체*0.2);
}
function gradeLabel(n){
  if(n>=90)return"A+";if(n>=80)return"A";if(n>=72)return"B+";
  if(n>=62)return"B";if(n>=52)return"C+";if(n>=42)return"C";return"D";
}

// ── 티어 색상 ──────────────────────────────────────────────────────
const TC={안정:"#15803d",적정:"#1d4ed8",소신:"#92400e",상향:"#6d28d9"};
const TB={안정:"#f0fdf4",적정:"#eff6ff",소신:"#fefce8",상향:"#f5f3ff"};

// ── 학종 구간 판정 ─────────────────────────────────────────────────
// 1등급대(g<=1.9): c30 기준 완화 → 더 많은 대학 적정 포함
// 일반: c50 기준 적정 / c70 기준 소신 / 초과 상향
function calcJongTier(g, c, c30, c70){
  // 1~2등급 최상위: c30 기준으로 완화 적용
  if(g<=1.9){
    if(g<=c30+0.1) return "안정";
    if(g<=c+0.5)   return "적정";
    if(g<=c70+0.5) return "소신";
    return "상향";
  }
  if(g<=c-0.1) return "안정";
  if(g<=c+0.3) return "적정";
  if(g<=c70+0.3) return "소신";
  return "상향";
}

// ── 캠퍼스 base 대학명 추출 (dedup용) ────────────────────────────
function getBaseUniv(u){
  return u.replace(/\(서울\)|\(죽전\)|\(에리카\)|\(글로컬\)|\(WISE\)|\(세종\)|\(원주\)|\(안성\)|\(글로벌\)|\(천안\)|\(의정부\)|\(성남\)|\(다빈치\)/g,'').trim();
}

// ── 학종 합격가능성 (학업40/진로40/공동체20 반영) ──────────────────
function calcJongPoss(grade, sebu, suneungOk, c, c70, hasSuneung){
  const g=parseFloat(grade);
  if(!isFinite(g)||!c) return 1;
  // 내신 기반 기본 점수
  const diff=g-c;
  let ns;
  if(diff<=-0.3) ns=5; else if(diff<=0.3) ns=4; else if(diff<=0.8) ns=3;
  else if(diff<=1.3) ns=2; else ns=1;
  // 세특 가중 (진로40% 반영)
  const sm={탁월:5,우수:4,보통:3,빈약:2};
  let base=ns*0.4+(sm[sebu]||3)*0.6;
  // 수능최저
  if(hasSuneung&&!suneungOk) base-=1.0;
  else if(hasSuneung&&suneungOk) base-=0.3;
  // 하한선: c70+0.3 초과하면 최대 3점
  if(g>c70+0.3) base=Math.min(base,3);
  return Math.min(10,Math.max(1,Math.round(base)));
}

// ── 교과 합격가능성 (내신만) ──────────────────────────────────────
function calcGyogwaPoss(grade, c, c70){
  const g=parseFloat(grade);
  if(!isFinite(g)||!c) return 1;
  const diff=g-c;
  let ns;
  if(diff<=-0.3) ns=5; else if(diff<=0.1) ns=4; else if(diff<=0.5) ns=3;
  else if(diff<=0.9) ns=2; else ns=1;
  if(g>c70+0.3) ns=Math.min(ns,2);
  return Math.min(10,Math.max(1,ns));
}

// ── buildJongRecs: 학종 추천 ───────────────────────────────────────
function buildJongRecs(grade, sebu, suneungOk, gyeyeol, gender, majorGroup){
  const db=(DB_V11.학종||{})[gyeyeol]||[];
  const g=parseFloat(grade);
  const filtered=db.filter(r=>!(gender==="남"&&WOMENS_UNIV.has(r.u)));
  const scored=filtered.map(r=>{
    const hasSuneung=r.s27&&r.s27!=="없음";
    const poss=calcJongPoss(grade,sebu,suneungOk,r.c,r.c70,hasSuneung);
    const tier=calcJongTier(g,r.c,r.c30,r.c70);
    const majorMatch=majorGroup?isMajorMatch(r.m,majorGroup.matchTerms):false;
    return{...r,poss,diff:g-r.c,tier,majorMatch};
  });
  // 대학별 dedup: 캠퍼스 포함 base명 기준 → 전공매칭 우선 → poss 높은 것
  const byUni={};
  for(const r of scored){
    const key=getBaseUniv(r.u); // 캠퍼스 중복 방지
    const p=byUni[key];
    if(!p){byUni[key]=r;continue;}
    const w=(r.majorMatch&&!p.majorMatch)||
      (r.majorMatch===p.majorMatch&&r.poss>p.poss)||
      (r.majorMatch===p.majorMatch&&r.poss===p.poss&&Math.abs(r.diff)<Math.abs(p.diff));
    if(w)byUni[key]=r;
  }
  const to={안정:0,적정:1,소신:2,상향:3};
  const all=Object.values(byUni).sort((a,b)=>
    (b.majorMatch?1:0)-(a.majorMatch?1:0)||
    (to[a.tier]||3)-(to[b.tier]||3)||
    a.c-b.c|| // 같은 티어 내에서 c 낮은 것(좋은 대학) 우선
    b.poss-a.poss
  );
  // 성적대별 구간 상한 조정
  const 안정Max = g >= 4.0 ? 3 : 5;          // 4등급↑ 안정 3개
  const 소신Max = g >= 3.5 ? 7 : 10;          // 3.5등급↑ 소신 7개
  return{
    안정: all.filter(r=>r.tier==="안정").slice(0,안정Max),
    적정: all.filter(r=>r.tier==="적정").slice(0,10),
    소신: all.filter(r=>r.tier==="소신").slice(0,소신Max),
    상향: all.filter(r=>r.tier==="상향").slice(0,5),
    all,
  };
}

// ── buildGyogwaRecs: 교과 추천 (내신만) ───────────────────────────
function buildGyogwaRecs(grade, gyeyeol, gender){
  const db=(DB_V11.교과||{})[gyeyeol]||[];
  const g=parseFloat(grade);
  const filtered=db.filter(r=>!(gender==="남"&&WOMENS_UNIV.has(r.u)));
  const scored=filtered.map(r=>{
    const poss=calcGyogwaPoss(grade,r.c,r.c70);
    const tier=calcJongTier(g,r.c,r.c30,r.c70);
    return{...r,poss,diff:g-r.c,tier};
  });
  const byUni={};
  for(const r of scored){
    const key=getBaseUniv(r.u);
    const p=byUni[key];
    if(!p){byUni[key]=r;continue;}
    if(r.poss>p.poss||(r.poss===p.poss&&Math.abs(r.diff)<Math.abs(p.diff)))byUni[key]=r;
  }
  const to={안정:0,적정:1,소신:2,상향:3};
  const all=Object.values(byUni).sort((a,b)=>
    (to[a.tier]||3)-(to[b.tier]||3)||a.c-b.c||b.poss-a.poss
  );
  // 교과: 3.0등급↑ 소신7/적정8 제한, 4.0등급↑ 안정3 제한
  const 안정Max=g>=4.0?3:5;
  const 소신Max=g>=3.0?7:10;
  const 적정Max=g>=3.0?8:10;
  return{
    안정:all.filter(r=>r.tier==="안정").slice(0,안정Max),
    적정:all.filter(r=>r.tier==="적정").slice(0,적정Max),
    소신:all.filter(r=>r.tier==="소신").slice(0,소신Max),
    상향:all.filter(r=>r.tier==="상향").slice(0,5),
    all,
  };
}

// ── AI 시스템 프롬프트 ─────────────────────────────────────────────
const SYS="당신은 대한민국 최고의 입학사정관이자 입시 전문 컨설턴트입니다. 반드시 아래 형식으로만 응답하세요. JSON 금지. 마크다운 금지. 각 항목은 항목명:: 으로 시작. 배열은 ◆ 기호 구분. 팩트 항목은 지정된 값만 출력.";

// ── 1단계 프롬프트: 순수 분석 (희망학과 없음) ─────────────────────
function makePrompt1(text){
  const t=text.length>90000?text.slice(0,90000):text;
  return `학생부를 편향 없이 객관적으로 분석하세요.

[팩트 추출]
이름::학생 이름
성별::남/여
학교::고교명
계열::인문사회 또는 자연공학 중 하나
지망전공::희망 전공·계열

내신추이::학기별 등급 변화 예: 1-1)2.65→1-2)3.17
과목별등급::주요과목과 등급 ◆ 로 구분

세부수준::탁월/우수/보통/빈약 중 하나
진로일관성수준::완전일관/부분일관/불일관 중 하나
리더십수준::임원+리더/임원or리더/없음/미흡 중 하나
수능최저가능::가능/불확실/불가 중 하나

성적추이분석::학년별 성적 흐름 3문장
세특진단::세특 탐구 깊이·진로연계성 3문장
진로일관성분석::진로 방향 일관성 2문장
리더십분석::리더십·공동체 역량 2문장

유리한조합::과목 조합이 유리한 전형과 이유 2문장
불리한조합::발목 잡는 과목 이유 2문장
교과시뮬::교과전형 예상 결과 2문장

진로별성적유불리::지망전공 기준 핵심과목 강약, 약점과목 실질영향도 3문장

강점과목::강점 과목 세특 핵심 ◆ 3개
약점과목::약점 과목 이유 ◆ 구분
강점1::강점 서술
강점2::두 번째 강점
강점3::세 번째 강점
보완점1::보완점
보완점2::두 번째 보완점
미반영::대입 미반영 항목

전공추천1::전공명|이유 2문장
전공추천2::두 번째 전공|이유
전공추천3::세 번째 전공|이유

추천전형::교과 또는 종합 또는 논술
전형이유::추천 이유 2문장
수능최저전망::충족 가능성 1문장
배분전략::수시 6장 최적 배분 4문장

핵심요약::입시 포인트 5가지 ◆ 구분
컨설턴트의견::종합의견 7문장 이상
상담포인트::학부모 상담 민감 포인트 3문장

학생부:
${t}`;
}

// ── 2단계 프롬프트: 보완사항 (희망학과+이수과목 추가) ─────────────
function makePrompt2(analysisResult, altMajor, subjects){
  const 지망=analysisResult.지망전공||"";
  const recMajors=analysisResult.majors.map(m=>m.name).join(", ");
  return `이전 생기부 분석 결과를 바탕으로 보완사항을 도출하세요.

[학생 정보]
지망전공: ${지망}
AI 추천 전공: ${recMajors}
${altMajor?`변경 고려 전공: ${altMajor}`:""}
${subjects?`3학년 이수 예정 과목: ${subjects}`:""}

내신: ${analysisResult.facts.gradeAll}등급
세특수준: ${analysisResult.facts.sebuLevel}
진로일관성: ${analysisResult.facts.careerConsistency}

추천전공보완::추천 전공 지원을 위한 3학년 구체적 보완사항 ◆ 3개
${altMajor?`희망전공보완::변경 고려 전공 "${altMajor}" 지원을 위한 3학년 보완사항 ◆ 3개`:"희망전공보완::해당없음"}
${subjects?`이수과목보완::입력된 이수 예정 과목 기준 부족 역량과 보완 방향 3문장`:`이수과목보완::해당없음`}
세특방향::과목:제안 형식 ◆ 구분 최소 3개
창체방향::창체·동아리 방향 2문장
수능전략::수능 전략 2문장`;
}

// ── 내신 파싱 ─────────────────────────────────────────────────────
function parseGradesFromText(text){
  const res=[];const lines=text.split(/\n/);
  for(let i=0;i<lines.length-4;i++){
    const unit=parseInt(lines[i].trim(),10);
    if(!unit||unit<1||unit>8)continue;
    for(let j=i+1;j<Math.min(i+8,lines.length);j++){
      if(/^[A-E]\d+$/.test(lines[j].trim())){
        if(j+1<lines.length){const g=parseInt(lines[j+1].trim(),10);if(g>=1&&g<=9){res.push({unit,grade:g});break;}}
        break;
      }
    }
  }
  if(res.length<3)return null;
  const tu=res.reduce((s,r)=>s+r.unit,0);
  // 성취도 보정: A 과목 카운트
  const aCount=text.match(/성취도.*?A|A.*?성취도/g)?.length||
    (text.match(/\bA\b/g)||[]).length;
  const achieveBonus=aCount>=5?-0.2:aCount>=3?-0.1:0;
  const rawAvg=Math.round((res.reduce((s,r)=>s+r.unit*r.grade,0)/tu)*100)/100;
  return{
    avg:Math.round((rawAvg+achieveBonus)*100)/100,
    rawAvg,achieveBonus,count:res.length,aCount
  };
}
function detectSchoolType(text){
  return["과학고","영재학교","외국어고","국제고","자율형사립고","자사고","민족사관","하나고","상산고"].some(k=>text.includes(k))?"특목자사고":"일반고";
}

// ── 응답 파싱 ─────────────────────────────────────────────────────
function parseAnalysis(raw, text){
  const map={};
  for(const line of raw.split("\n")){
    const idx=line.indexOf("::");if(idx<0)continue;
    const k=line.slice(0,idx).trim(),v=line.slice(idx+2).trim();
    if(k&&v)map[k]=v;
  }
  const s=(k,d="")=>map[k]||d;
  const arr=(k)=>(map[k]||"").split("◆").map(x=>x.trim()).filter(Boolean);
  const parsed=parseGradesFromText(text);
  const gradeAll=parsed?.count>=5?String(parsed.avg):(()=>{
    const nums=(s("내신추이","").match(/\d+\.\d+/g)||[]).map(Number).filter(n=>n>0&&n<9);
    return nums.length?String(Math.round(nums.reduce((a,b)=>a+b,0)/nums.length*100)/100):"3.0";
  })();
  const sebuLevel=s("세부수준","보통");
  const careerConsistency=s("진로일관성수준","부분일관");
  const leadershipLevel=s("리더십수준","없음");
  const suneungOk=s("수능최저가능","불확실")==="가능";
  const raw계열=s("계열","인문사회");
  const 계열=(raw계열.includes("자연")||raw계열.includes("공학"))?"자연공학":"인문사회";
  const gender=s("성별","");
  const 지망전공=s("지망전공","");
  const firstMaj=(map["전공추천1"]||"").split("|")[0].trim();
  const recMajorGroup=detectMajorGroup(firstMaj)||detectMajorGroup(지망전공);
  const scores=calcScores(gradeAll,sebuLevel,careerConsistency,leadershipLevel);
  const total=calcTotal(scores);
  const majors=[1,2,3].map(i=>{
    const r=map["전공추천"+i]||"";const sp=r.indexOf("|");
    return sp>0?{name:r.slice(0,sp).trim(),reason:r.slice(sp+1).trim()}:null;
  }).filter(Boolean);
  return{
    name:s("이름","미확인"),gender,school:s("학교"),
    schoolType:detectSchoolType(text),계열,지망전공,
    recMajorGroup,
    facts:{gradeAll,sebuLevel,careerConsistency,leadershipLevel,suneungOk,
           parseInfo:parsed?.count>=5?`직접계산(${parsed.count}과목,A${parsed.aCount||0}개)`:"추이기반추정",
           achieveBonus:parsed?.achieveBonus||0},
    grade:{all:gradeAll,trend:s("내신추이"),bySubject:arr("과목별등급")},
    combo:{good:s("유리한조합"),bad:s("불리한조합"),sim:s("교과시뮬")},
    진로별유불리:s("진로별성적유불리"),
    scores,total,
    gradeLabels:{학업:gradeLabel(scores.학업),진로:gradeLabel(scores.진로),공동체:gradeLabel(scores.공동체)},
    analysis:{trend:s("성적추이분석"),sebu:s("세특진단"),career:s("진로일관성분석"),leader:s("리더십분석"),
              goodSubjects:arr("강점과목"),badSubjects:arr("약점과목"),excluded:s("미반영","해당없음")},
    strengths:[s("강점1"),s("강점2"),s("강점3")].filter(Boolean),
    weaknesses:[s("보완점1"),s("보완점2")].filter(Boolean),
    majors,
    rec:{type:s("추천전형","종합"),reason:s("전형이유"),suneungProspect:s("수능최저전망"),
         strategy:s("배분전략")},
    consultant:{summary:arr("핵심요약"),opinion:s("컨설턴트의견"),counselPoint:s("상담포인트")},
  };
}
function parseSuplement(raw){
  const map={};
  for(const line of raw.split("\n")){
    const idx=line.indexOf("::");if(idx<0)continue;
    const k=line.slice(0,idx).trim(),v=line.slice(idx+2).trim();
    if(k&&v)map[k]=v;
  }
  const arr=(k)=>(map[k]||"").split("◆").map(x=>x.trim()).filter(Boolean);
  return{
    추천전공:arr("추천전공보완"),
    희망전공:arr("희망전공보완"),
    이수과목:map["이수과목보완"]||"해당없음",
    세특방향:arr("세특방향"),
    창체:map["창체방향"]||"",
    수능:map["수능전략"]||"",
  };
}

// ── AI 호출 ───────────────────────────────────────────────────────
async function callAI(prompt, maxTokens=6000){
  const res=await fetch("/api/analyze",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({prompt,system:SYS,maxTokens}),
  });
  if(!res.ok){
    const e=await res.json().catch(()=>({}));
    if(res.status===429)throw new Error("요청 초과. 30초 후 재시도하세요.");
    throw new Error("API 오류("+res.status+"): "+(e?.error?.message||"알 수 없는 오류"));
  }
  const data=await res.json();
  const raw=data?.content?.[0]?.text||"";
  if(!raw.trim())throw new Error("응답 없음. 다시 시도하세요.");
  return raw;
}

// ── PDF 읽기 ──────────────────────────────────────────────────────
async function loadPdf(){
  if(window.pdfjsLib)return window.pdfjsLib;
  return new Promise((ok,fail)=>{
    const sc=document.createElement("script");
    sc.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    sc.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";ok(window.pdfjsLib);};
    sc.onerror=()=>fail(new Error("PDF 로드 실패"));
    document.head.appendChild(sc);
  });
}
async function readPdf(file){
  const lib=await loadPdf();
  const doc=await lib.getDocument({data:await file.arrayBuffer()}).promise;
  let text="";
  for(let p=1;p<=Math.min(doc.numPages,80);p++){
    const page=await doc.getPage(p);const ct=await page.getTextContent();
    let prevY=null,line="";
    for(const item of ct.items){
      if(!item.str)continue;const y=item.transform[5];
      if(prevY!==null&&Math.abs(y-prevY)>4){if(line.trim())text+=line.trim()+"\n";line="";}
      line+=item.str+" ";prevY=y;
    }
    if(line.trim())text+=line.trim()+"\n";text+="\n";
  }
  if(!text.trim())throw new Error("PDF 텍스트 추출 실패.");
  return text;
}
async function readFile(file){
  const ext=(file.name||"").split(".").pop().toLowerCase();
  if(file.size>30*1024*1024)throw new Error("30MB 초과.");
  if(ext==="pdf"||(file.type||"").includes("pdf"))return await readPdf(file);
  if(["txt"].includes(ext)||(file.type||"").includes("text")){
    const t=await file.text();if(!t.trim())throw new Error("빈 파일.");return t;
  }
  throw new Error("PDF 또는 TXT만 가능합니다.");
}

// ── 스타일 상수 ───────────────────────────────────────────────────
const C={
  bg:"#f1f5f9",surface:"#fff",panel:"#f8fafc",border:"#e2e8f0",
  accent:"#1d4ed8",aLight:"#eff6ff",aBorder:"#bfdbfe",
  gold:"#92400e",goldLight:"#fefce8",goldBorder:"#fde68a",
  green:"#15803d",greenLight:"#f0fdf4",greenBorder:"#bbf7d0",
  rose:"#b91c1c",roseLight:"#fef2f2",roseBorder:"#fecaca",
  violet:"#6d28d9",violetLight:"#f5f3ff",violetBorder:"#ddd6fe",
  text:"#1e293b",sub:"#64748b",muted:"#94a3b8",
};

// ── Loading ───────────────────────────────────────────────────────
function Loading({step}){
  const steps=["파일 읽기","텍스트 추출","내신 계산","세특·역량 분석","전공 적합성","합격가능성 산출","리포트 생성"];
  return(
    <div style={{textAlign:"center",padding:"50px 20px",background:C.surface,borderRadius:"12px",border:"1px solid "+C.border}}>
      <div style={{fontSize:"32px",marginBottom:"12px"}}>🔍</div>
      <div style={{color:C.text,fontWeight:700,fontSize:"15px",marginBottom:"4px"}}>학생부를 분석하고 있습니다</div>
      <div style={{color:C.gold,fontSize:"12px",marginBottom:"20px"}}>{steps[Math.min(step,steps.length-1)]} 중…</div>
      <div style={{maxWidth:"200px",margin:"0 auto"}}>
        {steps.map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
            <div style={{width:"12px",height:"12px",borderRadius:"50%",flexShrink:0,
              background:i<step?C.green:i===step?C.gold:C.border,transition:"background 0.4s"}}/>
            <span style={{fontSize:"11px",color:i<step?C.green:i===step?C.text:C.muted}}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── UniCard: 공통 대학 카드 ────────────────────────────────────────
function UniCard({r, i, majorGroup, mode}){
  const hasSuneung=r.s27&&r.s27!=="없음";
  const diffStr=r.diff>=0?"+"+r.diff.toFixed(2):r.diff.toFixed(2);
  const tc=TC[r.tier]||C.accent, tbg=TB[r.tier]||C.aLight;
  const dispMajor=(majorGroup&&r.majorMatch)?majorGroup.recMajor:r.m;
  const pct=r.tier==="안정"?"90%":r.tier==="적정"?"70%":r.tier==="소신"?"50%":"30%";
  return(
    <div style={{borderBottom:"1px solid "+C.border,padding:"10px 0"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"3px"}}>
        <div style={{flex:1,minWidth:0}}>
          <span style={{fontSize:"10px",color:C.muted,marginRight:4}}>#{i+1}</span>
          <span style={{fontWeight:700,fontSize:"13px",color:C.text}}>{r.u}</span>
          {mode==="학종"&&r.majorMatch&&<span style={{marginLeft:5,fontSize:"9px",background:C.greenLight,color:C.green,padding:"1px 5px",borderRadius:"4px",fontWeight:700}}>전공매칭</span>}
          {hasSuneung&&<span style={{marginLeft:4,fontSize:"9px",background:C.roseLight,color:C.rose,padding:"1px 5px",borderRadius:"4px",fontWeight:700}}>수능최저</span>}
        </div>
        <span style={{background:tbg,color:tc,fontWeight:700,fontSize:"11px",padding:"2px 9px",borderRadius:"6px",flexShrink:0,marginLeft:6}}>{r.tier}</span>
      </div>
      <div style={{fontSize:"12px",fontWeight:600,color:C.accent,marginBottom:"3px"}}>→ {dispMajor}</div>
      <div style={{background:C.panel,borderRadius:"3px",height:"3px",overflow:"hidden",marginBottom:"5px"}}>
        <div style={{width:pct,height:"100%",background:tc,transition:"width 0.7s ease"}}/>
      </div>
      <div style={{fontSize:"11px",color:C.sub,marginBottom:"3px"}}>
        <span style={{fontWeight:500}}>{r.t}</span>
        {mode==="교과"&&r.method&&<span style={{marginLeft:6,fontSize:"10px",background:C.panel,color:C.sub,padding:"1px 6px",borderRadius:"4px",border:"1px solid "+C.border}}>{r.method}</span>}
      </div>
      <div style={{fontSize:"10px",color:C.muted,lineHeight:1.6}}>
        <span>50%컷 <b style={{color:C.accent}}>{r.c?.toFixed(2)}</b></span>
        <span style={{margin:"0 5px"}}>|</span>
        <span>70%컷 <b style={{color:C.rose}}>{r.c70?.toFixed(2)}</b></span>
        <span style={{marginLeft:8,color:r.diff<=0?C.green:r.diff<=0.5?C.accent:r.diff<=1?C.gold:C.rose}}>내신차 {diffStr}</span>
        {r.avg4&&Math.abs(r.avg4-r.c)>0.4&&<span style={{marginLeft:6,color:C.muted}}>4개년평균 {r.avg4?.toFixed(2)}</span>}
      </div>
      {hasSuneung&&<div style={{fontSize:"10px",color:C.rose,marginTop:"4px",background:C.roseLight,borderRadius:"6px",padding:"4px 8px",lineHeight:1.5}}>
        📋 수능최저: {r.s27.slice(0,80)}
      </div>}
    </div>
  );
}

// ── TierSection ───────────────────────────────────────────────────
function TierSection({label,color,bg,items,majorGroup,mode}){
  if(!items||items.length===0)return null;
  return(
    <div style={{marginBottom:"12px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px",padding:"6px 10px",background:bg,borderRadius:"8px",border:"1px solid "+color+"30"}}>
        <span style={{fontSize:"12px",fontWeight:700,color}}>{label}</span>
        <span style={{fontSize:"10px",color,opacity:.7}}>{items.length}개</span>
      </div>
      {items.map((r,i)=><UniCard key={r.u+r.t} r={r} i={i} majorGroup={majorGroup} mode={mode}/>)}
    </div>
  );
}

// ── RecsPanel ─────────────────────────────────────────────────────
function RecsPanel({recs,majorGroup,suneungOk,note,mode}){
  const{안정,적정,소신,상향}=recs;
  return(
    <div>
      <div style={{fontSize:"10px",color:C.muted,marginBottom:"10px",lineHeight:1.7,padding:"8px 10px",background:C.panel,borderRadius:"8px"}}>
        {mode==="학종"?<>
          50%컷(적정) · 70%컷(소신) · 70%컷+0.3초과(상향) 기준<br/>
          {majorGroup?<span style={{color:C.green}}>전공매칭: {majorGroup.label} </span>:<span>전공 미분류 — 전체 표시 </span>}
          {suneungOk?<span style={{color:C.green}}>· 수능최저 충족</span>:<span style={{color:C.rose}}>· 수능최저 불확실</span>}
        </>:<>
          교과전형 내신 기준 · 전형방법·수능최저 직접 표시<br/>
          수능최저 미충족이어도 표시 (기준 확인 필요)
        </>}
        {note&&<span style={{color:C.violet}}> · {note}</span>}
      </div>
      <TierSection label="🟢 안정" color={TC.안정} bg={TB.안정} items={안정} majorGroup={majorGroup} mode={mode}/>
      <TierSection label="🔵 적정 (최대 10개)" color={TC.적정} bg={TB.적정} items={적정} majorGroup={majorGroup} mode={mode}/>
      <TierSection label="🟡 소신 (최대 10개)" color={TC.소신} bg={TB.소신} items={소신} majorGroup={majorGroup} mode={mode}/>
      <TierSection label="🟣 상향 (최대 5개)" color={TC.상향} bg={TB.상향} items={상향} majorGroup={majorGroup} mode={mode}/>
    </div>
  );
}

// ── ManualInput ───────────────────────────────────────────────────
function ManualInput({onAnalyze}){
  const[grade,setGrade]=useState("3.0");
  const[sebu,setSebu]=useState("보통");
  const[career,setCareer]=useState("부분일관");
  const[leader,setLeader]=useState("없음");
  const[suneung,setSuneung]=useState(false);
  const[gyeyeol,setGyeyeol]=useState("인문사회");
  const[gender,setGender]=useState("미입력");
  const[지망,set지망]=useState("");
  const sel=(lb,val,setVal,opts)=>(
    <div style={{marginBottom:10}}>
      <div style={{fontSize:"11px",color:C.sub,marginBottom:3}}>{lb}</div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
        {opts.map(o=><button key={o} onClick={()=>setVal(o)} style={{padding:"4px 10px",borderRadius:"20px",fontSize:"12px",cursor:"pointer",fontFamily:"inherit",background:val===o?C.accent:C.panel,color:val===o?"white":C.sub,border:"1px solid "+(val===o?C.accent:C.border)}}>{o}</button>)}
      </div>
    </div>
  );
  const go=()=>{
    const gen=gender==="미입력"?"":gender;
    const scores=calcScores(grade,sebu,career,leader);
    const total=calcTotal(scores);
    const rmg=detectMajorGroup(지망);
    onAnalyze({
      name:"수동입력",gender:gen,school:"",schoolType:"일반고",계열:gyeyeol,지망전공:지망,
      recMajorGroup:rmg,wishMajorGroup:rmg,altMajor:"",
      facts:{gradeAll:grade,sebuLevel:sebu,careerConsistency:career,leadershipLevel:leader,suneungOk:suneung,parseInfo:"수동입력",achieveBonus:0},
      grade:{all:grade,trend:"",bySubject:[]},
      combo:{good:"",bad:"",sim:""},진로별유불리:"",
      scores,total,gradeLabels:{학업:gradeLabel(scores.학업),진로:gradeLabel(scores.진로),공동체:gradeLabel(scores.공동체)},
      analysis:{trend:"",sebu:"",career:"",leader:"",goodSubjects:[],badSubjects:[],excluded:"해당없음"},
      strengths:[],weaknesses:[],majors:[],
      rec:{type:"종합",reason:"",suneungProspect:"",strategy:""},
      consultant:{summary:[],opinion:"",counselPoint:""},
      suplement:null,
    });
  };
  return(
    <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"12px",padding:"16px",marginTop:"10px"}}>
      <div style={{fontSize:"12px",fontWeight:700,color:C.text,marginBottom:"10px"}}>📊 수동 입력 분석</div>
      <div style={{marginBottom:10}}>
        <div style={{fontSize:"11px",color:C.sub,marginBottom:3}}>내신 등급 (예: 2.83)</div>
        <input type="number" step="0.01" min="1" max="9" value={grade} onChange={e=>setGrade(e.target.value)}
          style={{width:"100%",padding:"8px 12px",background:C.panel,border:"1px solid "+C.border,borderRadius:"8px",color:C.text,fontSize:"15px",fontFamily:"inherit"}}/>
      </div>
      {sel("성별",gender,setGender,["여","남","미입력"])}
      {sel("계열",gyeyeol,setGyeyeol,["인문사회","자연공학"])}
      {sel("세특 수준",sebu,setSebu,["탁월","우수","보통","빈약"])}
      {sel("진로 일관성",career,setCareer,["완전일관","부분일관","불일관"])}
      {sel("리더십",leader,setLeader,["임원+리더","임원or리더","없음","미흡"])}
      {sel("수능최저 충족",suneung?"가능":"불확실",v=>setSuneung(v==="가능"),["가능","불확실"])}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:"11px",color:C.sub,marginBottom:3}}>희망 전공</div>
        <input type="text" value={지망} onChange={e=>set지망(e.target.value)} placeholder="예: 미디어커뮤니케이션, 컴퓨터공학"
          style={{width:"100%",padding:"8px 12px",background:C.panel,border:"1px solid "+C.border,borderRadius:"8px",color:C.text,fontSize:"13px",fontFamily:"inherit"}}/>
      </div>
      <button onClick={go} style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#2563eb,#1d4ed8)",border:"none",borderRadius:"8px",color:"white",fontSize:"14px",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
        분석 시작
      </button>
    </div>
  );
}

// ── Result: 메인 결과 화면 ────────────────────────────────────────
function Result({d, onReset, onReanalyze, isReanalyzing}){
  const[tab,setTab]=useState("analysis");
  const[jongSub,setJongSub]=useState("추천학과");
  const[gyogwaSub,setGyogwaSub]=useState("인문사회");
  const[recMode,setRecMode]=useState("학종");
  const[altMajor,setAltMajor]=useState("");
  const[subjects,setSubjects]=useState("");
  const[searchQ,setSearchQ]=useState("");

  // 대학 추천 계산
  const wishMajorGroup=d.altMajor?detectMajorGroup(d.altMajor)||d.wishMajorGroup:d.wishMajorGroup;
  const jongRecRecs=buildJongRecs(d.facts.gradeAll,d.facts.sebuLevel,d.facts.suneungOk,d.계열,d.gender,d.recMajorGroup);
  const jongWishRecs=buildJongRecs(d.facts.gradeAll,d.facts.sebuLevel,d.facts.suneungOk,d.계열,d.gender,wishMajorGroup);
  const gyogwaRecs=buildGyogwaRecs(d.facts.gradeAll,d.계열,d.gender);

  // 입결 검색
  const allDb=[...(DB_V11.학종?.[d.계열]||[]),...(DB_V11.교과?.[d.계열]||[])];
  const searchResults=searchQ.length>=2?allDb.filter(r=>
    r.u.includes(searchQ)||r.m.includes(searchQ)||r.t.includes(searchQ)
  ):[];

  // 리포트
  const copyReport=()=>{
    const L=[];
    L.push("KAIROS 153 · 카이로스153 대입컨설팅 · 2027학년도 · v11.0");
    L.push(`학생: ${d.name}${d.gender?" ("+d.gender+")":""} | ${d.school||""} [${d.schoolType}] | ${d.계열}`);
    L.push(`내신: ${d.facts.gradeAll}등급 [${d.facts.parseInfo}]${d.facts.achieveBonus?` (성취도보정 ${d.facts.achieveBonus})`:""}`);
    L.push(`세특: ${d.facts.sebuLevel} | 진로: ${d.facts.careerConsistency} | 리더십: ${d.facts.leadershipLevel} | 수능최저: ${d.facts.suneungOk?"가능":"불확실"}`);
    L.push(`역량: 학업${d.gradeLabels.학업}(${d.scores.학업}) / 진로${d.gradeLabels.진로}(${d.scores.진로}) / 공동체${d.gradeLabels.공동체}(${d.scores.공동체}) → 종합 ${d.total}점`);
    if(d.지망전공)L.push(`지망: ${d.지망전공}${d.altMajor?" → 변경고려: "+d.altMajor:""}`);
    if(d.진로별유불리){L.push("");L.push("[진로별 성적 유불리]");L.push(d.진로별유불리);}
    if(d.analysis.trend){L.push("");L.push("[성적 추이]");L.push(d.analysis.trend);}
    if(d.strengths.length){L.push("");L.push("[강점]");d.strengths.forEach((s,i)=>L.push(`${i+1}. ${s}`));}
    if(d.weaknesses.length){L.push("");L.push("[보완점]");d.weaknesses.forEach((s,i)=>L.push(`${i+1}. ${s}`));}
    if(d.suplement){
      if(d.suplement.추천전공.length){L.push("");L.push("[추천전공 보완사항]");d.suplement.추천전공.forEach(s=>L.push("• "+s));}
      if(d.altMajor&&d.suplement.희망전공.length&&d.suplement.희망전공[0]!=="해당없음"){L.push("");L.push(`[희망전공 보완사항 (${d.altMajor})]`);d.suplement.희망전공.forEach(s=>L.push("• "+s));}
      if(d.suplement.세특방향.length){L.push("");L.push("[세특 탐구 방향]");d.suplement.세특방향.forEach(s=>L.push("• "+s));}
    }
    L.push("");L.push("[학종 추천 대학]");
    jongRecRecs.all.slice(0,15).forEach((r,i)=>{
      L.push(`${i+1}. [${r.tier}] ${r.u} · ${r.t}`);
      L.push(`   → ${(d.recMajorGroup&&r.majorMatch)?d.recMajorGroup.recMajor:r.m}`);
      L.push(`   50%컷:${r.c?.toFixed(2)} / 70%컷:${r.c70?.toFixed(2)} / 내신차:${r.diff>=0?"+":""}${r.diff.toFixed(2)}`);
      if(r.s27&&r.s27!=="없음")L.push(`   수능최저: ${r.s27.slice(0,60)}`);
    });
    L.push("");L.push("[교과 추천 대학]");
    gyogwaRecs.all.slice(0,10).forEach((r,i)=>{
      L.push(`${i+1}. [${r.tier}] ${r.u} · ${r.t} (${r.method||"교과100"})`);
      L.push(`   50%컷:${r.c?.toFixed(2)} / 70%컷:${r.c70?.toFixed(2)}`);
      if(r.s27&&r.s27!=="없음")L.push(`   수능최저: ${r.s27.slice(0,60)}`);
    });
    if(d.rec.strategy){L.push("");L.push("[수시 6장 배분 전략]");L.push(d.rec.strategy);}
    if(d.consultant.opinion){L.push("");L.push("[컨설턴트 종합의견]");L.push(d.consultant.opinion);}
    if(d.consultant.counselPoint){L.push("");L.push("[학부모 상담 포인트]");L.push(d.consultant.counselPoint);}
    L.push("");L.push("KAIROS 153 · 신지은");
    const text=L.join("\n");
    navigator.clipboard.writeText(text).then(()=>alert("리포트 복사 완료!")).catch(()=>{
      const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);alert("리포트 복사 완료!");
    });
  };

  const TABS=[["analysis","📋 분석"],["suplement","🔧 보완사항"],["recs","🏫 대학추천"],["search","🔍 입결검색"],["report","📄 리포트"]];

  return(
    <div>
      {/* 헤더 카드 */}
      <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"12px",padding:"14px",marginBottom:"10px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"8px",marginBottom:"8px"}}>
          <div>
            <div style={{color:C.muted,fontSize:"10px",marginBottom:"2px"}}>KAIROS 153 · 신지은 · v11.0</div>
            <div style={{color:C.text,fontSize:"17px",fontWeight:900}}>{d.name}{d.gender&&" ("+d.gender+")"}</div>
            <div style={{color:C.sub,fontSize:"11px"}}>{d.school} [{d.schoolType}] · {d.계열}</div>
            {d.지망전공&&<div style={{color:C.violet,fontSize:"11px",marginTop:2}}>지망: {d.지망전공}{d.altMajor&&" → 변경고려: "+d.altMajor}</div>}
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{color:C.muted,fontSize:"10px"}}>종합 역량</div>
            <div style={{fontSize:"30px",fontWeight:900,lineHeight:1,color:d.total>=75?C.green:d.total>=60?C.gold:C.rose}}>{d.total}</div>
            <div style={{color:C.muted,fontSize:"9px"}}>/100 (학업40/진로40/공동체20)</div>
          </div>
        </div>
        <div style={{background:C.panel,borderRadius:"8px",padding:"7px 12px",fontSize:"11px",color:C.sub,marginBottom:"8px",lineHeight:1.7}}>
          세특 <b>{d.facts.sebuLevel}</b> · 진로 <b>{d.facts.careerConsistency}</b> · 리더십 <b>{d.facts.leadershipLevel}</b> · 수능최저 <b>{d.facts.suneungOk?"가능":"불확실"}</b>
          {d.facts.achieveBonus<0&&<span style={{color:C.green,marginLeft:6}}>· 성취도보정 {d.facts.achieveBonus}</span>}
        </div>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {[["내신",d.grade.all+"등급",C.accent],["추천전형",d.rec.type,C.gold],["계열",d.계열,C.violet]].map(([l,v,c])=>(
            <div key={l} style={{background:C.panel,border:"1px solid "+C.border,borderRadius:"7px",padding:"5px 10px"}}>
              <div style={{fontSize:"10px",color:C.muted}}>{l}</div>
              <div style={{fontSize:"12px",fontWeight:700,color:c}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 역량 3단 */}
      <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
        {[["학업(40%)",d.gradeLabels.학업,C.accent],["진로(40%)",d.gradeLabels.진로,C.green],["공동체(20%)",d.gradeLabels.공동체,C.violet]].map(([l,g,c])=>(
          <div key={l} style={{flex:1,background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"10px",textAlign:"center"}}>
            <div style={{fontSize:"10px",color:C.muted,marginBottom:"2px"}}>{l}</div>
            <div style={{fontSize:"24px",fontWeight:900,color:c,lineHeight:1}}>{g}</div>
          </div>
        ))}
      </div>

      {/* 메인 탭 */}
      <div style={{display:"flex",gap:"4px",marginBottom:"10px",flexWrap:"wrap"}}>
        {TABS.map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"7px 12px",border:"none",borderRadius:"8px",fontSize:"12px",fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:tab===id?C.accent:"transparent",color:tab===id?"white":C.muted}}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 탭1: 분석 ── */}
      {tab==="analysis"&&(
        <div>
          {/* 진로별 성적 유불리 */}
          {d.진로별유불리&&<div style={{background:C.violetLight,border:"1px solid "+C.violetBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:C.violet,marginBottom:"5px"}}>📊 진로별 성적 유불리</div>
            <div style={{fontSize:"12px",color:C.text,lineHeight:1.7}}>{d.진로별유불리}</div>
          </div>}

          {/* 성적 분석 */}
          <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"8px"}}>📈 성적 분석</div>
            {d.grade.trend&&<div style={{fontSize:"12px",color:C.sub,marginBottom:"8px",padding:"8px 10px",background:C.panel,borderRadius:"7px"}}>추이: {d.grade.trend}</div>}
            {d.analysis.trend&&<div style={{fontSize:"12px",color:C.text,lineHeight:1.7,marginBottom:"6px"}}>{d.analysis.trend}</div>}
            {d.combo.good&&<div style={{marginBottom:"6px"}}><span style={{fontSize:"10px",color:C.green}}>유리한 조합 </span><span style={{fontSize:"12px",color:C.text,lineHeight:1.6}}>{d.combo.good}</span></div>}
            {d.combo.bad&&<div><span style={{fontSize:"10px",color:C.rose}}>불리한 조합 </span><span style={{fontSize:"12px",color:C.text,lineHeight:1.6}}>{d.combo.bad}</span></div>}
          </div>

          {/* 세특·진로·리더십 */}
          {[["🔬 세특 진단",d.analysis.sebu],["🎯 진로 일관성",d.analysis.career],["🏆 리더십",d.analysis.leader]].filter(([,v])=>v).map(([t,c])=>(
            <div key={t} style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
              <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"5px"}}>{t}</div>
              <div style={{fontSize:"12px",color:C.text,lineHeight:1.7}}>{c}</div>
            </div>
          ))}

          {/* 강점·보완점 */}
          {d.strengths.length>0&&<div style={{background:C.greenLight,border:"1px solid "+C.greenBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:C.green,marginBottom:"5px"}}>✅ 강점</div>
            {d.strengths.map((s,i)=><div key={i} style={{fontSize:"12px",color:C.text,marginBottom:"4px"}}>• {s}</div>)}
          </div>}
          {d.weaknesses.length>0&&<div style={{background:C.roseLight,border:"1px solid "+C.roseBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:C.rose,marginBottom:"5px"}}>⚠️ 보완점</div>
            {d.weaknesses.map((s,i)=><div key={i} style={{fontSize:"12px",color:C.text,marginBottom:"4px"}}>• {s}</div>)}
          </div>}

          {/* 추천 전공 */}
          {d.majors.length>0&&<div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"8px"}}>🎓 추천 전공</div>
            {d.majors.map((m,i)=>(
              <div key={i} style={{borderBottom:i<d.majors.length-1?"1px solid "+C.border:"none",paddingBottom:8,marginBottom:8}}>
                <div style={{fontWeight:700,fontSize:"13px",color:C.accent,marginBottom:2}}>{i+1}. {m.name}</div>
                <div style={{fontSize:"11px",color:C.sub,lineHeight:1.6}}>{m.reason}</div>
              </div>
            ))}
          </div>}

          {/* 종합의견 */}
          {d.consultant.opinion&&<div style={{background:C.goldLight,border:"1px solid "+C.goldBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:C.gold,marginBottom:"5px"}}>💬 컨설턴트 종합의견</div>
            <div style={{fontSize:"12px",color:C.text,lineHeight:1.7}}>{d.consultant.opinion}</div>
          </div>}

          {/* 배분전략 */}
          {d.rec.strategy&&<div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"5px"}}>📋 수시 6장 배분 전략</div>
            <div style={{fontSize:"12px",color:C.text,lineHeight:1.7}}>{d.rec.strategy}</div>
          </div>}
        </div>
      )}

      {/* ── 탭2: 보완사항 ── */}
      {tab==="suplement"&&(
        <div>
          <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"10px"}}>🔧 추가 정보 입력 후 재분석</div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:"11px",color:C.sub,marginBottom:3}}>변경 고려 전공 (선택)</div>
              <input type="text" value={altMajor} onChange={e=>setAltMajor(e.target.value)} placeholder="예: 경영학, 컴퓨터공학"
                style={{width:"100%",padding:"8px 12px",background:C.panel,border:"1px solid "+C.border,borderRadius:"8px",color:C.text,fontSize:"13px",fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:"11px",color:C.sub,marginBottom:3}}>3학년 이수 예정 과목 (선택)</div>
              <textarea value={subjects} onChange={e=>setSubjects(e.target.value)} placeholder="예: 언어와 매체, 확률과 통계, 생활과 윤리, 사회문제 탐구"
                style={{width:"100%",padding:"8px 12px",background:C.panel,border:"1px solid "+C.border,borderRadius:"8px",color:C.text,fontSize:"13px",fontFamily:"inherit",resize:"vertical",minHeight:"70px",boxSizing:"border-box"}}/>
            </div>
            <button onClick={()=>onReanalyze(altMajor,subjects)} disabled={isReanalyzing}
              style={{width:"100%",padding:"11px",background:isReanalyzing?"#94a3b8":"linear-gradient(135deg,#7c3aed,#6d28d9)",border:"none",borderRadius:"8px",color:"white",fontSize:"13px",fontWeight:700,cursor:isReanalyzing?"not-allowed":"pointer",fontFamily:"inherit"}}>
              {isReanalyzing?"보완사항 분석 중…":"🔄 보완사항 재분석"}
            </button>
          </div>

          {d.suplement?(
            <div>
              {d.suplement.추천전공.length>0&&<div style={{background:C.aLight,border:"1px solid "+C.aBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
                <div style={{fontSize:"11px",fontWeight:700,color:C.accent,marginBottom:"6px"}}>📌 추천 전공 지원을 위한 3학년 보완사항</div>
                {d.suplement.추천전공.map((s,i)=><div key={i} style={{fontSize:"12px",color:C.text,lineHeight:1.7,marginBottom:3}}>• {s}</div>)}
              </div>}
              {d.altMajor&&d.suplement.희망전공.length>0&&d.suplement.희망전공[0]!=="해당없음"&&
                <div style={{background:C.violetLight,border:"1px solid "+C.violetBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
                  <div style={{fontSize:"11px",fontWeight:700,color:C.violet,marginBottom:"6px"}}>📌 변경 고려 전공 ({d.altMajor}) 보완사항</div>
                  {d.suplement.희망전공.map((s,i)=><div key={i} style={{fontSize:"12px",color:C.text,lineHeight:1.7,marginBottom:3}}>• {s}</div>)}
                </div>}
              {d.suplement.이수과목!=="해당없음"&&<div style={{background:C.greenLight,border:"1px solid "+C.greenBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
                <div style={{fontSize:"11px",fontWeight:700,color:C.green,marginBottom:"5px"}}>📖 이수과목 기반 보완 방향</div>
                <div style={{fontSize:"12px",color:C.text,lineHeight:1.7}}>{d.suplement.이수과목}</div>
              </div>}
              {d.suplement.세특방향.length>0&&<div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
                <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"8px"}}>📝 세특 탐구 방향</div>
                {d.suplement.세특방향.map((s,i)=><div key={i} style={{borderBottom:"1px solid "+C.border,padding:"6px 0",fontSize:"12px",color:C.text,lineHeight:1.6}}>{s}</div>)}
              </div>}
              {d.suplement.창체&&<div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
                <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"5px"}}>🎭 창체·동아리 방향</div>
                <div style={{fontSize:"12px",color:C.text,lineHeight:1.7}}>{d.suplement.창체}</div>
              </div>}
              {d.suplement.수능&&<div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
                <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"5px"}}>📚 수능 전략</div>
                <div style={{fontSize:"12px",color:C.text,lineHeight:1.7}}>{d.suplement.수능}</div>
              </div>}
            </div>
          ):(
            <div style={{background:C.panel,borderRadius:"10px",padding:"20px",textAlign:"center",color:C.muted,fontSize:"12px"}}>
              위에서 추가 정보 입력 후 재분석하면 보완사항이 표시됩니다
            </div>
          )}
        </div>
      )}

      {/* ── 탭3: 대학추천 ── */}
      {tab==="recs"&&(
        <div>
          {/* 학종/교과 전환 */}
          <div style={{display:"flex",gap:"6px",marginBottom:"10px",background:C.panel,padding:"5px",borderRadius:"10px"}}>
            {[["학종","🎓 학종(종합)"],["교과","📚 교과"]].map(([id,label])=>(
              <button key={id} onClick={()=>setRecMode(id)} style={{flex:1,padding:"8px",border:"none",borderRadius:"8px",fontSize:"12px",fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:recMode===id?C.surface:"transparent",color:recMode===id?C.accent:C.muted,boxShadow:recMode===id?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>
                {label}
              </button>
            ))}
          </div>

          {recMode==="학종"&&(
            <div>
              {/* 추천/지망 서브탭 */}
              <div style={{display:"flex",gap:"6px",marginBottom:"10px",background:C.panel,padding:"5px",borderRadius:"10px"}}>
                {[["추천학과","🎯 추천학과",d.recMajorGroup?.label||"전체"],["지망학과","🔍 지망학과",d.altMajor||d.지망전공||"전체"]].map(([id,label,sub])=>(
                  <button key={id} onClick={()=>setJongSub(id)} style={{flex:1,padding:"7px 5px",border:"none",borderRadius:"8px",fontSize:"11px",fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:jongSub===id?C.surface:"transparent",color:jongSub===id?C.accent:C.muted,boxShadow:jongSub===id?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>
                    <div>{label}</div>
                    <div style={{fontSize:"10px",fontWeight:400,marginTop:1}}>{sub}</div>
                  </button>
                ))}
              </div>

              {jongSub==="추천학과"&&(
                <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
                  <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"6px"}}>🎯 AI 추천 전공 기준 — {d.recMajorGroup?.label||"전체"}</div>
                  <RecsPanel recs={jongRecRecs} majorGroup={d.recMajorGroup} suneungOk={d.facts.suneungOk} mode="학종"/>
                </div>
              )}
              {jongSub==="지망학과"&&(
                <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
                  <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"6px"}}>
                    🔍 {d.altMajor?"변경 고려 전공":"지망 전공"} 기준 — {d.altMajor||d.지망전공||"미입력"}
                    {d.altMajor&&<span style={{marginLeft:6,fontSize:"10px",background:C.violetLight,color:C.violet,padding:"1px 6px",borderRadius:"4px"}}>변경 고려</span>}
                  </div>
                  <RecsPanel recs={jongWishRecs} majorGroup={wishMajorGroup} suneungOk={d.facts.suneungOk} note={d.altMajor?"변경 희망 전공 기준":undefined} mode="학종"/>
                </div>
              )}
            </div>
          )}

          {recMode==="교과"&&(
            <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
              <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"4px"}}>📚 교과전형 추천 — {d.계열}</div>
              <div style={{fontSize:"10px",color:C.muted,marginBottom:"8px"}}>내신 등급만으로 판정 · 비교과 보정 없음 · 수능최저 직접 표시</div>
              <RecsPanel recs={gyogwaRecs} majorGroup={null} suneungOk={d.facts.suneungOk} mode="교과"/>
            </div>
          )}
        </div>
      )}

      {/* ── 탭4: 입결검색 ── */}
      {tab==="search"&&(
        <div>
          <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"8px"}}>🔍 입결 검색</div>
            <input type="text" value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="대학명·학과명·전형명 검색 (2글자 이상)"
              style={{width:"100%",padding:"9px 12px",background:C.panel,border:"1px solid "+C.border,borderRadius:"8px",color:C.text,fontSize:"13px",fontFamily:"inherit",boxSizing:"border-box",marginBottom:"10px"}}/>
            {searchQ.length>=2&&searchResults.length===0&&<div style={{color:C.muted,fontSize:"12px",textAlign:"center",padding:"20px"}}>검색 결과 없음</div>}
            {searchResults.slice(0,30).map((r,i)=>(
              <div key={i} style={{borderBottom:"1px solid "+C.border,padding:"8px 0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <span style={{fontWeight:700,fontSize:"13px",color:C.text}}>{r.u}</span>
                  <span style={{fontSize:"10px",background:C.panel,color:C.sub,padding:"1px 6px",borderRadius:"4px",border:"1px solid "+C.border}}>{r.g}</span>
                </div>
                <div style={{fontSize:"12px",color:C.accent,marginTop:2}}>→ {r.m}</div>
                <div style={{fontSize:"11px",color:C.sub,marginTop:1}}>{r.t}{r.method?<span style={{marginLeft:6,fontSize:"10px",color:C.muted}}>({r.method})</span>:null}</div>
                <div style={{fontSize:"10px",color:C.muted,marginTop:2}}>
                  <span>50%컷 <b style={{color:C.accent}}>{r.c?.toFixed(2)}</b></span>
                  <span style={{margin:"0 6px"}}>|</span>
                  <span>70%컷 <b style={{color:C.rose}}>{r.c70?.toFixed(2)}</b></span>
                  <span style={{margin:"0 6px"}}>|</span>
                  <span>4개년평균 {r.avg4?.toFixed(2)}</span>
                </div>
                {r.s27&&r.s27!=="없음"&&<div style={{fontSize:"10px",color:C.rose,marginTop:3,background:C.roseLight,borderRadius:"4px",padding:"2px 6px"}}>수능최저: {r.s27.slice(0,70)}</div>}
              </div>
            ))}
            {searchResults.length>30&&<div style={{fontSize:"11px",color:C.muted,textAlign:"center",paddingTop:8}}>상위 30개 표시 중 (전체 {searchResults.length}개)</div>}
          </div>
        </div>
      )}

      {/* ── 탭5: 리포트 ── */}
      {tab==="report"&&(
        <div>
          <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
            <div style={{fontSize:"12px",fontWeight:700,color:C.text,marginBottom:"8px"}}>📄 리포트 출력</div>
            <div style={{fontSize:"11px",color:C.sub,lineHeight:1.7,marginBottom:"12px",padding:"8px 10px",background:C.panel,borderRadius:"8px"}}>
              <b>복사</b>: 클립보드로 복사 → 메모장·한글·Word에서 편집 후 저장<br/>
              <b>PDF저장</b>: 브라우저 인쇄 → PDF로 저장 (Ctrl+P)
            </div>
            <button onClick={copyReport}
              style={{width:"100%",padding:"12px",background:C.accent,border:"none",borderRadius:"8px",color:"white",fontWeight:700,fontSize:"13px",cursor:"pointer",fontFamily:"inherit",marginBottom:"8px"}}>
              📋 리포트 전체 복사
            </button>
            <button onClick={()=>window.print()}
              style={{width:"100%",padding:"12px",background:C.goldLight,border:"1px solid "+C.goldBorder,borderRadius:"8px",color:C.gold,fontWeight:700,fontSize:"13px",cursor:"pointer",fontFamily:"inherit"}}>
              🖨️ PDF 저장 (인쇄)
            </button>
          </div>

          {/* 리포트 미리보기 */}
          <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"8px"}}>리포트 구성</div>
            {[
              ["학생 기본정보 + 역량 점수",true],
              ["성적 분석 + 진로별 유불리",!!d.진로별유불리],
              ["강점 / 보완점",d.strengths.length>0],
              ["추천전공 + 보완사항",d.suplement?.추천전공.length>0],
              ["희망전공 + 보완사항",!!(d.altMajor&&d.suplement?.희망전공.length>0)],
              ["이수과목 기반 보완 방향",d.suplement?.이수과목!=="해당없음"],
              ["학종 추천 대학",jongRecRecs.all.length>0],
              ["교과 추천 대학",gyogwaRecs.all.length>0],
              ["수시 6장 배분 전략",!!d.rec.strategy],
              ["컨설턴트 종합의견",!!d.consultant.opinion],
              ["학부모 상담 포인트",!!d.consultant.counselPoint],
            ].map(([label,hasData])=>(
              <div key={label} style={{display:"flex",alignItems:"center",gap:"8px",padding:"4px 0",borderBottom:"1px solid "+C.border}}>
                <span style={{fontSize:"11px",color:hasData?C.green:C.muted}}>{hasData?"✅":"⬜"}</span>
                <span style={{fontSize:"12px",color:hasData?C.text:C.muted}}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 학부모 상담 포인트 */}
      {d.consultant.counselPoint&&tab==="analysis"&&<div style={{background:C.goldLight,border:"1px solid "+C.goldBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:C.gold,marginBottom:"5px"}}>👪 학부모 상담 포인트</div>
        <div style={{fontSize:"12px",color:C.text,lineHeight:1.7}}>{d.consultant.counselPoint}</div>
      </div>}

      <button onClick={onReset} style={{width:"100%",padding:"10px",borderRadius:"8px",border:"1px solid "+C.border,background:"transparent",color:C.muted,fontSize:"12px",cursor:"pointer",fontFamily:"inherit",marginTop:4}}>
        ← 다른 학생부 분석하기
      </button>
    </div>
  );
}

// ── App 메인 ──────────────────────────────────────────────────────
export default function App(){
  const[phase,setPhase]=useState("upload");
  const[step,setStep]=useState(0);
  const[drag,setDrag]=useState(false);
  const[result,setResult]=useState(null);
  const[rawText,setRawText]=useState("");
  const[error,setError]=useState("");
  const[showManual,setShowManual]=useState(false);
  const[isReanalyzing,setIsReanalyzing]=useState(false);
  const fileRef=useRef();

  const runAnalysis=useCallback(async(file)=>{
    setPhase("loading");setStep(0);
    try{
      setStep(1);const text=await readFile(file);setRawText(text);
      setStep(2);await new Promise(r=>setTimeout(r,50));
      setStep(4);const raw=await callAI(makePrompt1(text));
      setStep(6);const data=parseAnalysis(raw,text);
      data.altMajor="";data.wishMajorGroup=data.recMajorGroup;data.suplement=null;
      setResult(data);setPhase("result");
    }catch(e){setError(e.message||"알 수 없는 오류");setPhase("error");}
  },[]);

  const handleReanalyze=useCallback(async(altMajor,subjects)=>{
    if(!result)return;
    setIsReanalyzing(true);
    try{
      const raw=await callAI(makePrompt2(result,altMajor,subjects),3000);
      const sup=parseSuplement(raw);
      const wishMajorGroup=detectMajorGroup(altMajor)||result.recMajorGroup;
      setResult(prev=>({...prev,altMajor,wishMajorGroup,suplement:sup}));
    }catch(e){alert("보완사항 분석 오류: "+e.message);}
    finally{setIsReanalyzing(false);}
  },[result]);

  const drop=useCallback((e)=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)runAnalysis(f);},[runAnalysis]);
  const reset=()=>{setPhase("upload");setResult(null);setError("");setStep(0);setShowManual(false);setRawText("");};

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif",color:C.text}}>
      {/* 상단 바 */}
      <div style={{background:C.surface,borderBottom:"1px solid "+C.border,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:"16px",fontWeight:900,letterSpacing:"2px"}}>KAIROS 153</div>
          <div style={{fontSize:"10px",color:C.muted}}>카이로스153 · 신지은 · v11.0</div>
        </div>
        <div style={{fontSize:"10px",color:C.muted,textAlign:"right"}}>
          <div>학종 인문{(DB_V11.학종?.인문사회||[]).length} · 자연{(DB_V11.학종?.자연공학||[]).length}</div>
          <div>교과 인문{(DB_V11.교과?.인문사회||[]).length} · 자연{(DB_V11.교과?.자연공학||[]).length}</div>
        </div>
      </div>

      <div style={{maxWidth:"640px",margin:"0 auto",padding:"16px 14px 60px"}}>
        {phase==="upload"&&(
          <>
            <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={drop}
              onClick={()=>fileRef.current?.click()}
              style={{border:"2px dashed "+(drag?C.accent:C.border),borderRadius:"12px",padding:"40px 20px",textAlign:"center",cursor:"pointer",background:drag?C.aLight:C.surface,transition:"all 0.2s",marginBottom:"12px"}}>
              <input ref={fileRef} type="file" accept=".pdf,.txt" style={{display:"none"}} onChange={e=>e.target.files[0]&&runAnalysis(e.target.files[0])}/>
              <div style={{fontSize:"32px",marginBottom:"8px"}}>{drag?"📂":"📄"}</div>
              <div style={{color:C.text,fontWeight:700,fontSize:"14px",marginBottom:"4px"}}>학생부 파일 드래그 또는 클릭</div>
              <div style={{color:C.sub,fontSize:"11px"}}>PDF(나이스플러스) · TXT · 최대 30MB</div>
            </div>
            <div style={{background:C.aLight,border:"1px solid "+C.aBorder,borderRadius:"10px",padding:"12px",fontSize:"11px",color:C.accent,lineHeight:1.8,marginBottom:"10px"}}>
              <div style={{fontWeight:700,marginBottom:"3px"}}>v11.0 — 학종·교과 분리 · 실입결 DB · 편향없는 순수분석</div>
              <div>학종: 학업40/진로40/공동체20 가중치 · 22개 전공 매핑 · 5탭 구조</div>
              <div>교과: 내신만 판정 · 전형방법+수능최저 직접 표시 · 분석후 보완사항 입력</div>
            </div>
            <button onClick={()=>setShowManual(v=>!v)} style={{width:"100%",padding:"11px",background:"transparent",border:"1px solid "+C.border,borderRadius:"10px",color:C.sub,fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>
              {showManual?"▲ 수동 입력 닫기":"▼ 파일 없이 등급 직접 입력"}
            </button>
            {showManual&&<ManualInput onAnalyze={d=>{setResult(d);setPhase("result");}}/>}
          </>
        )}

        {phase==="loading"&&<Loading step={step}/>}
        {phase==="result"&&result&&<Result d={result} onReset={reset} onReanalyze={handleReanalyze} isReanalyzing={isReanalyzing}/>}

        {phase==="error"&&(
          <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"12px",padding:"24px",textAlign:"center"}}>
            <div style={{fontSize:"28px",marginBottom:"8px"}}>😔</div>
            <div style={{color:C.rose,fontWeight:700,fontSize:"13px",marginBottom:"10px"}}>오류가 발생했습니다</div>
            <div style={{background:C.panel,borderRadius:"8px",padding:"10px",marginBottom:"10px",textAlign:"left"}}>
              <div style={{fontSize:"11px",color:C.sub,whiteSpace:"pre-wrap",lineHeight:1.7}}>{error}</div>
            </div>
            <div style={{background:C.greenLight,border:"1px solid "+C.greenBorder,borderRadius:"8px",padding:"10px",marginBottom:"14px",textAlign:"left"}}>
              <div style={{color:C.green,fontSize:"11px",fontWeight:700,marginBottom:"3px"}}>해결 방법</div>
              <div style={{color:C.sub,fontSize:"11px",lineHeight:1.8}}>나이스플러스: 인쇄→PDF저장<br/>스캔 PDF: 텍스트복사→메모장→.txt<br/>Word·한글: PDF로 내보내기</div>
            </div>
            <button onClick={reset} style={{padding:"10px 24px",borderRadius:"8px",border:"1px solid "+C.accent,background:C.aLight,color:C.accent,fontSize:"12px",cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>다시 시도하기</button>
          </div>
        )}
      </div>
    </div>
  );
}
