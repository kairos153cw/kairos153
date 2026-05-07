import { useState, useRef, useCallback, useEffect } from "react";

// ── 프린트 CSS (v11.4) ──────────────────────────────────────────────
const PRINT_STYLE = `
@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  .print-page { page-break-after: always; }
}
@media screen { .print-only { display: none; } }
`;

/*
카이로스153 생기부 분석기 v11.4  대표 컨설턴트: 신지은
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[v11.4 변경사항]
1. AI 역할 최소화 — 서류등급 1개만 출력, 점수계산 전부 코드화
2. 조정내신 도입 — 원내신 ÷ 고교계수 × MAC보정계수 (선형보간)
3. GRADE_SCORE 테이블 — 조정내신→내신점수 환산 (18구간)
4. SEBU_SCORE 테이블 — 서류등급→세특점수 고정값 (S=100~B-=78)
5. 역량점수 40:39:21 — 학업/진로/공동체 (배지별 내신:세특 비율)
6. 공동체 4항목 — 30/28/22/20 + 정규화 + 상단압축
7. 판정매트릭스 — 티어×역량강도 → 합격유력/가능/신중/비추
8. 전공매칭 29개 — 길이순 정렬 + 그룹확장검색
9. 배지 9종 — 기존 7종 + 🔵🟡🔴 전형성향 추가
10. TXT 전용 — PDF 제거, 파싱 안정성 향상
11. 사전입력창 — 업로드 전 희망전공/이수과목/동아리/검토사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*/

// ── v11.4 신규 상수 ───────────────────────────────────────────────────

// 고교계수
const SCHOOL_TYPE_COEFF = {
  "일반고":1.00,"광역자사":1.25,"전국자사":1.70,
  "외고국제":1.35,"과학고":1.55,"영재고":1.90,
};

// 맥에듀테크 6×6 MAC 매트릭스
const MAC_COEFF = {
  1:{"S":0.93,"A+":0.94,"A":0.95,"B+":0.96,"B":0.97,"B-":0.98},
  2:{"S":0.88,"A+":0.90,"A":0.92,"B+":0.93,"B":0.95,"B-":0.96},
  3:{"S":0.84,"A+":0.87,"A":0.89,"B+":0.91,"B":0.93,"B-":0.94},
  4:{"S":0.81,"A+":0.84,"A":0.86,"B+":0.88,"B":0.91,"B-":0.92},
  5:{"S":0.79,"A+":0.82,"A":0.84,"B+":0.86,"B":0.89,"B-":0.90},
  6:{"S":0.77,"A+":0.80,"A":0.82,"B+":0.84,"B":0.87,"B-":0.88},
};

// 조정내신 → 내신점수 (18구간 선형보간)
// 1.0~1.5: -7점 / 1.5~5.4: 0.3단위 -3점 / 5.4~6.9: 0.5단위 -5점
const GRADE_SCORE = [
  [1.0,100],[1.5,93],
  [1.8,90],[2.1,87],[2.4,84],[2.7,81],
  [3.0,78],[3.3,75],[3.6,72],[3.9,69],
  [4.2,66],[4.5,63],[4.8,60],[5.1,57],[5.4,54],
  [5.9,49],[6.4,44],[6.9,39],
];

// 서류등급 → 세특점수 (S→A+: 6점, 나머지: 4점 균등)
const SEBU_SCORE = {"S":100,"A+":94,"A":90,"B+":86,"B":82,"B-":78};

// 공동체 배점
const COMM_LEADERSHIP = {"임원+리더":30,"임원or리더":24,"역할있음":18,"없음":12};
const COMM_BONGSA     = {"지속적":22,"꾸준":17,"간헐적":12,"미흡":5};
const COMM_HYEOBUP    = {"리더적":28,"적극":22,"참여":16,"미흡":8};
const COMM_SEONGSHIL  = {"정상":20,"미인정소수":14,"미인정다수":6,"학폭조치":0};

// 진로일관성 보정
const CAREER_BONUS = {"완전일관":0,"유관일관":0,"부분일관":-10,"불일관":-20};

// 파싱 기본값 (v11.4)
const PARSE_DEFAULTS = {
  docGrade:     "B",
  leadership:   "역할있음",
  bongsa:       "간헐적",
  hyeobup:      "참여",
  seongshil:    "정상",
  careerConsist:"유관일관",
};

// ── v11.4 신규 함수 ───────────────────────────────────────────────────

// MAC 선형보간 (경계 튐 방지)
function getMacCoeffInterp(보정grade, docGrade) {
  const tier = Math.floor(보정grade);
  const frac = 보정grade - tier;
  const c1 = MAC_COEFF[Math.min(6,Math.max(1,tier))]?.[docGrade] ?? 0.90;
  const c2 = MAC_COEFF[Math.min(6,Math.max(1,tier+1))]?.[docGrade] ?? 0.90;
  return c1 + frac*(c2-c1);
}

// 조정내신 계산
function calcAdjGrade(grade9, schoolType, docGrade) {
  const coeff = SCHOOL_TYPE_COEFF[schoolType] ?? 1.00;
  const 보정 = grade9 / coeff;
  const mac = getMacCoeffInterp(보정, docGrade);
  return Number((보정 * mac).toFixed(2));
}

// 조정내신 → 내신점수 (선형보간, 소수 오차 방지)
function adjToScore(adj) {
  const adjSafe = Number(adj.toFixed(2));
  const pts = GRADE_SCORE;
  if (adjSafe <= pts[0][0]) return pts[0][1];
  if (adjSafe >= pts[pts.length-1][0]) return pts[pts.length-1][1];
  for (let i=0; i<pts.length-1; i++) {
    const [lo,sLo]=pts[i], [hi,sHi]=pts[i+1];
    if (adjSafe>=lo && adjSafe<=hi)
      return Math.round(sLo+(adjSafe-lo)/(hi-lo)*(sHi-sLo));
  }
  return 39;
}

// 5→9 등급 변환 (교육청 실데이터)
const FIVE_TO_NINE_PTS = [
  [1.000,1.55],[1.167,1.84],[1.333,2.14],[1.500,2.47],
  [2.000,3.40],[2.500,4.21],[3.000,5.50],[3.500,6.50],
  [4.000,7.50],[5.000,9.00],
];
function fiveToNine(g5) {
  const pts = FIVE_TO_NINE_PTS;
  if (g5<=pts[0][0]) return pts[0][1];
  if (g5>=pts[pts.length-1][0]) return pts[pts.length-1][1];
  for (let i=0;i<pts.length-1;i++){
    const [lo5,lo9]=pts[i],[hi5,hi9]=pts[i+1];
    if (g5>=lo5&&g5<=hi5) return lo9+(g5-lo5)/(hi5-lo5)*(hi9-lo9);
  }
  return 9.0;
}

// 전형성향 배지 (갭 기반)
function getSpreadBadge(갭) {
  if (갭>=0.30) return "🔵";  // 서사형
  if (갭>=0.18) return "🟡";  // 균형형
  return "🔴";                  // 정량형
}

// 판정 매트릭스
function getVerdict(tier, strength) {
  const m = {
    안정:{강:"합격유력",중:"합격유력",약:"가능"},
    적정:{강:"합격유력",중:"가능",약:"신중"},
    소신:{강:"가능",중:"신중",약:"비추"},
    상향:{강:"신중",중:"비추",약:"비추"},
  };
  return m[tier]?.[strength] ?? "-";
}

// 공동체 정규화 + 상단압축
function calcCommunityFinal(community) {
  const norm = (community - 25) / 75 * 100;
  if (norm >= 85) return 85 + (norm - 85) * 0.3;
  return norm;
}

// 역량강도
function getStrength(n) { return n>=75?"강":n>=60?"중":"약"; }

// ── 여대 목록 ──────────────────────────────────────────────────────
const WOMENS_UNIV = new Set(["이화여대","숙명여대","성신여대","덕성여대","서울여대"]);

// ── 29개 전공 그룹 매핑 (v11.4: 길이순 정렬 매칭) ────────────────
const MAJOR_GROUPS = [
  {id:"media",   label:"미디어·언론·방송",   recMajor:"미디어커뮤니케이션학과",
   matchTerms:["미디어콘텐츠","신문방송","커뮤니케이션","미디어","언론","방송","콘텐츠","영상","영화","홍보","저널","광고"]},
  {id:"biz",     label:"경영·경제·무역",      recMajor:"경영학과",
   matchTerms:["벤처중소기업","글로벌비즈니스","앙트러프러너십","산업유통","아태물류","정보시스템","경영","경제","회계","마케팅","무역","통상","금융","경상","세무","부동산","물류","유통","소비자","상경"]},
  {id:"law",     label:"법·정치·행정",        recMajor:"법학과",
   matchTerms:["지적재산권","고용서비스","국토안보","해양안보","경찰학","북한학","정책학","법학","정치","행정","공공","외교","안보학"]},
  {id:"psych",   label:"심리·상담·사회복지",  recMajor:"심리학과",
   matchTerms:["휴먼서비스","사회복지","가족학","청소년","심리","상담","복지","아동"]},
  {id:"social",  label:"사회학·사회과학",     recMajor:"사회학과",
   matchTerms:["문화인류학","창의인재","사회학","지리학","인류학","사회"]},
  {id:"edu",     label:"교육·사범",           recMajor:"교육학과",
   matchTerms:["교육","사범","교직"]},
  {id:"korean",  label:"국어·국문·문학",      recMajor:"국어국문학과",
   matchTerms:["문예창작","문헌정보","국어","국문","문학","언어","미학"]},
  {id:"history", label:"사학·역사·문화재",    recMajor:"사학과",
   matchTerms:["문화유산","문화재","사학","역사","고고"]},
  {id:"philo",   label:"철학·윤리",           recMajor:"철학과",
   matchTerms:["기독교학","종교학","유학·동","철학","윤리","신학"]},
  {id:"tourism", label:"관광·호텔·외식",      recMajor:"관광학과",
   matchTerms:["투어리즘","관광","호텔","외식","여행"]},
  {id:"design",  label:"디자인·예술·미술",    recMajor:"디자인학과",
   matchTerms:["콘텐츠디자인","뷰티산업","생활과학","아트&테크","디자인","예술","미술","패션","의류","의상","연극","웹문예"]},
  {id:"sport",   label:"체육·스포츠",         recMajor:"체육학과",
   matchTerms:["체육","스포츠"]},
  {id:"cs",      label:"컴퓨터·소프트웨어",   recMajor:"컴퓨터공학과",
   matchTerms:["소프트웨어","사이버보안","정보보안","산업보안","컴퓨터","SW","사이버"]},
  {id:"ai",      label:"AI·데이터사이언스",   recMajor:"인공지능학과",
   matchTerms:["데이터사이언스","인공지능","데이터과학","빅데이터","AI"]},
  {id:"ee",      label:"전기·전자·반도체",    recMajor:"전자공학과",
   matchTerms:["반도체","전기","전자","통신"]},
  {id:"me",      label:"기계·항공·우주",      recMajor:"기계공학과",
   matchTerms:["기계","항공","우주","로봇"]},
  {id:"arch",    label:"건축·토목·도시",      recMajor:"건축학과",
   matchTerms:["건축","토목","도시","환경"]},
  {id:"bio",     label:"생명·바이오·식품",    recMajor:"생명공학과",
   matchTerms:["생명","바이오","생물","식품"]},
  {id:"chem",    label:"화학·신소재·재료",    recMajor:"화학공학과",
   matchTerms:["신소재","화학","재료"]},
  {id:"math",    label:"수학·통계",            recMajor:"통계학과",
   matchTerms:["수학","통계","수리","보험"]},
  {id:"med",     label:"의학·치의·약학·한의", recMajor:"의예과",
   matchTerms:["의학","의예","치의","약학","한의"]},
  {id:"nurs",    label:"간호·보건",            recMajor:"간호학과",
   matchTerms:["간호","보건","재활"]},
  {id:"liberal", label:"자유전공·무전공",      recMajor:"자유전공학부",
   matchTerms:["경상대학 자율","인문대학 자율","인문과학계열","생활과학계열","경상계열","자유전공","무전공","자유학부","미래융합","자율전공","자율학부","인터칼리지","전 모집단위"]},
  {id:"hum_dept",label:"계열전공(인문)",       recMajor:"인문계열",
   matchTerms:["인문사회","인문계열","인문학부","문과계열","사회계열"]},
  {id:"nat_dept",label:"계열전공(자연)",       recMajor:"자연계열",
   matchTerms:["자연공학","자연계열","자연과학부","이과계열","공학계열"]},
  {id:"fusion",  label:"계열전공(융합·통합)",  recMajor:"융합계열",
   matchTerms:["학부대학","전인교육","글로컬","WISE","융합","통합"]},
  {id:"lang",    label:"외국어·어문·통번역",   recMajor:"영어영문학과",
   matchTerms:["포르투갈브라질","스칸디나비아","러시아·유","루마니아어","우크라이나어","이탈리아어","네덜란드어","포르투갈어","프랑스학","베트남학","그리스·불","중국정경","아랍지역","독일학","러시아학","몽골학","일본학","중국학","중동학","튀르키예","헝가리어","스페인어","프랑스어","러시아어","세르비아","페르시아어","독일어","일본어","베트남어","몽골어","인도어","말레이","아랍어","폴란드어","체코","노어","중어","영문","영어","통번역","번역","테슬","국제사무"]},
  {id:"intl",    label:"국제학·지역학·글로벌", recMajor:"국제학과",
   matchTerms:["글로벌한국","중앙아시아","아프리카학","국제관계","국제지역","동아시아","아시아학","동북아","글로벌리더","글로벌협력","글로벌학부","국제학","게페르트","한국학과","LD학부","LT학부","GBT"]},
  {id:"security",label:"경찰·안보·보안",      recMajor:"경찰행정학과",
   matchTerms:["국토안보","해양안보","사이버보안","산업보안","경찰학","안보학"]},
];

// 길이순 정렬 캐시 (성능 최적화)
let _majorTermsCache = null;
function getMajorTermsSorted() {
  if (!_majorTermsCache) {
    _majorTermsCache = MAJOR_GROUPS
      .flatMap(g => g.matchTerms.map(term => ({term, group:g})))
      .sort((a,b) => b.term.length - a.term.length);
  }
  return _majorTermsCache;
}

function detectMajorGroup(t) {
  if (!t) return null;
  const terms = getMajorTermsSorted();
  for (const {term, group} of terms) {
    if (t.includes(term)) return group;
  }
  return null;
}
function isMajorMatch(m, matchTerms) {
  if (!m || !matchTerms) return false;
  const terms = matchTerms.slice().sort((a,b)=>b.length-a.length);
  return terms.some(t => m.includes(t));
}
// 검색어 → 그룹 기반 확장 검색
function getSearchTerms(q) {
  const group = detectMajorGroup(q);
  if (group) return { terms: group.matchTerms, label: group.label };
  return { terms: [q], label: null };
}

// ── DB import ──────────────────────────────────────────────────────
import { DB_JONG_HUM }       from "./db_jong_hum.js";
import { DB_JONG_NAT }       from "./db_jong_nat.js";
import { DB_GYOGWA_HUM }     from "./db_gyogwa_hum.js";
import { DB_GYOGWA_NAT }     from "./db_gyogwa_nat.js";
import { SCHOOL_TYPE_RATIO } from "./db_school_type.js";

function getJongDB(gyeyeol){
  return gyeyeol==="자연공학" ? DB_JONG_NAT : DB_JONG_HUM;
}
function getGyogwaDB(gyeyeol){
  return gyeyeol==="자연공학" ? DB_GYOGWA_NAT : DB_GYOGWA_HUM;
}

// ── Tier 상수 ─────────────────────────────────────────────────────
const C50_RANGE = 1.8;  // 조정내신 기준 표시 범위

// ── 학종 티어 판정 (v11.4: 조정내신 기반) ──────────────────────────
function calcJongTierAdj(adjGrade, c50, c70) {
  if (c70 < c50) { [c50, c70] = [c70, c50]; }  // 역전 방어
  const gap = Math.max(c70 - c50, 0.10);
  if (adjGrade <= c50 - gap) return "안정";
  if (adjGrade <= c50)       return "적정";
  if (adjGrade <= c70)       return "소신";
  if (adjGrade <= c70 + gap) return "상향";
  return "제외";
}

// ── 역량점수 계산 (v11.4: 전부 코드) ──────────────────────────────
function calcScoresV114(adjGrade, docGrade, careerConsist, leadership, bongsa, hyeobup, seongshil, spreadBadge) {
  // 내신점수
  const gradeScore = adjToScore(adjGrade);
  // 세특점수
  const sebuScore = SEBU_SCORE[docGrade] ?? 82;
  // 배지별 학업 비율
  const [wn, ws] = spreadBadge === "🔵" ? [0.30, 0.70]
                 : spreadBadge === "🟡" ? [0.45, 0.55]
                 : [0.60, 0.40];
  const 학업 = Math.round(gradeScore * wn + sebuScore * ws);
  // 진로역량
  const 진로 = Math.max(0, sebuScore + (CAREER_BONUS[careerConsist] ?? -10));
  // 공동체 (4항목 합산 → 정규화 + 상단압축)
  const commRaw = (COMM_LEADERSHIP[leadership] ?? 18) +
                  (COMM_BONGSA[bongsa]         ?? 12) +
                  (COMM_HYEOBUP[hyeobup]        ?? 16) +
                  (COMM_SEONGSHIL[seongshil]    ?? 20);
  const 공동체 = calcCommunityFinal(commRaw);
  return { 학업, 진로, 공동체: Math.round(공동체), commRaw };
}

function calcTotal(scores) {
  return Math.round(scores.학업 * 0.40 + scores.진로 * 0.39 + scores.공동체 * 0.21);
}

function gradeLabel(n) {
  if(n>=88)return"S"; if(n>=80)return"A+"; if(n>=72)return"A";
  if(n>=63)return"A-"; if(n>=53)return"B+"; if(n>=43)return"B";
  if(n>=32)return"B-"; if(n>=21)return"C+"; if(n>=10)return"C";
  return"D";
}

// ── 티어 색상 ──────────────────────────────────────────────────────
const TC={안정:"#15803d",적정:"#1d4ed8",소신:"#92400e",상향:"#6d28d9"};
const TB={안정:"#f0fdf4",적정:"#eff6ff",소신:"#fefce8",상향:"#f5f3ff"};

// ── 교과 Tier (원내신 그대로) ──────────────────────────────────────
function calcGyogwaTier(grade, c, c70){
  if (c70 < c) { [c, c70] = [c70, c]; }
  const gap = Math.max(c70 - c, 0.10);
  const g = parseFloat(grade);
  if(g <= c - gap) return "안정";
  if(g <= c)       return "적정";
  if(g <= c70)     return "소신";
  if(g <= c70+gap) return "상향";
  return "제외";
}

// ── 캠퍼스 base 대학명 추출 (dedup용) ────────────────────────────
function getBaseUniv(u){
  return u.replace(/\(서울\)|\(죽전\)|\(에리카\)|\(글로컬\)|\(WISE\)|\(세종\)|\(원주\)|\(안성\)|\(글로벌\)|\(천안\)|\(의정부\)|\(성남\)|\(다빈치\)/g,'').trim();
}

// ── 학종 합격가능성 (세특 가중치만, 수능최저 제거) ────────────────
// poss는 원래 등급 기준 (학교군 보정 미적용 → tier와 역할 분리)
// 수능최저는 UniCard에서 텍스트만 표시
// poss: adjGrade 기준 (tier와 일관성)
function calcJongPoss(adjGrade, docGrade, c, c70){
  const g = typeof adjGrade === "number" ? adjGrade : parseFloat(adjGrade);
  if(!isFinite(g)||!c) return 1;
  const diff = g - c;
  let ns;
  if(diff<=-0.3) ns=5; else if(diff<=0.3) ns=4; else if(diff<=0.8) ns=3;
  else if(diff<=1.3) ns=2; else ns=1;
  // 서류등급 가중치 (v11.4)
  const sm={"S":5,"A+":4.5,"A":4,"B+":3.5,"B":3,"B-":2.5};
  let base = ns*0.4 + (sm[docGrade]||3)*0.6;
  if(g > c70+0.3) base = Math.min(base, 3);
  return Math.min(10, Math.max(1, Math.round(base)));
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

// ── buildJongRecs: 학종 추천 (v11.4: 조정내신 기반) ───────────────
function buildJongRecs(grade, docGrade, schoolType, gyeyeol, gender, majorGroup, strength){
  const db = getJongDB(gyeyeol);
  const adjGrade = calcAdjGrade(parseFloat(grade), schoolType, docGrade);
  const filtered = db.filter(r =>
    !(gender==="남" && WOMENS_UNIV.has(r.u)) &&
    r.c >= adjGrade - C50_RANGE && r.c <= adjGrade + C50_RANGE
  );
  const scored = filtered.map(r => {
    const tier = calcJongTierAdj(adjGrade, r.c, r.c70);
    if(tier === "제외") return null;
    const gap = r.c70 - r.c;
    const spreadBadge = getSpreadBadge(gap);
    const verdict = getVerdict(tier, strength || "중");
    const majorMatch = majorGroup ? isMajorMatch(r.m, majorGroup.matchTerms) : false;
    const poss = calcJongPoss(adjGrade, docGrade, r.c, r.c70);
    return {...r, tier, adjGrade, diff: adjGrade-r.c, majorMatch, poss, spreadBadge, verdict};
  }).filter(Boolean);

  const byUni = {};
  for(const r of scored){
    const key = getBaseUniv(r.u);
    const p = byUni[key];
    if(!p){ byUni[key]=r; continue; }
    const w = (r.majorMatch&&!p.majorMatch) ||
      (r.majorMatch===p.majorMatch && r.poss>p.poss) ||
      (r.majorMatch===p.majorMatch && r.poss===p.poss && Math.abs(r.diff)<Math.abs(p.diff));
    if(w) byUni[key]=r;
  }
  const to = {안정:0,적정:1,소신:2,상향:3};
  const all = Object.values(byUni).sort((a,b)=>
    (b.majorMatch?1:0)-(a.majorMatch?1:0) ||
    (to[a.tier]||3)-(to[b.tier]||3) ||
    b.poss-a.poss || a.c-b.c
  );
  return {
    안정: all.filter(r=>r.tier==="안정").slice(0,10),
    적정: all.filter(r=>r.tier==="적정").slice(0,10),
    소신: all.filter(r=>r.tier==="소신").slice(0,10),
    상향: all.filter(r=>r.tier==="상향").slice(0,5),
    all,
  };
}

// ── buildGyogwaRecs: 교과 추천 (원래 등급, nGap) ──────────────────
function buildGyogwaRecs(grade, gyeyeol, gender){
  const db = getGyogwaDB(gyeyeol);
  const g = parseFloat(grade);
  const filtered = db.filter(r =>
    !(gender==="남" && WOMENS_UNIV.has(r.u)) &&
    r.c >= g - C50_RANGE && r.c <= g + C50_RANGE
  );
  const scored = filtered.map(r => {
    const tier = calcGyogwaTier(g, r.c, r.c70);
    if(tier === "제외") return null;
    const poss = calcGyogwaPoss(grade, r.c, r.c70);
    return {...r, tier, diff: g-r.c, poss};
  }).filter(Boolean);

  const byUni = {};
  for(const r of scored){
    const key = getBaseUniv(r.u);
    const p = byUni[key];
    if(!p){ byUni[key]=r; continue; }
    if(r.poss>p.poss||(r.poss===p.poss&&Math.abs(r.diff)<Math.abs(p.diff))) byUni[key]=r;
  }
  const to = {안정:0,적정:1,소신:2,상향:3};
  const all = Object.values(byUni).sort((a,b)=>
    (to[a.tier]||3)-(to[b.tier]||3) || a.c-b.c || b.poss-a.poss
  );
  return {
    안정: all.filter(r=>r.tier==="안정").slice(0,10),
    적정: all.filter(r=>r.tier==="적정").slice(0,10),
    소신: all.filter(r=>r.tier==="소신").slice(0,10),
    상향: all.filter(r=>r.tier==="상향").slice(0,5),
    all,
  };
}

// ── AI 시스템 프롬프트 (v11.4) ────────────────────────────────────
const SYS=`당신은 대한민국 최고의 입학사정관이자 입시 전문 컨설턴트입니다.
반드시 아래 형식으로만 응답하세요. JSON 금지. 마크다운 금지.
각 항목은 항목명:: 으로 시작. 배열은 ◆ 기호 구분.
[코드계산용 레이블] 항목은 반드시 지정된 선택지 중 하나만 출력.

[전제 원칙]
① 내신(성적)은 지원 가능 티어를 결정한다. 세특·활동이 합격 여부를 결정한다. "성적이 티어, 활동이 합격 여부"가 학종의 실질 구조다.
② 정량이 아닌 정성 평가. 세특 문장 내 핵심 동사 수준으로 Depth 판단.
   S=재구성/비판, A=분석/설계, B=적용/연결, C=설명/정리, D=이해, E=참여나열
③ 공동체=4개 영역 전체(리더십/협업/봉사/성실). 미인정 결석/지각/조퇴만 감점.
④ 수상·독서 대입 미반영. 확언 금지. 생기부 기재 내용만 근거.
⑤ 성적 상승추이 0.5등급+ → Consistency 강 방향으로 고려.`;

// ── 1단계 프롬프트 (v11.4) ─────────────────────────────────────────
function makePrompt1(text, preInput){
  const t = text.length > 60000 ? text.slice(0,60000) : text;
  const preBlock = (preInput && (preInput.지망전공||preInput.subjects||preInput.club||preInput.memo))
    ? `[컨설턴트 추가 정보 - 참고 정보로 활용할 것]
희망전공: ${preInput.지망전공||""}
이수예정과목: ${preInput.subjects||""}
동아리: ${preInput.club||""}
검토사항: ${preInput.memo||""}
※ 학생부 기재 내용을 분석의 우선 근거로 삼는다.
※ 위 입력 내용이 학생부 기록과 충돌하는 경우 학생부 기록을 우선하고 입력 내용은 참고만 한다.
※ 입력 내용만으로 학생부에 없는 사실을 단정하지 않는다.

` : "";

  return `${preBlock}학생부를 분석하세요.

[팩트]
이름::학생 이름
성별::남/여
학교::고교명
계열::인문사회 또는 자연공학 중 하나
지망전공::희망 전공·계열
내신추이::학기별 등급 예: 1-1)2.65→1-2)3.17
과목별등급::주요과목과 등급 ◆ 로 구분

[코드계산용 레이블 — 반드시 아래 선택지 중 하나만 출력]
서류등급::S/A+/A/B+/B/B- 중 하나
서류등급근거::판단 근거 2문장

Direction게이트: 부분일관→최고A / 불일관→최고B+(DepthS면B+허용)
Consistency: 강=3개년이상OR학년별심화발전, 중=2개년이상, 약=단발

리더십수준::임원+리더/임원or리더/역할있음/없음 중 하나
봉사나눔수준::지속적/꾸준/간헐적/미흡 중 하나
협업소통수준::리더적/적극/참여/미흡 중 하나
성실규칙수준::정상/미인정소수/미인정다수/학폭조치 중 하나
진로일관성수준::완전일관/유관일관/부분일관/불일관 중 하나

리더십기준: 임원+리더=학급/전교임원+동아리장, 임원or리더=둘중하나, 역할있음=모둠장등, 없음=기록없음
봉사기준: 지속적=매학기꾸준, 꾸준=간격있음, 간헐적=일회성, 미흡=거의없음
협업기준: 리더적=주도/조율, 적극=충실참여, 참여=일반참여, 미흡=기록없음
성실기준: 정상=무결석or인정결석, 미인정소수=미인정1~2회, 미인정다수=3회+, 학폭조치=학폭기록

[AI 서술 — 점수와 무관, 자유 서술]
성적추이분석::학년별 성적 흐름 3문장
세특진단::세특 탐구 깊이·진로연계성 3문장
진로일관성분석::진로 방향 일관성 2문장
리더십분석::공동체·리더십 역량 2문장
유리한조합::과목 조합이 유리한 전형과 이유 2문장
불리한조합::발목 잡는 과목 이유 2문장
교과시뮬::교과전형 예상 결과 2문장
진로별성적유불리::지망전공 기준 핵심과목 강약 3문장
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
배분전략::수시 6장 최적 배분 4문장
핵심요약::입시 포인트 5가지 ◆ 구분
컨설턴트의견::종합의견 7문장 이상
상담포인트::학부모 상담 민감 포인트 3문장

학생부:
${t}`;
}

// ── 2단계 프롬프트: 보완사항 ──────────────────────────────────────
function makePrompt2(analysisResult, altMajor, subjects, club){
  const 지망=analysisResult.지망전공||"";
  const recMajors=analysisResult.majors.map(m=>m.name).join(", ");
  return `이전 생기부 분석 결과를 바탕으로 보완사항을 도출하세요.

[학생 정보]
지망전공: ${지망}
AI 추천 전공: ${recMajors}
${altMajor?`변경 고려 전공: ${altMajor}`:""}
${subjects?`3학년 이수 예정 과목: ${subjects}`:""}
${club?`현재 동아리명: ${club}`:""}

내신: ${analysisResult.facts.gradeAll}등급
서류등급: ${analysisResult.facts.docGrade||"B"}
진로일관성: ${analysisResult.facts.careerConsistency}

추천전공보완::추천 전공 지원을 위한 3학년 구체적 보완사항 ◆ 3개
${altMajor?`희망전공보완::변경 고려 전공 "${altMajor}" 지원을 위한 3학년 보완사항 ◆ 3개`:"희망전공보완::해당없음"}
${subjects?`이수과목보완::입력된 이수 예정 과목별 각각 탐구 방향`:`이수과목보완::해당없음`}
세특방향::과목:제안 형식 ◆ 구분 최소 3개
${club?`창체방향::${club} 동아리에서 전공 연계 활동 방향 2문장`:`창체방향::전공 연계 가능한 동아리 유형 추천 2문장 (특정 동아리 이름 지정 금지)`}`;
}

// ── 내신 파싱 ─────────────────────────────────────────────────────
function parseGradesFromText(text){
  const res=[];const lines=text.split(/\n/);
  for(let i=0;i<lines.length-4;i++){
    const unit=parseInt(lines[i].trim(),10);
    if(!unit||unit<1||unit>8)continue;
    for(let j=i+1;j<Math.min(i+10,lines.length);j++){
      const t=lines[j].trim();
      // "A(257)" "B(246)" "A(58)" 형태 매칭 (나이스 TXT 형식)
      if(/^[A-E]\(\d+\)$/.test(t)||/^[A-E]\d+$/.test(t)){
        // 다음줄이 석차등급 (1~9)
        if(j+1<lines.length){
          const g=parseInt(lines[j+1].trim(),10);
          if(g>=1&&g<=9){res.push({unit,grade:g});break;}
        }
        break;
      }
    }
  }
  if(res.length<3)return null;
  const tu=res.reduce((s,r)=>s+r.unit,0);
  const rawAvg=Math.round((res.reduce((s,r)=>s+r.unit*r.grade,0)/tu)*100)/100;
  return{avg:rawAvg,rawAvg,count:res.length};
}
function detectSchoolType(text){
  if(["영재학교","영재고","과학영재"].some(k=>text.includes(k))) return "영재고";
  if(["과학고"].some(k=>text.includes(k))) return "과학고";
  if(["외국어고","국제고","외고"].some(k=>text.includes(k))) return "외고국제";
  if(["민족사관","하나고","상산고","현대청운","포항제철","전국단위자사고"].some(k=>text.includes(k))) return "전국자사";
  if(["자율형사립고","자사고","광역자사"].some(k=>text.includes(k))) return "광역자사";
  return "일반고";
}

// ── 응답 파싱 v11.4 ──────────────────────────────────────────────
function parseAnalysis(raw, text){
  const map={};
  for(const line of raw.split("\n")){
    const idx=line.indexOf("::");if(idx<0)continue;
    const k=line.slice(0,idx).trim(),v=line.slice(idx+2).trim();
    if(k&&v)map[k]=v;
  }
  const s=(k,d="")=>map[k]||d;
  const arr=(k)=>(map[k]||"").split("◆").map(x=>x.trim()).filter(Boolean);

  // 내신 파싱
  const parsed=parseGradesFromText(text);
  const gradeAll=parsed?.count>=5?String(parsed.avg):(()=>{
    const nums=(s("내신추이","").match(/\d+\.\d+/g)||[]).map(Number).filter(n=>n>0&&n<9);
    return nums.length?String(Math.round(nums.reduce((a,b)=>a+b,0)/nums.length*100)/100):"3.0";
  })();

  // [코드계산용 레이블] — v11.4 파싱 기본값
  const DOC_GRADES=["S","A+","A","B+","B","B-"];
  const docGrade = DOC_GRADES.includes(s("서류등급")) ? s("서류등급") : PARSE_DEFAULTS.docGrade;

  const leadership = s("리더십수준") in COMM_LEADERSHIP ? s("리더십수준") : PARSE_DEFAULTS.leadership;
  const bongsa = s("봉사나눔수준") in COMM_BONGSA ? s("봉사나눔수준") : PARSE_DEFAULTS.bongsa;
  const hyeobup = s("협업소통수준") in COMM_HYEOBUP ? s("협업소통수준") : PARSE_DEFAULTS.hyeobup;
  const seongshil = s("성실규칙수준") in COMM_SEONGSHIL ? s("성실규칙수준") : PARSE_DEFAULTS.seongshil;
  const careerConsistency = s("진로일관성수준") in CAREER_BONUS ? s("진로일관성수준") : PARSE_DEFAULTS.careerConsist;

  // 계열/성별/지망전공
  const raw계열=s("계열","인문사회");
  const 계열=(raw계열.includes("자연")||raw계열.includes("공학"))?"자연공학":"인문사회";
  const gender=s("성별","");
  const 지망전공=s("지망전공","");

  // 전공 추천
  const firstMaj=(map["전공추천1"]||"").split("|")[0].trim();
  const recMajorGroup=detectMajorGroup(firstMaj)||detectMajorGroup(지망전공);

  // 학교유형 감지
  const schoolType=detectSchoolType(text);

  return{
    name:s("이름","미확인"),gender,school:s("학교"),
    schoolType,계열,지망전공,recMajorGroup,
    // v11.4 코드계산용 레이블
    docGrade,leadership,bongsa,hyeobup,seongshil,careerConsistency,
    // 팩트
    facts:{gradeAll,docGrade,
           parseInfo:parsed?.count>=5?`직접계산(${parsed.count}과목)`:"추이기반추정"},
    grade:{all:gradeAll,trend:s("내신추이"),bySubject:arr("과목별등급")},
    combo:{good:s("유리한조합"),bad:s("불리한조합"),sim:s("교과시뮬")},
    진로별유불리:s("진로별성적유불리"),
    analysis:{trend:s("성적추이분석"),sebu:s("세특진단"),career:s("진로일관성분석"),leader:s("리더십분석"),
              goodSubjects:arr("강점과목"),badSubjects:arr("약점과목"),excluded:s("미반영","해당없음")},
    strengths:[s("강점1"),s("강점2"),s("강점3")].filter(Boolean),
    weaknesses:[s("보완점1"),s("보완점2")].filter(Boolean),
    majors:[1,2,3].map(i=>{
      const r=map["전공추천"+i]||"";const sp=r.indexOf("|");
      return sp>0?{name:r.slice(0,sp).trim(),reason:r.slice(sp+1).trim()}:null;
    }).filter(Boolean),
    rec:{type:s("추천전형","종합"),reason:s("전형이유"),strategy:s("배분전략")},
    consultant:{summary:arr("핵심요약"),opinion:s("컨설턴트의견"),counselPoint:s("상담포인트")},
    doc근거:s("서류등급근거"),
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

// ── 파일 읽기 (v11.4: TXT 전용) ─────────────────────────────────
async function readFile(file){
  const ext=(file.name||"").split(".").pop().toLowerCase();
  if(file.size>30*1024*1024)throw new Error("30MB 초과.");
  if(["txt"].includes(ext)||(file.type||"").includes("text")){
    const t=await file.text();
    if(!t.trim())throw new Error("빈 파일.");
    return t;
  }
  if(ext==="pdf"||(file.type||"").includes("pdf"))
    throw new Error("PDF는 지원하지 않습니다.\n나이스플러스 → 인쇄 → PDF저장 → 텍스트복사 → 메모장(.txt)으로 저장 후 업로드하세요.");
  throw new Error("TXT 파일만 지원합니다.");
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

// ── getBadges: 배지 9종 (v11.4) ───────────────────────────────────
function getBadges(r){
  const badges=[];
  const spread=r.c70-r.c;
  // ① 수능최저
  if(r.s27&&r.s27!=="없음") badges.push({type:"suneung",label:"수능최저",
    tip:`수능최저: ${r.s27}`,bg:"#fff1f2",tc:"#e11d48"});
  // ② 구간매우좁음/좁음
  if(spread<0.25) badges.push({type:"tight2",label:"⚠️구간매우좁음",
    tip:"합격 구간 매우 좁음(spread<0.25). 내신이 컷에 근접해야 유리",bg:"#fef9c3",tc:"#854d0e"});
  else if(spread<0.40) badges.push({type:"tight1",label:"⚠️구간좁음",
    tip:"합격 구간 좁음(spread<0.40). 내신 편차 주의",bg:"#fef9c3",tc:"#a16207"});
  // ③ 고교유형 비율
  const st=SCHOOL_TYPE_RATIO[r.u];
  if(st){
    const b=st.badge;
    const tip=`일반고 ${st.일반고}% · 과학고 ${st.과학고}% · 외고 ${st.외고}% · 국제고 ${st.국제고}% · 자사고 ${st.자사고}% · 영재고 ${st.영재고}%`;
    const bg=b==="🔴"?"#fff1f2":b==="🟡"?"#fef9c3":"#f0fdf4";
    const tc=b==="🔴"?"#e11d48":b==="🟡"?"#854d0e":"#15803d";
    badges.push({type:"school",label:b,tip,bg,tc});
  }
  // ④ 작년입결주의
  if(r.avg&&r.c>r.avg+0.45) badges.push({type:"warn",label:"⚠️작년입결주의",
    tip:"작년에 낮은 등급도 합격. 4개년 평균 및 전형 구조 변경 확인 권장",bg:"#fff7ed",tc:"#c2410c"});
  // ⑤ 작년입결참고
  if(r.avg&&r.c<r.avg-0.45) badges.push({type:"ref",label:"💡작년입결참고",
    tip:"작년에 높은 등급만 합격. 지원 고려 가능. 4개년 평균 확인 권장",bg:"#f0fdf4",tc:"#15803d"});
  // ⑥ 전형변동
  if(r.chg) badges.push({type:"chg",label:"⚡전형변동",
    tip:`2027 변경: ${r.chg} / 최신 모집요강 직접 확인 필요`,bg:"#f5f3ff",tc:"#6d28d9"});
  // ⑦ 면접
  const isInterview = r.method?.includes("면접")||r.t?.includes("면접")||r.tp?.includes("면접");
  if(isInterview) badges.push({type:"interview",label:"🎤면접",
    tip:"면접 포함 전형",bg:"#eff6ff",tc:"#1d4ed8"});
  // ⑧ 🔵🟡🔴 전형성향 (갭 기반, r.spreadBadge 또는 직접 계산)
  const sb = r.spreadBadge || getSpreadBadge(spread);
  const sbLabel = sb==="🔵"?"🔵서사형":sb==="🟡"?"🟡균형형":"🔴정량형";
  const sbTip = sb==="🔵"?"갭≥0.30: 세특 중심 평가 전형":sb==="🟡"?"갭 0.18~0.30: 내신+세특 균형":"갭<0.18: 내신 중심 평가 전형";
  const sbBg = sb==="🔵"?"#eff6ff":sb==="🟡"?"#fefce8":"#fff1f2";
  const sbTc = sb==="🔵"?"#1d4ed8":sb==="🟡"?"#854d0e":"#e11d48";
  badges.push({type:"spread",label:sbLabel,tip:sbTip,bg:sbBg,tc:sbTc});
  return badges;
}

// 프린트용 배지 텍스트 변환
function getBadgeText(r){
  const tags=[];
  const spread=r.c70-r.c;
  if(spread<0.25) tags.push("구간매우좁음");
  else if(spread<0.40) tags.push("구간좁음");
  if(r.s27&&r.s27!=="없음") tags.push("수능최저");
  if(r.avg&&r.c>r.avg+0.45) tags.push("입결주의");
  if(r.avg&&r.c<r.avg-0.45) tags.push("입결참고");
  if(r.chg) tags.push("전형변동");
  if(r.method?.includes("면접")||r.t?.includes("면접")) tags.push("면접");
  const sb = r.spreadBadge || getSpreadBadge(spread);
  tags.push(sb==="🔵"?"서사형":sb==="🟡"?"균형형":"정량형");
  return tags.join(" · ")||"-";
}
// ── UniCard: 공통 대학 카드 ────────────────────────────────────────
function UniCard({r, i, majorGroup, mode}){
  const badges=getBadges(r);
  const hasSuneung=r.s27&&r.s27!=="없음";
  const diffStr=r.diff>=0?"+"+r.diff.toFixed(2):r.diff.toFixed(2);
  const tc=TC[r.tier]||C.accent, tbg=TB[r.tier]||C.aLight;
  const dispMajor=(majorGroup&&r.majorMatch)?majorGroup.recMajor:r.m;
  const pct=r.tier==="안정"?"90%":r.tier==="적정"?"70%":r.tier==="소신"?"50%":"30%";
  return(
    <div style={{borderBottom:"1px solid "+C.border,padding:"10px 0"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"3px"}}>
        <div style={{flex:1,minWidth:0,display:"flex",flexWrap:"wrap",gap:3,alignItems:"center"}}>
          <span style={{fontSize:"10px",color:C.muted,marginRight:4}}>#{i+1}</span>
          <span style={{fontWeight:700,fontSize:"13px",color:C.text}}>{r.u}</span>
          {mode==="학종"&&r.majorMatch&&<span style={{fontSize:"9px",background:C.greenLight,color:C.green,padding:"1px 5px",borderRadius:"4px",fontWeight:700}}>전공매칭</span>}
          {badges.map((b,bi)=>(
            <span key={bi} title={b.tip} style={{fontSize:"9px",background:b.bg,color:b.tc,padding:"1px 5px",borderRadius:"4px",fontWeight:700,cursor:"help"}}>{b.label}</span>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0,marginLeft:6}}>
          <span style={{background:tbg,color:tc,fontWeight:700,fontSize:"11px",padding:"2px 9px",borderRadius:"6px"}}>{r.tier}</span>
          {r.verdict&&r.verdict!=="-"&&<span style={{fontSize:"10px",fontWeight:700,padding:"1px 6px",borderRadius:"4px",
            background:r.verdict==="합격유력"?"#f0fdf4":r.verdict==="가능"?"#eff6ff":r.verdict==="신중"?"#fefce8":"#fff1f2",
            color:r.verdict==="합격유력"?"#15803d":r.verdict==="가능"?"#1d4ed8":r.verdict==="신중"?"#854d0e":"#e11d48"
          }}>{r.verdict}</span>}
        </div>
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
        {r.avg&&<span style={{marginLeft:6,color:C.muted}}>3개년평균 {r.avg?.toFixed(2)}</span>}
        {r.c70est&&<span style={{marginLeft:4,fontSize:"9px",color:C.muted}}>(c70추정)</span>}
      </div>
      {badges.filter(b=>["tight2","tight1","warn","ref","chg"].includes(b.type)).map((b,bi)=>(
        <div key={bi} style={{fontSize:"10px",color:b.tc,marginTop:"3px",background:b.bg,borderRadius:"6px",padding:"3px 8px",lineHeight:1.5}}>{b.tip}</div>
      ))}
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
function RecsPanel({recs,majorGroup,note,mode}){
  const{안정,적정,소신,상향}=recs;
  return(
    <div>
      <div style={{fontSize:"10px",color:C.muted,marginBottom:"10px",lineHeight:1.7,padding:"8px 10px",background:C.panel,borderRadius:"8px"}}>
        {mode==="학종"?<>
          50%컷(적정) · 70%컷(소신) · gap 기반 소신범위 자동조정<br/>
          {majorGroup?<span style={{color:C.green}}>전공매칭: {majorGroup.label} </span>:<span>전공 미분류 — 전체 표시 </span>}
          · 수능최저 조건은 각 카드에 표시
        </>:<>
          교과전형 내신 기준 · 전형방법·수능최저 직접 표시<br/>
          수능최저 조건은 각 카드에서 직접 확인
        </>}
        {note&&<span style={{color:C.violet}}> · {note}</span>}
      </div>
      <TierSection label="🟢 안정" color={TC.안정} bg={TB.안정} items={안정} majorGroup={majorGroup} mode={mode}/>
      <TierSection label="🔵 적정" color={TC.적정} bg={TB.적정} items={적정} majorGroup={majorGroup} mode={mode}/>
      <TierSection label="🟡 소신" color={TC.소신} bg={TB.소신} items={소신} majorGroup={majorGroup} mode={mode}/>
      <TierSection label="🟣 상향" color={TC.상향} bg={TB.상향} items={상향} majorGroup={majorGroup} mode={mode}/>
    </div>
  );
}

// ── ManualInput ───────────────────────────────────────────────────
function ManualInput({onAnalyze}){
  const[grade,setGrade]=useState("3.0");
  const[sebu,setSebu]=useState("보통");
  const[career,setCareer]=useState("부분일관");
  const[leader,setLeader]=useState("없음");
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
    const adjGradeM=parseFloat(grade)||3.0;
    const spreadBadgeM="🟡";
    const scoresM=calcScoresV114(adjGradeM,"B","유관일관","역할있음","간헐적","참여","정상",spreadBadgeM);
    const scores=scoresM;
    const total=calcTotal(scores);
    const rmg=detectMajorGroup(지망);
    onAnalyze({
      name:"수동입력",gender:gen,school:"",schoolType:"일반고",계열:gyeyeol,지망전공:지망,
      recMajorGroup:rmg,wishMajorGroup:rmg,altMajor:"",
      facts:{gradeAll:grade,sebuLevel:sebu,careerConsistency:career,leadershipLevel:leader,parseInfo:"수동입력",achieveBonus:0},
      grade:{all:grade,trend:"",bySubject:[]},
      combo:{good:"",bad:"",sim:""},진로별유불리:"",
      scores,total,gradeLabel:gradeLabel(total),strength:getStrength(total),adjGrade:adjGradeM,docGrade:"B",
      analysis:{trend:"",sebu:"",career:"",leader:"",goodSubjects:[],badSubjects:[],excluded:"해당없음"},
      strengths:[],weaknesses:[],majors:[],
      rec:{type:"종합",reason:"",strategy:""},
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
  const[recMode,setRecMode]=useState("학종");
  const[altMajor,setAltMajor]=useState("");
  const[subjects,setSubjects]=useState("");
  const[club,setClub]=useState("");
  const[searchQ,setSearchQ]=useState("");

  // v11.4: achieveBonus 제거됨
  const wishMajorGroup=d.altMajor?detectMajorGroup(d.altMajor)||d.wishMajorGroup:d.wishMajorGroup;
  // v11.4: 조정내신 기반 buildJongRecs
  const jongRecRecs=buildJongRecs(d.facts.gradeAll,d.docGrade||"B",d.schoolType||"일반고",d.계열,d.gender,d.recMajorGroup,d.strength||"중");
  const jongWishRecs=buildJongRecs(d.facts.gradeAll,d.docGrade||"B",d.schoolType||"일반고",d.계열,d.gender,wishMajorGroup,d.strength||"중");
  const gyogwaRecs=buildGyogwaRecs(d.facts.gradeAll,d.계열,d.gender);

  // 입결 검색
  const jongDB=getJongDB(d.계열); const gyogwaDB=getGyogwaDB(d.계열);
  const allDb=[...jongDB,...gyogwaDB];
  const searchInfo=getSearchTerms(searchQ);
  const searchResults=searchQ.length>=2?allDb.filter(r=>
    r.u.includes(searchQ)||
    searchInfo.terms.some(t=>r.m.includes(t)||r.t.includes(t))
  ):[];

  // 리포트
  const copyReport=()=>{
    const L=[];
    L.push("KAIROS 153 · 카이로스153 대입컨설팅 · 2027학년도 · v11.2");
    L.push(`학생: ${d.name}${d.gender?" ("+d.gender+")":""} | ${d.school||""} [${d.schoolType}] | ${d.계열}`);
    L.push(`내신: ${d.facts.gradeAll}등급 [${d.facts.parseInfo}]`);
    L.push(`세특: ${"B"} | 진로: ${d.facts.careerConsistency} | 리더십: ${"역할있음"}`);
    L.push(`역량: 학업${gradeLabel(d.scores?.학업||0)}(${d.scores.학업}) / 진로${gradeLabel(d.scores?.진로||0)}(${d.scores.진로}) / 공동체${gradeLabel(d.scores?.공동체||0)}(${d.scores.공동체}) → 종합 ${d.total}점`);
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
            <div style={{color:C.muted,fontSize:"10px",marginBottom:"2px"}}>KAIROS 153 · 신지은 · v11.2</div>
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
          서류등급 <b>{d.docGrade||"B"}</b> · 조정내신 <b>{d.adjGrade?.toFixed(2)||"계산중"}</b> · 진로일관성 <b>{d.careerConsistency||"유관일관"}</b>
          
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
        {[["학업(40%)",gradeLabel(d.scores?.학업||0),C.accent],["진로(40%)",gradeLabel(d.scores?.진로||0),C.green],["공동체(20%)",gradeLabel(d.scores?.공동체||0),C.violet]].map(([l,g,c])=>(
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
            <div style={{marginBottom:12}}>
              <div style={{fontSize:"11px",color:C.sub,marginBottom:3}}>현재 동아리명 (선택)</div>
              <input type="text" value={club} onChange={e=>setClub(e.target.value)} placeholder="예: 신문부, 방송부, 경제탐구반"
                style={{width:"100%",padding:"8px 12px",background:C.panel,border:"1px solid "+C.border,borderRadius:"8px",color:C.text,fontSize:"13px",fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            <button onClick={()=>onReanalyze(altMajor,subjects,club)} disabled={isReanalyzing}
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
                  <RecsPanel recs={jongRecRecs} majorGroup={d.recMajorGroup} mode="학종"/>
                </div>
              )}
              {jongSub==="지망학과"&&(
                <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
                  <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"6px"}}>
                    🔍 {d.altMajor?"변경 고려 전공":"지망 전공"} 기준 — {d.altMajor||d.지망전공||"미입력"}
                    {d.altMajor&&<span style={{marginLeft:6,fontSize:"10px",background:C.violetLight,color:C.violet,padding:"1px 6px",borderRadius:"4px"}}>변경 고려</span>}
                  </div>
                  <RecsPanel recs={jongWishRecs} majorGroup={wishMajorGroup} note={d.altMajor?"변경 희망 전공 기준":undefined} mode="학종"/>
                </div>
              )}
            </div>
          )}

          {recMode==="교과"&&(
            <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
              <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"4px"}}>📚 교과전형 추천 — {d.계열}</div>
              <div style={{fontSize:"10px",color:C.muted,marginBottom:"8px"}}>내신 등급만으로 판정 · 수능최저 조건은 각 카드에서 확인</div>
              <RecsPanel recs={gyogwaRecs} majorGroup={null} mode="교과"/>
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
                  <span>3개년평균 {r.avg?.toFixed(2)??"-"}</span>
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

      {/* ── 인쇄 전용 컴포넌트 (화면에서 숨김, @media print에서 표시) ── */}
      <PrintReport d={d} jongRecRecs={jongRecRecs} jongWishRecs={jongWishRecs} gyogwaRecs={gyogwaRecs} wishMajorGroup={wishMajorGroup}/>
    </div>
  );
}

// ── PrintReport: 전체 인쇄용 컴포넌트 (컨설팅·학부모용) ────────────
function PrintReport({d, jongRecRecs, jongWishRecs, gyogwaRecs, wishMajorGroup}){
  const tiers=["안정","적정","소신","상향"];
  const PrintTier=({label,items,majorGroup,mode})=>{
    if(!items||items.length===0) return null;
    const cell={padding:"3px 5px",border:"1px solid #e2e8f0",fontSize:"8pt"};
    return(
      <div style={{marginBottom:"12px"}}>
        <div style={{fontWeight:700,fontSize:"11pt",borderBottom:"1px solid #e2e8f0",paddingBottom:"3px",marginBottom:"6px"}}>
          {label} ({items.length}개)
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"9pt"}}>
          <thead>
            <tr style={{background:"#f8fafc"}}>
              {["대학","전형","학과","50%컷","70%컷","수능최저","비고"].map(h=>(
                <th key={h} style={{...cell,fontWeight:700,textAlign:"left"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((r,i)=>(
              <tr key={i} style={{background:i%2===0?"#fff":"#f8fafc"}}>
                <td style={{...cell,fontWeight:700}}>{r.u}</td>
                <td style={cell}>{r.t}</td>
                <td style={{...cell,color:"#1d4ed8"}}>{majorGroup&&r.majorMatch?majorGroup.recMajor:r.m}</td>
                <td style={{...cell,textAlign:"center"}}>{r.c?.toFixed(2)}</td>
                <td style={{...cell,textAlign:"center"}}>{r.c70?.toFixed(2)}</td>
                <td style={{...cell,fontSize:"7pt"}}>{r.s27&&r.s27!=="없음"?r.s27.slice(0,28):"없음"}</td>
                <td style={{...cell,fontSize:"7pt",color:"#475569"}}>{getBadgeText(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return(
    <div className="print-only">
      {/* ── 1페이지: 학생 기본정보 + 역량점수 ── */}
      <div className="print-page">
        <div className="print-header">KAIROS 153 · 카이로스153 대입컨설팅 · 2027학년도</div>
        <h2 style={{margin:"8px 0 4px"}}>{d.name}{d.gender&&` (${d.gender})`}</h2>
        <p style={{margin:"2px 0",fontSize:"10pt"}}>{d.school} [{d.schoolType}] · {d.계열}</p>
        <p style={{margin:"2px 0",fontSize:"10pt"}}>
          내신: <b>{d.facts.gradeAll}등급</b>
          
        </p>
        {d.analysis.trend&&<p style={{margin:"2px 0",fontSize:"10pt"}}>성적추이: {d.analysis.trend}</p>}
        {d.지망전공&&<p style={{margin:"2px 0",fontSize:"10pt"}}>지망전공: {d.지망전공}{d.altMajor&&` → 변경고려: ${d.altMajor}`}</p>}
        <div style={{display:"flex",gap:"10px",margin:"8px 0",padding:"8px",background:"#f8fafc",borderRadius:"6px",fontSize:"10pt"}}>
          <div>서류등급: <b>{d.docGrade||"-"}</b></div>
          <div>조정내신: <b>{d.adjGrade?.toFixed(2)||"-"}</b></div>
          <div>학업: <b>{d.scores?.학업||"-"}</b></div>
          <div>진로: <b>{d.scores?.진로||"-"}</b></div>
          <div>공동체: <b>{d.scores?.공동체||"-"}</b></div>
          <div>총점: <b>{d.total||"-"}</b> [{d.gradeLabel||"-"}({d.strength||"-"})]</div>
        </div>
      </div>

      {/* ── 2페이지: AI 분석 ── */}
      <div className="print-page page-break">
        <h3 style={{borderBottom:"2px solid #1d4ed8",paddingBottom:"4px"}}>AI 분석 결과</h3>
        {d.analysis.sebu&&<><h4>세특 진단</h4><p>{d.analysis.sebu}</p></>}
        {d.analysis.career&&<><h4>진로 일관성</h4><p>{d.analysis.career}</p></>}
        {d.진로별유불리&&<><h4>진로별 성적 유불리</h4><p>{d.진로별유불리}</p></>}
        {d.strengths.length>0&&<><h4>강점</h4>{d.strengths.map((s,i)=><p key={i}>{i+1}. {s}</p>)}</>}
        {d.weaknesses.length>0&&<><h4>보완점</h4>{d.weaknesses.map((s,i)=><p key={i}>{i+1}. {s}</p>)}</>}
        {d.majors.length>0&&<><h4>추천 전공</h4>{d.majors.map((m,i)=><p key={i}>{i+1}. {m.name} — {m.reason}</p>)}</>}
      </div>

      {/* ── 3페이지: 수시 6장 배분 전략 ── */}
      <div className="print-page page-break">
        <h3 style={{borderBottom:"2px solid #1d4ed8",paddingBottom:"4px"}}>수시 6장 배분 전략</h3>
        {d.rec.strategy&&<p style={{whiteSpace:"pre-wrap"}}>{d.rec.strategy}</p>}
        {d.consultant.opinion&&<><h3 style={{borderBottom:"2px solid #1d4ed8",paddingBottom:"4px",marginTop:"16px"}}>컨설턴트 종합의견</h3><p style={{whiteSpace:"pre-wrap"}}>{d.consultant.opinion}</p></>}
        {d.consultant.counselPoint&&<><h3 style={{borderBottom:"2px solid #1d4ed8",paddingBottom:"4px",marginTop:"16px"}}>학부모 상담 포인트</h3><p>{d.consultant.counselPoint}</p></>}
      </div>

      {/* ── 4~5페이지: 학종 추천 — 추천학과 ── */}
      <div className="print-page page-break">
        <h3 style={{borderBottom:"2px solid #1d4ed8",paddingBottom:"4px"}}>학종 추천 — 추천학과 ({d.recMajorGroup?.label||"전체"})</h3>
        {tiers.map(t=><PrintTier key={t} label={t} items={jongRecRecs[t]} majorGroup={d.recMajorGroup} mode="학종"/>)}
      </div>

      {/* ── 6~7페이지: 학종 추천 — 지망학과 ── */}
      {jongWishRecs.all.length>0&&(
        <div className="print-page page-break">
          <h3 style={{borderBottom:"2px solid #1d4ed8",paddingBottom:"4px"}}>학종 추천 — 지망학과 ({d.altMajor||d.지망전공||""})</h3>
          {tiers.map(t=><PrintTier key={t} label={t} items={jongWishRecs[t]} majorGroup={wishMajorGroup} mode="학종"/>)}
        </div>
      )}

      {/* ── 8~9페이지: 교과 추천 ── */}
      <div className="print-page page-break">
        <h3 style={{borderBottom:"2px solid #1d4ed8",paddingBottom:"4px"}}>교과전형 추천 — {d.계열}</h3>
        {tiers.map(t=><PrintTier key={t} label={t} items={gyogwaRecs[t]} majorGroup={null} mode="교과"/>)}
      </div>

      {/* ── 10페이지: 보완사항 ── */}
      {d.suplement&&(
        <div className="print-page page-break">
          <h3 style={{borderBottom:"2px solid #1d4ed8",paddingBottom:"4px"}}>보완사항</h3>
          {d.suplement.추천전공.length>0&&<><h4>추천전공 보완 ({d.recMajorGroup?.label||""})</h4>{d.suplement.추천전공.map((s,i)=><p key={i}>• {s}</p>)}</>}
          {d.altMajor&&d.suplement.희망전공.length>0&&<><h4>희망전공 보완 ({d.altMajor})</h4>{d.suplement.희망전공.map((s,i)=><p key={i}>• {s}</p>)}</>}
          {d.suplement.세특방향.length>0&&<><h4>세특 탐구 방향</h4>{d.suplement.세특방향.map((s,i)=><p key={i}>• {s}</p>)}</>}
          {d.suplement.창체&&<><h4>창체·동아리 방향</h4><p>{d.suplement.창체}</p></>}
        </div>
      )}
      <div className="print-footer">KAIROS 153 · 신지은 · {new Date().toLocaleDateString("ko-KR")}</div>
    </div>
  );
}

// ── App 메인 ──────────────────────────────────────────────────────
export default function App(){
  const[phase,setPhase]=useState("upload");
  // 프린트 CSS 삽입
  useEffect(()=>{
    const st=document.createElement("style");
    st.textContent=PRINT_STYLE;
    document.head.appendChild(st);
    return()=>document.head.removeChild(st);
  },[]);
  const[step,setStep]=useState(0);
  const[drag,setDrag]=useState(false);
  const[result,setResult]=useState(null);
  const[rawText,setRawText]=useState("");
  const[error,setError]=useState("");
  const[showManual,setShowManual]=useState(false);
  const[isReanalyzing,setIsReanalyzing]=useState(false);
  // 사전입력창 상태 (v11.4)
  const[preInput,setPreInput]=useState({지망전공:"",subjects:"",club:"",memo:""});
  const fileRef=useRef();

  const runAnalysis=useCallback(async(file)=>{
    setPhase("loading");setStep(0);
    try{
      setStep(1);const text=await readFile(file);setRawText(text);
      setStep(2);await new Promise(r=>setTimeout(r,50));
      setStep(4);const raw=await callAI(makePrompt1(text,preInput));
      setStep(6);const data=parseAnalysis(raw,text);
      // v11.4: 역량점수 코드 계산
      const adjGrade=calcAdjGrade(parseFloat(data.facts.gradeAll),data.schoolType,data.docGrade);
      const spreadBadge="🟡"; // 결과 화면에서 실제 대학 갭 기반으로 재계산됨
      const sc=calcScoresV114(adjGrade,data.docGrade,data.careerConsistency,
        data.leadership,data.bongsa,data.hyeobup,data.seongshil,spreadBadge);
      const total=calcTotal(sc);
      data.adjGrade=adjGrade;
      data.scores=sc;data.total=total;
      data.strength=getStrength(total);
      data.gradeLabel=gradeLabel(total);
      data.altMajor="";data.wishMajorGroup=data.recMajorGroup;data.suplement=null;
      setResult(data);setPhase("result");
    }catch(e){setError(e.message||"알 수 없는 오류");setPhase("error");}
  },[preInput]);

  const handleReanalyze=useCallback(async(altMajor,subjects,club)=>{
    if(!result)return;
    setIsReanalyzing(true);
    try{
      const raw=await callAI(makePrompt2(result,altMajor,subjects,club),3000);
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
          <div style={{fontSize:"10px",color:C.muted}}>카이로스153 · 신지은 · v11.4</div>
        </div>
        <div style={{fontSize:"10px",color:C.muted,textAlign:"right"}}>
          <div>학종 인문{DB_JONG_HUM.length} · 자연{DB_JONG_NAT.length}</div>
          <div>교과 인문{DB_GYOGWA_HUM.length} · 자연{DB_GYOGWA_NAT.length}</div>
        </div>
      </div>

      <div style={{maxWidth:"640px",margin:"0 auto",padding:"16px 14px 60px"}}>
        {phase==="upload"&&(
          <>
            {/* 사전 입력창 (v11.4) */}
            <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"12px",padding:"14px",marginBottom:"12px"}}>
              <div style={{fontWeight:700,fontSize:"12px",color:C.accent,marginBottom:"10px"}}>
                📋 사전 정보 입력 <span style={{color:C.muted,fontWeight:400}}>(선택 — 없어도 분석 가능)</span>
              </div>
              {[
                {key:"지망전공",label:"희망 전공",placeholder:"예: 미디어커뮤니케이션, 생명과학"},
                {key:"subjects",label:"이수 예정 과목",placeholder:"예: 언어와 매체, 확률과 통계"},
                {key:"club",label:"동아리명",placeholder:"예: 방송부, 생명과학 탐구 동아리"},
              ].map(({key,label,placeholder})=>(
                <div key={key} style={{marginBottom:"8px"}}>
                  <div style={{fontSize:"11px",color:C.sub,marginBottom:"3px"}}>{label}</div>
                  <input value={preInput[key]} onChange={e=>setPreInput(p=>({...p,[key]:e.target.value}))}
                    placeholder={placeholder}
                    style={{width:"100%",padding:"7px 10px",border:"1px solid "+C.border,borderRadius:"7px",fontSize:"12px",fontFamily:"inherit",background:C.panel,color:C.text,boxSizing:"border-box"}}/>
                </div>
              ))}
              <div>
                <div style={{fontSize:"11px",color:C.sub,marginBottom:"3px"}}>검토사항 <span style={{color:C.muted}}>(자유 입력)</span></div>
                <textarea value={preInput.memo} onChange={e=>setPreInput(p=>({...p,memo:e.target.value}))}
                  placeholder={"예: 2학년 성적 하락 사유 (코로나 격리)\n부모님은 의대 원하지만 학생 본인은 미디어 희망\n재수 고려 중, 정시도 함께 검토 필요"}
                  rows={3}
                  style={{width:"100%",padding:"7px 10px",border:"1px solid "+C.border,borderRadius:"7px",fontSize:"12px",fontFamily:"inherit",background:C.panel,color:C.text,resize:"vertical",boxSizing:"border-box"}}/>
                <div style={{fontSize:"10px",color:C.muted,marginTop:"3px"}}>※ 학생부 기재 내용 우선. 입력 내용은 참고로만 반영됩니다.</div>
              </div>
            </div>

            {/* 파일 업로드 */}
            <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={drop}
              onClick={()=>fileRef.current?.click()}
              style={{border:"2px dashed "+(drag?C.accent:C.border),borderRadius:"12px",padding:"36px 20px",textAlign:"center",cursor:"pointer",background:drag?C.aLight:C.surface,transition:"all 0.2s",marginBottom:"12px"}}>
              <input ref={fileRef} type="file" accept=".txt" style={{display:"none"}} onChange={e=>e.target.files[0]&&runAnalysis(e.target.files[0])}/>
              <div style={{fontSize:"32px",marginBottom:"8px"}}>{drag?"📂":"📄"}</div>
              <div style={{color:C.text,fontWeight:700,fontSize:"14px",marginBottom:"4px"}}>학생부 TXT 파일 드래그 또는 클릭</div>
              <div style={{color:C.sub,fontSize:"11px",lineHeight:1.7}}>
                나이스플러스 → 인쇄 → PDF저장 → 텍스트복사 → 메모장(.txt) 저장<br/>
                <span style={{color:C.muted}}>최대 30MB · TXT 전용</span>
              </div>
            </div>
            <div style={{background:C.aLight,border:"1px solid "+C.aBorder,borderRadius:"10px",padding:"12px",fontSize:"11px",color:C.accent,lineHeight:1.8,marginBottom:"10px"}}>
              <div style={{fontWeight:700,marginBottom:"3px"}}>v11.4 — AI 역할 최소화 · 조정내신 · 배지 9종 · 전공매칭 29개</div>
              <div>학종: 학업40/진로39/공동체21 · 서류등급→세특점수 코드 계산 · 판정매트릭스</div>
              <div>공동체: 4항목(30/28/22/20) · 정규화+상단압축 · 들쑥날쑥 문제 구조적 해소</div>
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
              <div style={{color:C.sub,fontSize:"11px",lineHeight:1.8}}>나이스플러스: 인쇄→PDF저장→텍스트복사→메모장(.txt)저장<br/>최대 30MB · TXT 전용</div>
            </div>
            <button onClick={reset} style={{padding:"10px 24px",borderRadius:"8px",border:"1px solid "+C.accent,background:C.aLight,color:C.accent,fontSize:"12px",cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>다시 시도하기</button>
          </div>
        )}
      </div>
    </div>
  );
}
