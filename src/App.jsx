import { useState, useRef, useCallback } from "react";

/*
카이로스153 생기부 분석기 v11.4.5  대표 컨설턴트: 신지은
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[v11.4.5 변경사항]
1. detectMajorGroup 개선: 긴 키워드 우선 매칭 ("행정">"법")
2. userKey 반환 + KEY_TO_MAJOR 동적 recMajor (행정→행정학과, 정치→정치외교학과 등)
3. SPECIAL_BAND 갭 기준 주석 추가 (v12 설계용 참고)
4. 입결 DB 출처 명시 주석 (50/70컷=공식, 85컷=추정 혼합·현재 미사용)

[v11.4.4 기반 — 유지]
- AI 역할 최소화: 서류등급(S/A+/A/B+/B/B-) 1개만 출력
- 조정내신: 원내신 ÷ 고교계수 × MAC보정계수
- 공동체역량 4항목 완전 분리 (리더십/봉사나눔/협업소통/성실규칙)
- 역량점수 전부 코드 계산 / 가중치 학업40/진로39/공동체21
- gradeLabel 10단계 / 배지 9종 / 5등급제 환산 / v11.3 파서
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[입결 DB 출처 — 맥에듀테크 2027 수시입결검색기]
- 50%컷(c)·70%컷(c70) = 대학 공식 발표 입결 (5개년 2021~2025)
- 85%컷 = 공식 발표 없을 경우 33만건 합불사례 기반 추정값 혼합
  → 현재 앱은 50/70컷만 사용. 85컷 미사용으로 추정값 영향 없음.
  → v12에서 85컷 활용 시 src_85(공식/추정) 필드 도입 예정.

[SPECIAL_BAND — v12 설계용 갭 기준 참고 (맥에듀테크+내부분석, 결측제거 2024~25)]
※ 현재 앱은 카드별 c70-c50 갭으로 spreadBadge를 동적 계산하므로 미사용.
※ v12 db_univ_type.js 그룹 티어 보정·소신범위 자동조정 설계 시 정본으로 활용.
  그룹밴드                         교과갭   종합갭
  의치약한수(전국)                 0.119    0.128
  간호(수도권)                     0.159    0.190
  간호(지방)                       0.237    0.226
  서연고                           0.104    0.149
  서성한중경외시                   0.123    0.211
  여대(이숙성덕동서)               0.165    0.199
  건동홍숙                         0.139    0.188
  국숭세단                         0.161    0.220
  인서울중하위(광명상가한서삼)     0.220    0.246
  수도권(인하아주가천경기항공인천) 0.205    0.248
  지거국상위(부경충남)             0.222    0.239
  지거국중위(전남전북충북)         0.253    0.261
  강원대(춘천)                     0.240    0.191
  대전권사립+한밭                  0.328    0.357
  ── 캠퍼스 개별 ──                교과갭   종합갭
  한양대(ERICA)                    0.190    0.232
  연세대(미래)                     0.250    0.264
  고려대(세종)                     0.258      -
  한국외대(글로벌)                   -      0.293
  단국대(천안)                     0.243    0.317
  상명대(천안)                     0.275    0.301
  건국대(글로컬)                   0.277    0.324
  동국대(WISE)                     0.287    0.309
  홍익대(세종)                     0.290    0.309
  강릉원주대                       0.358    0.392
  강원대(삼척)                     0.398    0.253
※ 한계: 공주대·전남대(여수)·경북대(상주) 등 국립대 분캠은 본교명 합산 기재로 분리 불가.
  → 어디가·대학알리미 자료로 v12에서 보강 필요.
*/

// ── 여대 목록 ──────────────────────────────────────────────────────
const WOMENS_UNIV = new Set(["이화여대","숙명여대","성신여대","덕성여대","서울여대"]);

// ── 26개 전공 그룹 매핑 ────────────────────────────────────────────
const MAJOR_GROUPS = [
  { id:"media",   label:"미디어·언론·방송",   recMajor:"미디어커뮤니케이션학과",
    keys:["미디어","언론","방송","PD","커뮤니케이션","저널","홍보","콘텐츠","영상","영화","광고","신문방송"],
    matchTerms:["미디어","언론","커뮤니케이션","방송","콘텐츠","영상","영화","홍보","저널","광고","신문방송","미디어콘텐츠"] },
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
    matchTerms:["디자인","예술","미술","패션","콘텐츠디자인"] },
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
  { id:"liberal", label:"자유전공·무전공",       recMajor:"자유전공학부",
    keys:["자유전공","무전공","자유학부","미래융합","자유인문"],
    matchTerms:["자유전공","무전공","자유학부","미래융합","자유인문"] },
  { id:"hum_dept",label:"계열전공(인문)",        recMajor:"인문계열",
    keys:["인문계열","인문학부","인문사회"],
    matchTerms:["인문계열","인문학부","인문사회","문과계열"] },
  { id:"nat_dept",label:"계열전공(자연)",        recMajor:"자연계열",
    keys:["자연계열","자연과학부","이과계열","공학계열"],
    matchTerms:["자연계열","자연과학부","이과계열","공학계열"] },
  { id:"fusion",  label:"계열전공(융합·통합)",   recMajor:"융합계열",
    keys:["융합","통합","학부대학","전인교육"],
    matchTerms:["융합","통합","학부대학","전인교육"] },
];

// ── 특별전형 감지 ─────────────────────────────────────────────
// 지역균형선발은 교과전형이므로 특별전형 아님 (제외)
// 지역인재는 별도 배지 (자격 제한 안내용)
const SPECIAL_TRACK_KW=["농어촌","기회균형","고른기회","사회배려","사회통합","사회기여","특성화고","저소득","장애","보훈","기초생활","특수교육","만학도","재직자","북한","다문화","검정고시","서해5도"];
const LOCAL_TRACK_KW=["지역인재"];
function isSpecialTrack(t){ return t ? SPECIAL_TRACK_KW.some(k=>t.includes(k)) : false; }
function isLocalTrack(t){ return t ? LOCAL_TRACK_KW.some(k=>t.includes(k)) : false; }

// ── 키워드→학과명 매핑 (v11.4.5: 희망전공 단어별 recMajor 동적 결정) ──
const KEY_TO_MAJOR = {
  "행정":"행정학과","정치":"정치외교학과","외교":"정치외교학과",
  "공공":"공공행정학과","법학":"법학과","법":"법학과",
  "경영":"경영학과","경제":"경제학과","회계":"회계학과",
  "마케팅":"마케팅학과","무역":"무역학과","통상":"국제통상학과",
  "금융":"금융학과","재무":"재무학과",
  "심리":"심리학과","상담":"상담학과","사회복지":"사회복지학과","복지":"사회복지학과",
  "교육":"교육학과","사범":"사범계열","교직":"교육학과","교원":"교육학과",
  "국어":"국어국문학과","국문":"국어국문학과","문학":"문학과","어문":"어문학부","한국어":"한국어학과",
  "사학":"사학과","역사":"역사학과","문화재":"문화재학과","고고":"고고학과",
  "철학":"철학과","윤리":"윤리학과",
  "관광":"관광학과","호텔":"호텔경영학과","외식":"외식경영학과","여행":"관광학과",
  "디자인":"디자인학과","예술":"예술학과","미술":"미술학과","시각":"시각디자인학과","패션":"패션디자인학과",
  "체육":"체육학과","스포츠":"스포츠학과",
  "컴퓨터":"컴퓨터공학과","소프트웨어":"소프트웨어학과","SW":"소프트웨어학과","프로그래밍":"소프트웨어학과",
  "AI":"인공지능학과","인공지능":"인공지능학과","데이터":"데이터사이언스학과","빅데이터":"빅데이터학과","머신러닝":"인공지능학과",
  "전기":"전기공학과","전자":"전자공학과","반도체":"반도체공학과","회로":"전자공학과","통신공학":"정보통신공학과",
  "기계":"기계공학과","항공":"항공우주공학과","우주":"항공우주공학과","로봇":"로봇공학과","자동차":"자동차공학과",
  "건축":"건축학과","토목":"토목공학과","도시":"도시공학과","환경":"환경공학과","도시계획":"도시계획학과",
  "생명":"생명공학과","바이오":"바이오공학과","생물":"생물학과","식품":"식품공학과",
  "화학":"화학과","신소재":"신소재공학과","재료":"재료공학과","고분자":"고분자공학과","화공":"화학공학과",
  "수학":"수학과","통계":"통계학과","수리":"수학과","보험수리":"보험수리학과",
  "의학":"의예과","의예":"의예과","치의":"치의학과","약학":"약학과","한의":"한의예과",
  "간호":"간호학과","보건":"보건학과","재활":"재활학과","물리치료":"물리치료학과",
  "미디어":"미디어커뮤니케이션학과","언론":"언론정보학과","방송":"방송학과","PD":"방송학과",
  "커뮤니케이션":"미디어커뮤니케이션학과","저널":"저널리즘학과","홍보":"광고홍보학과",
  "콘텐츠":"콘텐츠학과","영상":"영상학과","영화":"영화학과","광고":"광고학과","신문방송":"신문방송학과",
  "사회학":"사회학과","사회과학":"사회과학부","사회":"사회학과",
};

function detectMajorGroup(t) {
  if (!t) return null;
  for (const g of MAJOR_GROUPS) {
    // 긴 키워드 우선 매칭 ("행정"(2)>"법"(1), "법학"(2)>"법"(1)) → 희망전공 단어 보존
    const sorted = [...g.keys].sort((a,b) => b.length - a.length);
    const hit = sorted.find(k => t.includes(k));
    if (hit) {
      // userKey로 recMajor 동적 결정 (행정→행정학과, 정치→정치외교학과, 법→법학과)
      const recMajor = KEY_TO_MAJOR[hit] || g.recMajor;
      return { ...g, userKey: hit, recMajor };
    }
  }
  return null;
}
function isMajorMatch(m, matchTerms) {
  return matchTerms ? matchTerms.some(t => m && m.includes(t)) : false;
}

// ── 전형명 정규화 ─────────────────────────────────────────────────
function normalizeT(t){
  if(!t) return "";
  return t.replace(/전형$/,"").replace(/형$/,"")
    .replace(/\(서류\)|\(면접\)/,"").replace(/선발$/,"")
    .replace(/인재$/,"").trim();
}

// ── 서류평가 비율 DB ──────────────────────────────────────────────
const EVAL_WEIGHT=[
  {u:"가톨릭대",t:"잠재능력우수자",academic:40,career:35,community:25},
  {u:"경희대",  t:"네오르네상스",  academic:40,career:40,community:20},
  {u:"고려대",  t:"학업우수",      academic:50,career:30,community:20,note:"자기계발역량30"},
  {u:"고려대",  t:"계열적합",      academic:40,career:40,community:20,note:"자기계발역량40"},
  {u:"동덕여대",t:"동덕창의리더",  academic:35,career:40,community:25},
  {u:"성균관대",t:"융합",          academic:40,career:40,community:20,note:"탐구역량40"},
  {u:"성균관대",t:"탐구",          academic:40,career:40,community:20,note:"탐구역량40"},
  {u:"성신여대",t:"자기주도인재",  academic:30,career:50,community:20},
  {u:"서강대",  t:"일반Ⅰ",        academic:50,career:30,community:20,note:"성장역량30"},
  {u:"서강대",  t:"일반Ⅱ",        academic:50,career:30,community:20,note:"성장역량30"},
];
function getEvalWeight(u,t){
  if(!u||!t) return null;
  const tN=normalizeT(t);
  return EVAL_WEIGHT.find(e=>u.includes(e.u)&&tN.includes(e.t))||null;
}

// ── 등급제 자동 판별 ──────────────────────────────────────────────
function detectGradeSystem(text){
  const m=text.match(/(\d{4})년.*?제1학년\s*입학/);
  if(m){const year=parseInt(m[1]);return{system:year<=2024?"9등급":"5등급",year};}
  return{system:"9등급",year:null};
}

// ── 5등급제→9등급제 환산표 (맥에듀테크 배포본 기반) ─────────────
// 기본: 부산교육청(이론형, 전구간, 9등급 입결DB 연동용)
// 참고: 광주진협(고2 전과목 실측·보수적) / 대진대(이론·관대)
// 0.1 간격 표, 사이값은 선형보간
const G5TO9 = {
  base:  {1.0:1.00,1.1:1.18,1.2:1.36,1.3:1.54,1.4:1.72,1.5:1.90,1.6:2.07,1.7:2.25,1.8:2.43,1.9:2.61,2.0:2.79,2.1:2.97,2.2:3.15,2.3:3.33,2.4:3.51,2.5:3.69,2.6:3.86,2.7:4.04,2.8:4.22,2.9:4.40,3.0:4.58,3.1:4.76,3.2:4.94,3.3:5.12,3.4:5.30,3.5:5.48,3.6:5.65,3.7:5.83,3.8:6.01,3.9:6.19,4.0:6.37,4.1:6.55,4.2:6.73,4.3:6.91,4.4:7.09,4.5:7.27,4.6:7.45,4.7:7.63,4.8:7.81,4.9:7.99,5.0:8.17},
  strict:{1.0:1.25,1.1:1.45,1.2:1.62,1.3:1.77,1.4:1.91,1.5:2.06,1.6:2.21,1.7:2.37,1.8:2.53,1.9:2.69,2.0:2.86,2.1:3.03,2.2:3.20,2.3:3.38,2.4:3.56,2.5:3.75,2.6:3.94,2.7:4.13,2.8:4.33,2.9:4.54,3.0:4.75,3.1:4.96,3.2:5.18,3.3:5.41,3.4:5.64,3.5:5.87,3.6:6.11,3.7:6.35,3.8:6.60,3.9:6.85,4.0:7.11,4.1:7.37,4.2:7.64,4.3:7.91,4.4:8.19,4.5:8.47,4.6:8.75},
  loose: {1.0:1.18,1.1:1.34,1.2:1.49,1.3:1.65,1.4:1.80,1.5:1.95,1.6:2.11,1.7:2.26,1.8:2.41,1.9:2.56,2.0:2.71,2.1:2.87,2.2:3.02,2.3:3.17,2.4:3.32,2.5:3.48,2.6:3.63,2.7:3.78,2.8:3.93,2.9:4.09,3.0:4.24,3.1:4.39,3.2:4.54,3.3:4.69,3.4:4.85,3.5:5.00,3.6:5.15,3.7:5.30,3.8:5.45,3.9:5.60,4.0:5.76,4.1:5.91,4.2:6.06,4.3:6.21,4.4:6.36,4.5:6.51,4.6:6.66,4.7:6.81,4.8:6.97,4.9:7.12,5.0:7.27},
};

// 5등급 값 → 9등급 환산 (선형보간, kind: base/strict/loose)
function conv5to9(g5, kind){
  const T = G5TO9[kind||"base"];
  const v = Math.min(5.0, Math.max(1.0, g5));
  const lo = Math.floor(v*10)/10, hi = Math.round((lo+0.1)*10)/10;
  const a = T[lo.toFixed(1)*1] ?? T[lo], b = T[hi.toFixed(1)*1] ?? T[hi];
  if(a==null) return null;               // 표 범위 밖 (strict 4.6 초과 등)
  if(b==null || hi>5.0 || v===lo) return Math.round(a*100)/100;
  const r = (v-lo)/0.1;
  return Math.round((a + (b-a)*r)*100)/100;
}

// ── 과목군별 평균 계산 ────────────────────────────────────────────
const GYOGWA_MAP={
  국어:["국어","문학","독서","화법","언어","매체"],
  수학:["수학","미적분","확률","통계","기하","수학Ⅰ","수학Ⅱ"],
  영어:["영어","영어Ⅰ","영어Ⅱ","영어독해","영어회화"],
  사회:["사회","역사","지리","윤리","경제","정치","법","한국사","세계사","사회문화"],
  과학:["과학","물리","화학","생명","지구","생물"],
};
function isInGroup(subjectName,gyogwa){
  return GYOGWA_MAP[gyogwa]?.some(k=>subjectName.includes(k))||false;
}
function calcSubjectGroups(subjects){
  const calc=(arr)=>{
    const tu=arr.reduce((s,r)=>s+r.unit,0);
    if(!tu) return null;
    return Math.round(arr.reduce((s,r)=>s+r.unit*r.grade,0)/tu*100)/100;
  };
  return{
    전과목:calc(subjects),
    국영수사과:calc(subjects.filter(s=>["국어","영어","수학","사회","과학"].some(g=>isInGroup(s.subject||"",g)))),
    국영수사:calc(subjects.filter(s=>["국어","영어","수학","사회"].some(g=>isInGroup(s.subject||"",g)))),
    국영수과:calc(subjects.filter(s=>["국어","영어","수학","과학"].some(g=>isInGroup(s.subject||"",g)))),
  };
}
function calcTopN(subjects,n){
  const sorted=[...subjects].sort((a,b)=>a.grade-b.grade).slice(0,n);
  const tu=sorted.reduce((s,r)=>s+r.unit,0);
  if(!tu) return null;
  return Math.round(sorted.reduce((s,r)=>s+r.unit*r.grade,0)/tu*100)/100;
}
function calcCustom(subjects,selectedIds){
  const arr=subjects.filter((_,i)=>selectedIds.includes(i));
  const tu=arr.reduce((s,r)=>s+r.unit,0);
  if(!tu) return null;
  return Math.round(arr.reduce((s,r)=>s+r.unit*r.grade,0)/tu*100)/100;
}
function calcGyogwaGroup(subjects,groups){
  const arr=subjects.filter(s=>groups.some(g=>isInGroup(s.subject||"",g)));
  const tu=arr.reduce((s,r)=>s+r.unit,0);
  if(!tu) return null;
  return Math.round(arr.reduce((s,r)=>s+r.unit*r.grade,0)/tu*100)/100;
}

// ── 내신 파싱 (v11.3 파서 유지) ─────────────────────────────────
function parseGradesFromText(text, gradeSystemOverride){
  const detected = detectGradeSystem(text);
  const gradeSystem = gradeSystemOverride || detected.system;
  const is5 = gradeSystem === "5등급";
  const maxG = is5 ? 5 : 9;

  const sectionIdx = text.indexOf("7. 교과학습발달상황");
  const target = sectionIdx >= 0 ? text.slice(sectionIdx) : text;
  const lines = target.split(/\n/).map(l=>l.trim()).filter(l=>l.length>0);

  const subjects = [];
  let currentSem = "";
  let currentYear = "1";

  for(let i=0; i<lines.length; i++){
    const line = lines[i];
    if(/^[123]학년$/.test(line)){ currentYear = line[0]; continue; }
    if(/^[12]$/.test(line) && i+1<lines.length && !/^\d+$/.test(lines[i+1])){
      currentSem = line; continue;
    }
    const am = line.match(/^([A-E])\((\d+)\)$/);
    if(am){
      const achieve = am[1];
      if(achieve === "P") continue;
      if(i+1 >= lines.length) continue;
      const gradeStr = lines[i+1];
      if(!/^\d+(\.\d+)?$/.test(gradeStr)) continue;
      const grade = parseFloat(gradeStr);
      if(grade < 1 || grade > maxG) continue;
      let unit = null;
      let subject = "";
      for(let j=i-1; j>=Math.max(0,i-6); j--){
        if(/^[1-8]$/.test(lines[j])){
          unit = parseInt(lines[j]);
          if(j-1>=0 && !/^[12]$/.test(lines[j-1]) && !/^[1-8]$/.test(lines[j-1])){
            subject = lines[j-1];
          }
          break;
        }
      }
      if(!unit) continue;
      subjects.push({ sem: currentSem, semLabel: currentYear+"-"+currentSem, subject, unit, achieve, grade, manual: false });
      i++;
    }
  }

  if(subjects.length < 3) return null;

  const aCount = subjects.filter(s=>s.achieve==="A").length;
  const aRatio = Math.round(aCount/subjects.length*100)/100;
  const achieveBonus = aRatio>=0.6?-0.2:aRatio>=0.4?-0.1:0;
  const totalUnits = subjects.reduce((s,r)=>s+r.unit,0);
  const rawAvg = Math.round(subjects.reduce((s,r)=>s+r.unit*r.grade,0)/totalUnits*100)/100;
  const byGroup = calcSubjectGroups(subjects);

  const semGroups = {};
  subjects.forEach(s=>{ const key = s.semLabel || s.sem; if(!semGroups[key]) semGroups[key] = []; semGroups[key].push(s); });
  const semKeys = Object.keys(semGroups);
  const semTrend = semKeys.map(k=>{ const grp = semGroups[k]; const tu = grp.reduce((s,r)=>s+r.unit,0); const av = tu ? Math.round(grp.reduce((s,r)=>s+r.unit*r.grade,0)/tu*100)/100 : null; return av ? k+")"+av : null; }).filter(Boolean).join("→");

  return {
    rawAvg, achieveBonus,
    avg: Math.round((rawAvg+achieveBonus)*100)/100,
    gradeSystem, admitYear: detected.year,
    subjects, aCount, aRatio, byGroup, semTrend,
    confidence: subjects.length>=10?0.92:subjects.length>=5?0.80:0.65,
    manualCount: 0, is5,
  };
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

// ── ParsingPhase ──────────────────────────────────────────────────
function ParsingPhase({text,onConfirm}){
  const detected=detectGradeSystem(text);
  const[gsOverride,setGsOverride]=useState(null);
  const gradeSystem=gsOverride||detected.system;
  const parsed=parseGradesFromText(text,gradeSystem);
  const[subjects,setSubjects]=useState(()=>parsed?.subjects||[]);
  const[editIdx,setEditIdx]=useState(null);
  const[editVal,setEditVal]=useState("");
  const[calcMode,setCalcMode]=useState("전과목");
  const[topN,setTopN]=useState(5);
  const[selGyogwa,setSelGyogwa]=useState(["국어","수학","영어"]);
  const[selSubjects,setSelSubjects]=useState([]);
  const[manualCount,setManualCount]=useState(0);

  if(!parsed){
    return(
      <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"12px",padding:"20px"}}>
        <div style={{color:C.rose,fontWeight:700,marginBottom:8}}>⚠️ 내신 자동 파싱 실패</div>
        <div style={{fontSize:"12px",color:C.sub,marginBottom:16}}>파싱 가능한 교과학습발달상황 섹션을 찾지 못했습니다.<br/>수동 입력으로 진행하거나 다른 파일을 시도하세요.</div>
        <button onClick={()=>onConfirm(null,text)} style={{width:"100%",padding:"10px",background:C.accent,border:"none",borderRadius:"8px",color:"white",fontWeight:700,fontSize:"13px",cursor:"pointer",fontFamily:"inherit"}}>
          수동 입력으로 계속
        </button>
      </div>
    );
  }

  const getAvg=()=>{
    if(!subjects.length) return null;
    if(calcMode==="상위N") return calcTopN(subjects,Math.min(topN,subjects.length));
    if(calcMode==="교과군") return calcGyogwaGroup(subjects,selGyogwa);
    if(calcMode==="직접선택") return selSubjects.length>0?calcCustom(subjects,selSubjects):null;
    const byGroup=calcSubjectGroups(subjects);
    return byGroup[calcMode]||byGroup["전과목"];
  };
  const selectedAvg=getAvg();
  const byGroup=calcSubjectGroups(subjects);
  const aCount=subjects.filter(s=>s.achieve==="A").length;
  const aRatio=subjects.length>0?Math.round(aCount/subjects.length*100):0;
  const achieveBonus=aRatio/100>=0.6?-0.2:aRatio/100>=0.4?-0.1:0;
  const confidence=subjects.length>=10?92:subjects.length>=5?80:65;
  const confDisplay=manualCount>0?Math.min(95,confidence+7):confidence;

  const startEdit=(i)=>{setEditIdx(i);setEditVal(String(subjects[i].grade));};
  const saveEdit=()=>{
    const v=parseFloat(editVal);
    const maxG=gradeSystem==="5등급"?5:9;
    if(!isNaN(v)&&v>=1&&v<=maxG){
      setSubjects(prev=>prev.map((s,i)=>i===editIdx?{...s,grade:v,manual:true}:s));
      setManualCount(c=>c+1);
    }
    setEditIdx(null);
  };
  const handleConfirm=()=>{
    onConfirm({
      gradeSystem, selectedKey:calcMode,
      selectedAvg:selectedAvg?.toFixed(2)||parsed.rawAvg.toFixed(2),
      byGroup, achieveBonus, aCount, subjects,
      semTrend:parsed.semTrend||"",
    },text);
  };

  return(
    <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"12px",padding:"16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
        <div style={{fontSize:"13px",fontWeight:700,color:C.text}}>📊 내신 파싱 결과 확인</div>
        <div style={{fontSize:"10px",color:C.muted}}>신뢰도 {confDisplay}% {manualCount>0?"("+manualCount+"과목 수동)":""}</div>
      </div>
      <div style={{marginBottom:12,padding:"8px 10px",background:C.panel,borderRadius:"8px"}}>
        <div style={{fontSize:"11px",color:C.sub,marginBottom:4}}>등급제</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[[null,"자동감지 ("+detected.system+"·"+(detected.year||"연도미확인")+")"],["9등급","9등급 (2024년 이하/재수)"],["5등급","5등급 (2025년 이상)"]].map(([val,label])=>(
            <button key={String(val)} onClick={()=>setGsOverride(val)}
              style={{padding:"4px 10px",borderRadius:"20px",fontSize:"11px",cursor:"pointer",fontFamily:"inherit",
                background:gsOverride===val?C.accent:C.panel,color:gsOverride===val?"white":C.sub,
                border:"1px solid "+(gsOverride===val?C.accent:C.border)}}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div style={{overflowX:"auto",marginBottom:12}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"11px"}}>
          <thead>
            <tr style={{background:C.panel}}>
              {["학기","과목","학점","성취","등급","수정"].map(h=>(
                <th key={h} style={{padding:"4px 6px",textAlign:"left",border:"1px solid "+C.border,fontWeight:600,color:C.sub}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((s,i)=>(
              <tr key={i} style={{background:s.manual?"#fefce8":"white"}}>
                <td style={{padding:"3px 6px",border:"1px solid "+C.border,color:C.muted}}>{s.sem||"-"}</td>
                <td style={{padding:"3px 6px",border:"1px solid "+C.border}}>{s.subject||"과목"+(i+1)}</td>
                <td style={{padding:"3px 6px",border:"1px solid "+C.border,textAlign:"center"}}>{s.unit}</td>
                <td style={{padding:"3px 6px",border:"1px solid "+C.border,textAlign:"center",color:s.achieve==="A"?C.green:C.sub}}>{s.achieve}</td>
                <td style={{padding:"3px 6px",border:"1px solid "+C.border,textAlign:"center",fontWeight:700,color:C.accent}}>
                  {editIdx===i?(
                    <input type="number" value={editVal} onChange={e=>setEditVal(e.target.value)}
                      onBlur={saveEdit} onKeyDown={e=>e.key==="Enter"&&saveEdit()}
                      step="0.01" min="1" max={gradeSystem==="5등급"?5:9} autoFocus
                      style={{width:"52px",padding:"2px 4px",border:"1px solid "+C.accent,borderRadius:"4px",fontSize:"11px",fontFamily:"inherit"}}/>
                  ):s.grade.toFixed(2)}
                </td>
                <td style={{padding:"3px 6px",border:"1px solid "+C.border,textAlign:"center"}}>
                  <button onClick={()=>startEdit(i)}
                    style={{padding:"2px 6px",fontSize:"10px",cursor:"pointer",fontFamily:"inherit",background:C.aLight,border:"1px solid "+C.aBorder,borderRadius:"4px",color:C.accent}}>✏️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:"11px",color:C.sub,marginBottom:6}}>계산 기준</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
          {["전과목","국영수사과","국영수사","국영수과"].map(k=>(
            <button key={k} onClick={()=>setCalcMode(k)}
              style={{padding:"4px 9px",borderRadius:"20px",fontSize:"11px",cursor:"pointer",fontFamily:"inherit",
                background:calcMode===k?C.accent:C.panel,color:calcMode===k?"white":C.sub,
                border:"1px solid "+(calcMode===k?C.accent:C.border)}}>
              {k}{byGroup[k]?" ("+byGroup[k].toFixed(2)+")":""}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
          {["상위N","교과군","직접선택"].map(k=>(
            <button key={k} onClick={()=>setCalcMode(k)}
              style={{padding:"4px 9px",borderRadius:"20px",fontSize:"11px",cursor:"pointer",fontFamily:"inherit",
                background:calcMode===k?C.accent:C.panel,color:calcMode===k?"white":C.sub,
                border:"1px solid "+(calcMode===k?C.accent:C.border)}}>
              {k==="직접선택"?"✏️ "+k:k}
            </button>
          ))}
        </div>
        {calcMode==="상위N"&&(
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontSize:"11px",color:C.sub}}>상위</span>
            {[3,4,5,6,10].map(n=>(
              <button key={n} onClick={()=>setTopN(n)}
                style={{padding:"3px 8px",borderRadius:"20px",fontSize:"11px",cursor:"pointer",fontFamily:"inherit",
                  background:topN===n?C.accent:C.panel,color:topN===n?"white":C.sub,
                  border:"1px solid "+(topN===n?C.accent:C.border)}}>
                {n}과목
              </button>
            ))}
            <span style={{fontSize:"11px",color:C.muted}}>{calcTopN(subjects,Math.min(topN,subjects.length))?.toFixed(2)||"–"}</span>
          </div>
        )}
        {calcMode==="교과군"&&(
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
            {["국어","수학","영어","사회","과학"].map(g=>(
              <button key={g} onClick={()=>setSelGyogwa(prev=>prev.includes(g)?prev.filter(x=>x!==g):[...prev,g])}
                style={{padding:"4px 9px",borderRadius:"20px",fontSize:"11px",cursor:"pointer",fontFamily:"inherit",
                  background:selGyogwa.includes(g)?C.green:C.panel,color:selGyogwa.includes(g)?"white":C.sub,
                  border:"1px solid "+(selGyogwa.includes(g)?C.green:C.border)}}>
                {g}{selGyogwa.includes(g)?" ✓":""}
              </button>
            ))}
            <span style={{fontSize:"11px",color:C.muted,alignSelf:"center"}}>{calcGyogwaGroup(subjects,selGyogwa)?.toFixed(2)||"–"}</span>
          </div>
        )}
        {calcMode==="직접선택"&&(
          <div style={{maxHeight:"120px",overflowY:"auto",border:"1px solid "+C.border,borderRadius:"8px",padding:"8px",marginBottom:6}}>
            {subjects.map((s,i)=>(
              <label key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,cursor:"pointer",fontSize:"11px"}}>
                <input type="checkbox" checked={selSubjects.includes(i)} onChange={()=>setSelSubjects(prev=>prev.includes(i)?prev.filter(x=>x!==i):[...prev,i])}/>
                {s.subject||"과목"+(i+1)} ({s.grade.toFixed(2)})
              </label>
            ))}
            <div style={{fontSize:"10px",color:C.muted,marginTop:4}}>선택 평균: {selSubjects.length>0?calcCustom(subjects,selSubjects)?.toFixed(2)||"–":"–"}</div>
          </div>
        )}
      </div>
      <div style={{background:C.panel,borderRadius:"8px",padding:"10px 12px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:"12px",fontWeight:700,color:C.text}}>
            적용 등급 ({calcMode}): <span style={{color:C.accent,fontSize:"15px"}}>{selectedAvg?.toFixed(2)||"–"}</span>
          </span>
          <span style={{fontSize:"10px",color:C.muted}}>성취도 A: {aRatio}% → 보정 {achieveBonus}</span>
        </div>
        <div style={{fontSize:"10px",color:C.sub,lineHeight:1.8}}>
          전과목 {byGroup.전과목?.toFixed(2)||"–"} | 국영수사과 {byGroup.국영수사과?.toFixed(2)||"–"} | 국영수사 {byGroup.국영수사?.toFixed(2)||"–"} | 국영수과 {byGroup.국영수과?.toFixed(2)||"–"}
        </div>
      </div>
      <button onClick={handleConfirm}
        style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#2563eb,#1d4ed8)",border:"none",borderRadius:"8px",color:"white",fontSize:"14px",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
        ✅ 이 등급으로 분석 시작 ({selectedAvg?.toFixed(2)||"–"}등급 · {calcMode})
      </button>
    </div>
  );
}

// ── 고교유형 감지 6종 ─────────────────────────────────────────────
function detectSchoolType(text){
  if(["영재학교","영재고","과학영재"].some(k=>text.includes(k))) return "영재고";
  if(["과학고"].some(k=>text.includes(k))) return "과학고";
  if(["외국어고","국제고","외고"].some(k=>text.includes(k))) return "외고국제";
  if(["민족사관","하나고","상산고","현대청운","포항제철","전국단위자사고"].some(k=>text.includes(k))) return "전국자사";
  if(["자율형사립고","자사고","광역자사"].some(k=>text.includes(k))) return "광역자사";
  return "일반고";
}

// ── v11.4 상수 및 계산 함수 ──────────────────────────────────────
const SCHOOL_TYPE_COEFF = {
  "일반고":1.00,"광역자사":1.25,"전국자사":1.70,
  "외고국제":1.35,"과학고":1.55,"영재고":1.90,
};
const MAC_COEFF = {
  1:{"S":0.93,"A+":0.94,"A":0.95,"B+":0.96,"B":0.97,"B-":0.98},
  2:{"S":0.88,"A+":0.90,"A":0.92,"B+":0.93,"B":0.95,"B-":0.96},
  3:{"S":0.84,"A+":0.87,"A":0.89,"B+":0.91,"B":0.93,"B-":0.94},
  4:{"S":0.81,"A+":0.84,"A":0.86,"B+":0.88,"B":0.91,"B-":0.92},
  5:{"S":0.79,"A+":0.82,"A":0.84,"B+":0.86,"B":0.89,"B-":0.90},
  6:{"S":0.77,"A+":0.80,"A":0.82,"B+":0.84,"B":0.87,"B-":0.88},
};
const GRADE_SCORE = [
  [1.0,100],[1.5,93],[1.8,90],[2.1,87],[2.4,84],[2.7,81],
  [3.0,78],[3.3,75],[3.6,72],[3.9,69],[4.2,66],[4.5,63],
  [4.8,60],[5.1,57],[5.4,54],[5.9,49],[6.4,44],[6.9,39],
];
const SEBU_SCORE = {"S":100,"A+":94,"A":90,"B+":86,"B":82,"B-":78};
const COMM_LEADERSHIP = {"임원+리더":30,"임원or리더":24,"역할있음":18,"없음":12};
const COMM_BONGSA     = {"지속적":22,"꾸준":17,"간헐적":12,"미흡":5};
const COMM_HYEOBUP    = {"리더적":28,"적극":22,"참여":16,"미흡":8};
const COMM_SEONGSHIL  = {"정상":20,"미인정소수":14,"미인정다수":6,"학폭조치":0};
const CAREER_BONUS    = {"완전일관":0,"유관일관":0,"부분일관":-10,"불일관":-20};
const PARSE_DEFAULTS  = {
  docGrade:"B",leadership:"역할있음",bongsa:"간헐적",
  hyeobup:"참여",seongshil:"정상",careerConsist:"유관일관",
};

function getMacCoeffInterp(보정grade, docGrade){
  const tier=Math.floor(보정grade), frac=보정grade-tier;
  const c1=MAC_COEFF[Math.min(6,Math.max(1,tier))]?.[docGrade]??0.90;
  const c2=MAC_COEFF[Math.min(6,Math.max(1,tier+1))]?.[docGrade]??0.90;
  return c1+frac*(c2-c1);
}
function calcAdjGrade(grade9, schoolType, docGrade){
  const coeff=SCHOOL_TYPE_COEFF[schoolType]??1.00;
  const 보정=grade9/coeff;
  return Number((보정*getMacCoeffInterp(보정,docGrade)).toFixed(2));
}
function adjToScore(adj){
  const a=Number(adj.toFixed(2)), pts=GRADE_SCORE;
  if(a<=pts[0][0]) return pts[0][1];
  if(a>=pts[pts.length-1][0]) return pts[pts.length-1][1];
  for(let i=0;i<pts.length-1;i++){
    const [lo,sLo]=pts[i],[hi,sHi]=pts[i+1];
    if(a>=lo&&a<=hi) return Math.round(sLo+(a-lo)/(hi-lo)*(sHi-sLo));
  }
  return 39;
}
function getSpreadBadge(갭){
  return 갭>=0.30?"🔵":갭>=0.18?"🟡":"🔴";
}
function getVerdict(tier, strength){
  const m={안정:{강:"합격유력",중:"합격유력",약:"가능"},적정:{강:"합격유력",중:"가능",약:"신중"},소신:{강:"가능",중:"신중",약:"비추"},상향:{강:"신중",중:"비추",약:"비추"}};
  return m[tier]?.[strength]??"-";
}
function calcCommunityFinal(c){
  const n=(c-25)/75*100;
  return n>=85?85+(n-85)*0.3:n;
}
function getStrength(n){ return n>=75?"강":n>=60?"중":"약"; }
function calcScoresV114(adjGrade, docGrade, careerConsist, leadership, bongsa, hyeobup, seongshil, spreadBadge){
  const gs=adjToScore(adjGrade), ss=SEBU_SCORE[docGrade]??82;
  const [wn,ws]=spreadBadge==="🔵"?[0.30,0.70]:spreadBadge==="🟡"?[0.45,0.55]:[0.60,0.40];
  const 학업=Math.round(gs*wn+ss*ws);
  const 진로=Math.max(0,ss+(CAREER_BONUS[careerConsist]??-10));
  const commRaw=(COMM_LEADERSHIP[leadership]??18)+(COMM_BONGSA[bongsa]??12)+(COMM_HYEOBUP[hyeobup]??16)+(COMM_SEONGSHIL[seongshil]??20);
  const 공동체=calcCommunityFinal(commRaw);
  return{학업,진로,공동체:Math.round(공동체),commRaw};
}
function calcTotal(scores){
  return Math.round(scores.학업*0.40+scores.진로*0.39+scores.공동체*0.21);
}
function calcJongTierAdj(adjGrade, c50, c70){
  if(c70<c50){[c50,c70]=[c70,c50];}
  const gap=Math.max(c70-c50,0.10);
  if(adjGrade<=c50-gap) return"안정";
  if(adjGrade<=c50) return"적정";
  if(adjGrade<=c70) return"소신";
  if(adjGrade<=c70+gap) return"상향";
  return"제외";
}
function gradeLabel(n){
  if(n>=88)return"S";if(n>=80)return"A+";if(n>=72)return"A";
  if(n>=63)return"A-";if(n>=53)return"B+";if(n>=43)return"B";
  if(n>=32)return"B-";if(n>=21)return"C+";if(n>=10)return"C";
  return"D";
}

// ── 평가 기준표 (v11.4 미사용 — 구버전 호환 보존, v12에서 제거 예정) ─
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

// ── DB import ──────────────────────────────────────────────────────
import { DB_JONG_HUM }       from "./db_jong_hum.js";
import { DB_JONG_NAT }       from "./db_jong_nat.js";
import { DB_GYOGWA_HUM }     from "./db_gyogwa_hum.js";
import { DB_GYOGWA_NAT }     from "./db_gyogwa_nat.js";
import { SCHOOL_TYPE_RATIO } from "./db_school_type.js";

function getJongDB(gyeyeol){ return gyeyeol==="자연공학" ? DB_JONG_NAT : DB_JONG_HUM; }
function getGyogwaDB(gyeyeol){ return gyeyeol==="자연공학" ? DB_GYOGWA_NAT : DB_GYOGWA_HUM; }

// ── nGap Tier 상수 ────────────────────────────────────────────────
const SPREAD_MIN = 0.15;
const TIER_THRESHOLD = { 안정:-0.3, 적정:0.3, 소신:0.7, 상향:1.2 };
const C50_RANGE = 1.5;

// ── 티어 색상 ──────────────────────────────────────────────────────
const TC={안정:"#15803d",적정:"#1d4ed8",소신:"#92400e",상향:"#6d28d9"};
const TB={안정:"#f0fdf4",적정:"#eff6ff",소신:"#fefce8",상향:"#f5f3ff"};

function calcNGap(grade, c, c70){
  const spread = Math.max(c70 - c, SPREAD_MIN);
  return (grade - c) / spread;
}
function calcJongTier(grade, c, c70){
  const ng = calcNGap(parseFloat(grade), c, c70);
  if(ng <= TIER_THRESHOLD.안정) return "안정";
  if(ng <= TIER_THRESHOLD.적정) return "적정";
  if(ng <= TIER_THRESHOLD.소신) return "소신";
  if(ng <= TIER_THRESHOLD.상향) return "상향";
  return "제외";
}
function calcGyogwaTier(grade, c, c70){
  const ng = calcNGap(parseFloat(grade), c, c70);
  if(ng <= TIER_THRESHOLD.안정) return "안정";
  if(ng <= TIER_THRESHOLD.적정) return "적정";
  if(ng <= TIER_THRESHOLD.소신) return "소신";
  if(ng <= TIER_THRESHOLD.상향) return "상향";
  return "제외";
}

function getBaseUniv(u){
  return u.replace(/\(서울\)|\(죽전\)|\(에리카\)|\(글로컬\)|\(WISE\)|\(세종\)|\(원주\)|\(안성\)|\(글로벌\)|\(천안\)|\(의정부\)|\(성남\)|\(다빈치\)/g,'').trim();
}

function calcJongPoss(grade, sebu, c, c70){
  const g=parseFloat(grade);
  if(!isFinite(g)||!c) return 1;
  const diff=g-c;
  let ns;
  if(diff<=-0.3) ns=5; else if(diff<=0.3) ns=4; else if(diff<=0.8) ns=3;
  else if(diff<=1.3) ns=2; else ns=1;
  const sm={"S":5,"A+":5,"A":4,"B+":3,"B":3,"B-":2};
  let base=ns*0.4+(sm[sebu]||3)*0.6;
  if(g>c70+0.3) base=Math.min(base,3);
  return Math.min(10,Math.max(1,Math.round(base)));
}

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

function buildJongRecs(grade, docGrade, schoolType, gyeyeol, gender, majorGroup, strength){
  const db = getJongDB(gyeyeol);
  const g = parseFloat(grade); // ✅ 컷 비교는 원내신 기준 (발표 입결이 원내신이므로)
  const adjGrade = calcAdjGrade(g, schoolType||"일반고", docGrade||"B"); // 참고 표시용
  const filtered = db.filter(r=>
    !(gender==="남"&&WOMENS_UNIV.has(r.u)) &&
    r.c >= g - C50_RANGE && r.c <= g + C50_RANGE
  );
  const scored = filtered.map(r=>{
    const tier = calcJongTierAdj(g, r.c, r.c70);
    if(tier==="제외") return null;
    const gap = r.c70 - r.c;
    const spreadBadge = getSpreadBadge(gap);
    const verdict = getVerdict(tier, strength||"중");
    const majorMatch = majorGroup ? isMajorMatch(r.m, majorGroup.matchTerms) : false;
    const wishMatch = majorGroup?.userKey ? (r.m||"").includes(majorGroup.userKey) : false;
    const poss = calcJongPoss(g, docGrade||"B", r.c, r.c70);
    const ew = getEvalWeight(r.u, r.t);
    return {...r, tier, adjGrade, diff: g-r.c, majorMatch, wishMatch, poss, spreadBadge, verdict, ew};
  }).filter(Boolean);

  const byUni={};
  for(const r of scored){
    const key=getBaseUniv(r.u);
    const p=byUni[key];
    if(!p){byUni[key]=r;continue;}
    const w=(r.wishMatch&&!p.wishMatch)||
      (r.wishMatch===p.wishMatch&&r.majorMatch&&!p.majorMatch)||
      (r.wishMatch===p.wishMatch&&r.majorMatch===p.majorMatch&&r.poss>p.poss)||
      (r.wishMatch===p.wishMatch&&r.majorMatch===p.majorMatch&&r.poss===p.poss&&Math.abs(r.diff)<Math.abs(p.diff));
    if(w) byUni[key]=r;
  }
  const to={안정:0,적정:1,소신:2,상향:3};
  const display = majorGroup ? Object.values(byUni).filter(r=>r.majorMatch) : Object.values(byUni);
  const all = display.sort((a,b)=>(to[a.tier]||3)-(to[b.tier]||3)||(b.wishMatch?1:0)-(a.wishMatch?1:0)||b.poss-a.poss||a.c-b.c);
  return {
    안정:all.filter(r=>r.tier==="안정").slice(0,10),
    적정:all.filter(r=>r.tier==="적정").slice(0,10),
    소신:all.filter(r=>r.tier==="소신").slice(0,10),
    상향:all.filter(r=>r.tier==="상향").slice(0,5),
    all,
  };
}

function buildGyogwaRecs(grade, gyeyeol, gender, majorGroup){
  const db = getGyogwaDB(gyeyeol);
  const g = parseFloat(grade);
  const filtered = db.filter(r=>
    !(gender==="남"&&WOMENS_UNIV.has(r.u)) &&
    r.c >= g - C50_RANGE && r.c <= g + C50_RANGE
  );
  const scored = filtered.map(r=>{
    const tier = calcGyogwaTier(g, r.c, r.c70);
    if(tier==="제외") return null;
    const majorMatch = majorGroup ? isMajorMatch(r.m, majorGroup.matchTerms) : false;
    const wishMatch = majorGroup?.userKey ? (r.m||"").includes(majorGroup.userKey) : false;
    const poss = calcGyogwaPoss(grade, r.c, r.c70);
    return {...r, tier, diff:g-r.c, majorMatch, wishMatch, poss};
  }).filter(Boolean);

  const byUni={};
  for(const r of scored){
    const key=getBaseUniv(r.u);
    const p=byUni[key];
    if(!p){byUni[key]=r;continue;}
    if((r.wishMatch&&!p.wishMatch)||
       (r.wishMatch===p.wishMatch&&(r.poss>p.poss||(r.poss===p.poss&&Math.abs(r.diff)<Math.abs(p.diff))))) byUni[key]=r;
  }
  const to={안정:0,적정:1,소신:2,상향:3};
  const display = majorGroup ? Object.values(byUni).filter(r=>r.majorMatch) : Object.values(byUni);
  const all = display.sort((a,b)=>(to[a.tier]||3)-(to[b.tier]||3)||(b.wishMatch?1:0)-(a.wishMatch?1:0)||a.c-b.c||b.poss-a.poss);
  return {
    안정:all.filter(r=>r.tier==="안정").slice(0,10),
    적정:all.filter(r=>r.tier==="적정").slice(0,10),
    소신:all.filter(r=>r.tier==="소신").slice(0,10),
    상향:all.filter(r=>r.tier==="상향").slice(0,5),
    all,
  };
}

// ── AI 시스템 프롬프트 ─────────────────────────────────────────────
const SYS=`당신은 대한민국 최고의 입학사정관이자 입시 전문 컨설턴트입니다.
반드시 아래 형식으로만 응답하세요. JSON 금지. 마크다운 금지.
각 항목은 항목명:: 으로 시작. 배열은 ◆ 기호 구분.
[코드계산용 레이블] 항목은 반드시 지정된 선택지 중 하나만 출력.

[전제 원칙]
① 내신(성적)은 지원 가능 티어를 결정한다. 세특·활동이 합격 여부를 결정한다.
② 정성 평가. 세특 문장 내 핵심 동사 수준으로 Depth 판단.
   S=재구성/비판, A=분석/설계, B=적용/연결, C=설명/정리, D=이해, E=참여나열
③ 공동체=4개 영역 전체(리더십/협업/봉사/성실). 미인정 결석/지각/조퇴만 감점.
④ 수상·독서 대입 미반영. 확언 금지. 생기부 기재 내용만 근거.
⑤ 성적 상승추이 0.5등급+ → Consistency 강 방향으로 고려.`;

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
세특수준: ${analysisResult.facts.docGrade}
진로일관성: ${analysisResult.facts.careerConsistency||""}

${subjects
  ?`추천전공세특::이수 예정 과목별 각각 세특 탐구 방향 (과목명:제안 형식 ◆ 구분)
${altMajor?`희망전공세특::변경 고려 전공 "${altMajor}" 기준 이수 예정 과목별 세특 탐구 방향 (과목명:제안 형식 ◆ 구분)`:"희망전공세특::해당없음"}`
  :`추천전공세특::추천 전공 연계 세특 방향 ◆ 3개
${altMajor?`희망전공세특::변경 고려 전공 "${altMajor}" 연계 세특 방향 ◆ 3개`:"희망전공세특::해당없음"}`
}
${club?`창체방향::${club} 동아리에서 전공 연계 활동 방향 2문장`:`창체방향::전공 연계 가능한 동아리 유형 추천 2문장 (특정 동아리명 지정 금지)`}`;
}

// ── 1단계 프롬프트 ────────────────────────────────────────────────
function makePrompt1(text, gradeInfo, preInput){
  const t = text.length > 80000 ? text.slice(0,80000) : text;
  const gradeNote = gradeInfo
    ? `[내신 확정등급: ${gradeInfo.selectedAvg}등급 (기준: ${gradeInfo.selectedKey}) / 등급제: ${gradeInfo.gradeSystem}]`
    : "";
  const preBlock = (preInput && (preInput.지망전공||preInput.subjects||preInput.club||preInput.memo))
    ? `[컨설턴트 추가 정보 - 참고만 할 것]
희망전공: ${preInput.지망전공||""}
이수예정과목: ${preInput.subjects||""}
동아리: ${preInput.club||""}
검토사항: ${preInput.memo||""}
※ 학생부 기재 내용 우선. 충돌 시 학생부 기준.

` : "";
  return `${preBlock}${gradeNote}
학생부를 분석하세요.

[팩트]
이름::학생 이름
성별::남/여
학교::고교명
계열::인문사회 또는 자연공학 중 하나
지망전공::희망 전공·계열
내신추이::학기별 등급 예: 1-1)2.65→1-2)3.17
과목별등급::주요과목과 등급 ◆ 로 구분

[코드계산용 레이블 — 아래 형식 반드시 준수]
※ 반드시 "항목명::" 형식으로 출력. 콜론 2개 필수. 공백 금지.
※ 선택지 이외 값 출력 시 시스템 오류 발생.
※ 예시: 서류등급::A+ (O) / 서류등급: A+ (X) / 서류 등급::A+ (X)

서류등급::S/A+/A/B+/B/B- 중 하나만
서류등급근거::판단 근거 2문장 (Depth·Direction·Consistency 기반)

리더십수준::임원+리더/임원or리더/역할있음/없음 중 하나만
봉사나눔수준::지속적/꾸준/간헐적/미흡 중 하나만
협업소통수준::리더적/적극/참여/미흡 중 하나만
성실규칙수준::정상/미인정소수/미인정다수/학폭조치 중 하나만
진로일관성수준::완전일관/유관일관/부분일관/불일관 중 하나만

[판단 기준]
리더십: 임원+리더=학급·전교임원+동아리장, 임원or리더=둘중하나, 역할있음=모둠장·부원장등, 없음=기록없음
봉사: 지속적=매학기꾸준, 꾸준=간격있음, 간헐적=일회성, 미흡=거의없음
협업: 리더적=주도·조율, 적극=충실참여, 참여=일반참여, 미흡=기록없음
성실: 정상=무결석or인정결석, 미인정소수=미인정1~2회, 미인정다수=3회+, 학폭조치=학폭기록
Direction게이트: 부분일관→서류등급최고A / 불일관→최고B+(DepthS면B+허용)

[AI 서술]
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

// ── 응답 파싱 ─────────────────────────────────────────────────────
function parseAnalysis(raw, text, gradeInfo){
  const map={};
  for(const line of raw.split("\n")){
    const idx=line.indexOf("::");if(idx<0)continue;
    const k=line.slice(0,idx).trim(),v=line.slice(idx+2).trim();
    if(k&&v)map[k]=v;
  }
  const s=(k,d="")=>map[k]||d;
  const arr=(k)=>(map[k]||"").split("◆").map(x=>x.trim()).filter(Boolean);

  let gradeAll = gradeInfo
    ? String(gradeInfo.selectedAvg)
    : (()=>{
        const nums=(s("내신추이","").match(/\d+\.\d+/g)||[]).map(Number).filter(n=>n>0&&n<9);
        return nums.length?String(Math.round(nums.reduce((a,b)=>a+b,0)/nums.length*100)/100):"3.0";
      })();

  // ── 파싱 실패 감지 (조용한 fallback 방지) ──────────────────────
  const DOC_GRADES=["S","A+","A","B+","B","B-"];
  const parseWarnings=[];

  const rawDocGrade = s("서류등급");
  // 공백·오타 허용 보정: "A +" → "A+", "b+" → "B+" 등
  const normalizedDocGrade = rawDocGrade.trim().toUpperCase().replace(/\s/g,"").replace("A+","A+").replace("B+","B+").replace("B-","B-");
  const docGrade = DOC_GRADES.includes(normalizedDocGrade)
    ? normalizedDocGrade
    : DOC_GRADES.includes(rawDocGrade)
      ? rawDocGrade
      : (parseWarnings.push("서류등급 파싱 실패 → 기본값 B 적용 (AI 출력: '"+(rawDocGrade||"없음")+"')"), PARSE_DEFAULTS.docGrade);

  const rawLeadership = s("리더십수준");
  const leadership = rawLeadership in COMM_LEADERSHIP
    ? rawLeadership
    : (parseWarnings.push("리더십수준 파싱 실패 → 기본값 적용 (AI 출력: '"+(rawLeadership||"없음")+"')"), PARSE_DEFAULTS.leadership);

  const rawBongsa = s("봉사나눔수준");
  const bongsa = rawBongsa in COMM_BONGSA
    ? rawBongsa
    : (parseWarnings.push("봉사나눔수준 파싱 실패 → 기본값 적용 (AI 출력: '"+(rawBongsa||"없음")+"')"), PARSE_DEFAULTS.bongsa);

  const rawHyeobup = s("협업소통수준");
  const hyeobup = rawHyeobup in COMM_HYEOBUP
    ? rawHyeobup
    : (parseWarnings.push("협업소통수준 파싱 실패 → 기본값 적용 (AI 출력: '"+(rawHyeobup||"없음")+"')"), PARSE_DEFAULTS.hyeobup);

  const rawSeongshil = s("성실규칙수준");
  const seongshil = rawSeongshil in COMM_SEONGSHIL
    ? rawSeongshil
    : (parseWarnings.push("성실규칙수준 파싱 실패 → 기본값 적용 (AI 출력: '"+(rawSeongshil||"없음")+"')"), PARSE_DEFAULTS.seongshil);

  const rawCareer = s("진로일관성수준");
  const careerConsistency = rawCareer in CAREER_BONUS
    ? rawCareer
    : (parseWarnings.push("진로일관성수준 파싱 실패 → 기본값 적용 (AI 출력: '"+(rawCareer||"없음")+"')"), PARSE_DEFAULTS.careerConsist);

  const raw계열=s("계열","인문사회");
  const 계열=(raw계열.includes("자연")||raw계열.includes("공학"))?"자연공학":"인문사회";
  const gender=s("성별","");
  const 지망전공=s("지망전공","");
  const firstMaj=(map["전공추천1"]||"").split("|")[0].trim();
  const recMajorGroup=detectMajorGroup(firstMaj)||detectMajorGroup(지망전공);
  const schoolType=detectSchoolType(text);

  // ── 5등급제 환산 처리 ──────────────────────────────────────────
  // 5등급제 학생은 9등급 환산값(부산교육청 기준)으로 모든 컷 비교·계산 수행
  const is5sys = (gradeInfo?.gradeSystem) === "5등급";
  const gradeAll5 = is5sys ? gradeAll : null;            // 원본 5등급 값 보존
  const g9base = is5sys ? conv5to9(parseFloat(gradeAll), "base") : null;
  const gradeConv = is5sys ? {
    base: g9base,
    strict: conv5to9(parseFloat(gradeAll), "strict"),    // 광주진협(보수)
    loose: conv5to9(parseFloat(gradeAll), "loose"),      // 대진대(관대)
  } : null;
  if(is5sys && g9base!=null) gradeAll = String(g9base);  // 이후 전 계산은 환산값 사용

  const adjGrade = calcAdjGrade(parseFloat(gradeAll), schoolType, docGrade);
  // spreadBadge: 서류등급(세특 깊이)과 조정내신 갭으로 학생 성향 동적 판단
  // S/A+: 서사형 우선 / B/B-: 정량형 우선 / 나머지: 균형형
  const sebuGap = (SEBU_SCORE[docGrade]??82) - adjToScore(adjGrade);
  const spreadBadge = sebuGap >= 15 ? "🔵" : sebuGap >= 5 ? "🟡" : "🔴";
  const scores = calcScoresV114(adjGrade, docGrade, careerConsistency, leadership, bongsa, hyeobup, seongshil, spreadBadge);
  const total = calcTotal(scores);
  const strength = getStrength(total);

  const majors=[1,2,3].map(i=>{
    const r=map["전공추천"+i]||"";const sp=r.indexOf("|");
    return sp>0?{name:r.slice(0,sp).trim(),reason:r.slice(sp+1).trim()}:null;
  }).filter(Boolean);

  return{
    name:s("이름","미확인"),gender,school:s("학교"),
    schoolType,계열,지망전공,recMajorGroup,
    docGrade,leadership,bongsa,hyeobup,seongshil,careerConsistency,
    adjGrade,scores,total,strength,
    gradeLabel:gradeLabel(total),
    gradeLabels:{학업:gradeLabel(scores.학업),진로:gradeLabel(scores.진로),공동체:gradeLabel(scores.공동체)},
    facts:{
      gradeAll,docGrade,
      gradeAll5, gradeConv,
      parseInfo:gradeInfo?`확정등급(${gradeInfo.selectedKey}/${gradeInfo.subjects?.length||0}과목,A${gradeInfo.aCount||0}개)`:"추이기반추정",
      gradeSystem:gradeInfo?.gradeSystem||"9등급",
      byGroup:gradeInfo?.byGroup||{},
      semTrend:gradeInfo?.semTrend||"",
      achieveBonus:gradeInfo?.achieveBonus||0,
      careerConsistency,
    },
    grade:{all:gradeAll,trend:s("내신추이"),bySubject:arr("과목별등급")},
    combo:{good:s("유리한조합"),bad:s("불리한조합"),sim:s("교과시뮬")},
    진로별유불리:s("진로별성적유불리"),
    analysis:{trend:s("성적추이분석"),sebu:s("세특진단"),career:s("진로일관성분석"),leader:s("리더십분석"),
              goodSubjects:arr("강점과목"),badSubjects:arr("약점과목"),excluded:s("미반영","해당없음")},
    strengths:[s("강점1"),s("강점2"),s("강점3")].filter(Boolean),
    weaknesses:[s("보완점1"),s("보완점2")].filter(Boolean),
    majors,
    rec:{type:s("추천전형","종합"),reason:s("전형이유"),strategy:s("배분전략")},
    consultant:{summary:arr("핵심요약"),opinion:s("컨설턴트의견"),counselPoint:s("상담포인트")},
    doc근거:s("서류등급근거"),
    parseWarnings,
    wishMajorGroup:recMajorGroup,
    altMajor:"",
    suplement:null,
  };
}

function parseSuplement(raw, hasSubjects){
  const map={};
  for(const line of raw.split("\n")){
    const idx=line.indexOf("::");if(idx<0)continue;
    const k=line.slice(0,idx).trim(),v=line.slice(idx+2).trim();
    if(k&&v)map[k]=v;
  }
  const arr=(k)=>(map[k]||"").split("◆").map(x=>x.trim()).filter(Boolean);
  return{
    추천전공세특:arr("추천전공세특"),
    희망전공세특:arr("희망전공세특"),
    창체:map["창체방향"]||"",
    hasSubjects,
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

// ── getBadges ─────────────────────────────────────────────────────
function getBadges(r, schoolType){
  const badges=[];
  const spread=r.c70-r.c;
  if(isSpecialTrack(r.t)) badges.push({type:"special",label:"🏷️특별전형",tip:"농어촌·기회균형·사회배려 등 — 지원자격 확인 필수, 일반전형 대비 입결 낮게 형성",bg:"#f3e8ff",tc:"#7e22ce"});
  if(isLocalTrack(r.t)) badges.push({type:"local",label:"📍지역인재",tip:"지역인재전형 — 해당 지역 고교 졸업자 지원 가능. 지원자격 확인 필수",bg:"#ecfdf5",tc:"#065f46"});
  if(r.s27&&r.s27!=="없음") badges.push({type:"suneung",label:"수능최저",tip:`수능최저: ${r.s27}`,bg:"#fff1f2",tc:"#e11d48"});
  if(spread<0.25) badges.push({type:"tight2",label:"⚠️구간매우좁음",tip:"합격 구간 매우 좁음",bg:"#fef9c3",tc:"#854d0e"});
  else if(spread<0.40) badges.push({type:"tight1",label:"⚠️구간좁음",tip:"합격 구간 좁음",bg:"#fef9c3",tc:"#a16207"});
  const st=SCHOOL_TYPE_RATIO[r.u];
  if(st){
    const fieldMap={"일반고":"일반고","광역자사":"자사고","전국자사":"자사고","외고국제":"외고","과학고":"과학고","영재고":"영재고"};
    const field=fieldMap[schoolType||"일반고"]||"일반고";
    const pct=st[field]??st["일반고"]??0;
    const label=`일반고 ${st.일반고||0}% · 특목자사 ${(st.과학고||0)+(st.외고||0)+(st.자사고||0)+(st.영재고||0)}%`;
    const tip=`일반고 ${st.일반고||0}% · 과학고 ${st.과학고||0}% · 외고 ${st.외고||0}% · 자사고 ${st.자사고||0}% · 영재고 ${st.영재고||0}%`;
    const tc=pct<5?"#e11d48":pct<15?"#92400e":"#475569";
    const bg=pct<5?"#fff1f2":pct<15?"#fef9c3":"#f8fafc";
    badges.push({type:"school",label,tip,bg,tc});
  }
  if(r.avg&&r.c>r.avg+0.45) badges.push({type:"warn",label:"⚠️작년입결주의",tip:"작년에 낮은 등급도 합격한 전형",bg:"#fff7ed",tc:"#c2410c"});
  if(r.avg&&r.c<r.avg-0.45) badges.push({type:"ref",label:"💡작년입결참고",tip:"작년에 높은 등급만 합격한 전형",bg:"#f0fdf4",tc:"#15803d"});
  if(r.chg) badges.push({type:"chg",label:"⚡전형변동",tip:`2027 변경: ${r.chg}`,bg:"#f5f3ff",tc:"#6d28d9"});
  const isInterview=r.method?.includes("면접")||r.t?.includes("면접형")||r.t?.includes("면접");
  if(isInterview) badges.push({type:"interview",label:"🎤면접",tip:"면접 포함 전형",bg:"#eff6ff",tc:"#1d4ed8"});
  const sb=r.spreadBadge||getSpreadBadge(r.c70-r.c);
  const sbLabel=sb==="🔵"?"🔵서사형":sb==="🟡"?"🟡균형형":"🔴정량형";
  const sbTip=sb==="🔵"?"갭≥0.30: 세특 중심":sb==="🟡"?"갭 0.18~0.30: 균형형":"갭<0.18: 내신 중심";
  const sbBg=sb==="🔵"?"#eff6ff":sb==="🟡"?"#fefce8":"#fff1f2";
  const sbTc=sb==="🔵"?"#1d4ed8":sb==="🟡"?"#854d0e":"#e11d48";
  badges.push({type:"spread",label:sbLabel,tip:sbTip,bg:sbBg,tc:sbTc});
  return badges;
}

// ── UniCard ───────────────────────────────────────────────────────
function UniCard({r, i, majorGroup, mode, schoolType}){
  const badges=getBadges(r, schoolType);
  const hasSuneung=r.s27&&r.s27!=="없음";
  const diffStr=r.diff>=0?"+"+r.diff.toFixed(2):r.diff.toFixed(2);
  const tc=TC[r.tier]||C.accent, tbg=TB[r.tier]||C.aLight;
  const dispMajor=r.m; // 실제 합격컷이 있는 학과명 표시 (그룹 대표전공 덮어쓰기 버그 수정)
  const pct=r.tier==="안정"?"90%":r.tier==="적정"?"70%":r.tier==="소신"?"50%":"30%";
  return(
    <div style={{borderBottom:"1px solid "+C.border,padding:"10px 0",breakInside:"avoid",pageBreakInside:"avoid"}}>
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
        {r.avg&&<span style={{marginLeft:6,color:C.muted}}>평균 {r.avg?.toFixed(2)}</span>}
      </div>
      {(r.chasu!=null||r.compet!=null||r.volatility||r.trend)&&(
        <div style={{fontSize:"10px",color:C.sub,lineHeight:1.8,marginTop:2}}>
          {r.chasu!=null&&r.n&&<span style={{marginRight:8}}>추합률 {Math.round(r.chasu/r.n*100)}%</span>}
          {r.compet!=null&&<span style={{marginRight:8}}>경쟁률 {r.compet}:1</span>}
          {r.volatility&&<span style={{marginRight:8}}>변동성 {r.volatility}</span>}
          {r.trend&&<span>추세 {r.trend}</span>}
        </div>
      )}
      {hasSuneung&&<div style={{fontSize:"10px",color:C.rose,marginTop:"4px",background:C.roseLight,borderRadius:"6px",padding:"4px 8px",lineHeight:1.5}}>
        📋 수능최저: {r.s27.slice(0,80)}
      </div>}
      {(()=>{const ew=getEvalWeight(r.u,r.t);return ew?(<div style={{fontSize:"10px",color:C.violet,marginTop:3,lineHeight:1.6}}>평가비율: 학업{ew.academic}/진로{ew.career}/공동체{ew.community}{ew.note&&" ("+ew.note+")"}</div>):null;})()}
    </div>
  );
}

// ── TierSection ───────────────────────────────────────────────────
function TierSection({label,color,bg,items,majorGroup,mode,schoolType}){
  if(!items||items.length===0)return null;
  return(
    <div style={{marginBottom:"12px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px",padding:"6px 10px",background:bg,borderRadius:"8px",border:"1px solid "+color+"30"}}>
        <span style={{fontSize:"12px",fontWeight:700,color}}>{label}</span>
        <span style={{fontSize:"10px",color,opacity:.7}}>{items.length}개</span>
      </div>
      {items.map((r,i)=><UniCard key={r.u+r.t} r={r} i={i} majorGroup={majorGroup} mode={mode} schoolType={schoolType}/>)}
    </div>
  );
}

// ── RecsPanel ─────────────────────────────────────────────────────
function RecsPanel({recs,majorGroup,note,mode,schoolType}){
  const{안정,적정,소신,상향}=recs;
  return(
    <div>
      <div style={{fontSize:"10px",color:C.muted,marginBottom:"10px",lineHeight:1.7,padding:"8px 10px",background:C.panel,borderRadius:"8px"}}>
        {mode==="학종"?<>50%컷(적정) · 70%컷(소신) · gap 기반 소신범위 자동조정<br/>{majorGroup?<span style={{color:C.green}}>전공매칭: {majorGroup.label}</span>:<span>전공 미분류 — 전체 표시</span>}</>:<>교과전형 내신 기준 · 전형방법·수능최저 직접 표시</>}
        {note&&<span style={{color:C.violet}}> · {note}</span>}
      </div>
      <TierSection label="🟢 안정" color={TC.안정} bg={TB.안정} items={안정} majorGroup={majorGroup} mode={mode} schoolType={schoolType}/>
      <TierSection label="🔵 적정" color={TC.적정} bg={TB.적정} items={적정} majorGroup={majorGroup} mode={mode} schoolType={schoolType}/>
      <TierSection label="🟡 소신" color={TC.소신} bg={TB.소신} items={소신} majorGroup={majorGroup} mode={mode} schoolType={schoolType}/>
      <TierSection label="🟣 상향" color={TC.상향} bg={TB.상향} items={상향} majorGroup={majorGroup} mode={mode} schoolType={schoolType}/>
    </div>
  );
}

// ── ManualInput ───────────────────────────────────────────────────
function ManualInput({onAnalyze}){
  const[grade,setGrade]=useState("3.0");
  const[docGrade,setDocGrade]=useState("B");
  const[career,setCareer]=useState("유관일관");
  const[leadership,setLeadership]=useState("역할있음");
  const[bongsa,setBongsa]=useState("간헐적");
  const[hyeobup,setHyeobup]=useState("참여");
  const[seongshil,setSeongshil]=useState("정상");
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
    const adjGrade=calcAdjGrade(parseFloat(grade),"일반고",docGrade);
    const scores=calcScoresV114(adjGrade,docGrade,career,leadership,bongsa,hyeobup,seongshil,"🟡");
    const total=calcTotal(scores);
    const rmg=detectMajorGroup(지망);
    onAnalyze({
      name:"수동입력",gender:gen,school:"",schoolType:"일반고",계열:gyeyeol,지망전공:지망,
      recMajorGroup:rmg,wishMajorGroup:rmg,altMajor:"",
      docGrade,leadership,bongsa,hyeobup,seongshil,careerConsistency:career,
      adjGrade,scores,total,strength:getStrength(total),
      gradeLabel:gradeLabel(total),
      gradeLabels:{학업:gradeLabel(scores.학업),진로:gradeLabel(scores.진로),공동체:gradeLabel(scores.공동체)},
      facts:{gradeAll:grade,docGrade,careerConsistency:career,parseInfo:"수동입력",achieveBonus:0,byGroup:{},semTrend:""},
      grade:{all:grade,trend:"",bySubject:[]},
      combo:{good:"",bad:"",sim:""},진로별유불리:"",
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
    {sel("서류등급",docGrade,setDocGrade,["S","A+","A","B+","B","B-"])}
    {sel("성별",gender,setGender,["여","남","미입력"])}
    {sel("계열",gyeyeol,setGyeyeol,["인문사회","자연공학"])}
    {sel("진로 일관성",career,setCareer,["완전일관","유관일관","부분일관","불일관"])}
    {sel("리더십",leadership,setLeadership,["임원+리더","임원or리더","역할있음","없음"])}
    {sel("봉사나눔",bongsa,setBongsa,["지속적","꾸준","간헐적","미흡"])}
    {sel("협업소통",hyeobup,setHyeobup,["리더적","적극","참여","미흡"])}
    {sel("성실규칙",seongshil,setSeongshil,["정상","미인정소수","미인정다수","학폭조치"])}
    <div style={{marginBottom:10}}>
      <div style={{fontSize:"11px",color:C.sub,marginBottom:3}}>희망 전공</div>
      <input type="text" value={지망} onChange={e=>set지망(e.target.value)} placeholder="예: 미디어커뮤니케이션, 컴퓨터공학"
        style={{width:"100%",padding:"8px 12px",background:C.panel,border:"1px solid "+C.border,borderRadius:"8px",color:C.text,fontSize:"13px",fontFamily:"inherit"}}/>
    </div>
    <button onClick={go} style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#2563eb,#1d4ed8)",border:"none",borderRadius:"8px",color:"white",fontSize:"14px",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
      분석 시작
    </button>
  </div>);
}

// ── Result ────────────────────────────────────────────────────────
function Result({d, onReset, onReanalyze, isReanalyzing}){
  const[tab,setTab]=useState("analysis");
  const[jongSub,setJongSub]=useState("추천학과");
  const[recMode,setRecMode]=useState("학종");
  const[altMajor,setAltMajor]=useState("");
  const[subjects,setSubjects]=useState("");
  const[club,setClub]=useState("");
  const[searchQ,setSearchQ]=useState("");
  const[reportText,setReportText]=useState("");
  const[gyeyeolFilter,setGyeyeolFilter]=useState("전체");
  const[searchPage,setSearchPage]=useState(1);
  const PAGE_SIZE=50;

  const wishMajorGroup=d.altMajor?detectMajorGroup(d.altMajor)||d.wishMajorGroup:d.wishMajorGroup;
  const jongRecRecs=buildJongRecs(d.facts.gradeAll,d.docGrade||"B",d.schoolType||"일반고",d.계열,d.gender,d.recMajorGroup,d.strength||"중");
  const jongWishRecs=buildJongRecs(d.facts.gradeAll,d.docGrade||"B",d.schoolType||"일반고",d.계열,d.gender,wishMajorGroup,d.strength||"중");
  const gyogwaRecs=buildGyogwaRecs(d.facts.gradeAll,d.계열,d.gender,d.recMajorGroup);

  const jongDB=getJongDB(d.계열); const gyogwaDB=getGyogwaDB(d.계열);
  const allDb=[...jongDB,...gyogwaDB];
  const searchResults=searchQ.length>=2?allDb.filter(r=>
    (gyeyeolFilter==="전체"||r.g===gyeyeolFilter)&&
    (r.u.includes(searchQ)||r.m.includes(searchQ)||r.t.includes(searchQ))
  ):[];

  const copyReport=()=>{
    const L=[];
    L.push("KAIROS 153 · 카이로스153 대입컨설팅 · 2027학년도 · v11.4.5");
    L.push(`학생: ${d.name}${d.gender?" ("+d.gender+")":""} | ${d.school||""} [${d.schoolType}] | ${d.계열}`);
    L.push(`내신: ${d.facts.gradeAll}등급 [${d.facts.parseInfo}]`);
    L.push(`서류등급: ${d.docGrade} | 조정내신: ${d.adjGrade?.toFixed(2)||"-"} | 진로일관성: ${d.careerConsistency||""}`);
    L.push(`역량: 학업${d.gradeLabels.학업}(${d.scores.학업}) / 진로${d.gradeLabels.진로}(${d.scores.진로}) / 공동체${d.gradeLabels.공동체}(${d.scores.공동체}) → 종합 ${d.total}점`);
    if(d.지망전공)L.push(`지망: ${d.지망전공}${d.altMajor?" → 변경고려: "+d.altMajor:""}`);
    if(d.strengths.length){L.push("");L.push("[강점]");d.strengths.forEach((s,i)=>L.push(`${i+1}. ${s}`));}
    if(d.weaknesses.length){L.push("");L.push("[보완점]");d.weaknesses.forEach((s,i)=>L.push(`${i+1}. ${s}`));}
    if(d.suplement){
      if(d.suplement.추천전공세특?.length){L.push("");L.push("[추천전공 보완사항]");d.suplement.추천전공세특.forEach(s=>L.push("• "+s));}
      if(d.altMajor&&d.suplement.희망전공세특?.length&&d.suplement.희망전공세특[0]!=="해당없음"){L.push("");L.push(`[희망전공 보완사항 (${d.altMajor})]`);d.suplement.희망전공세특.forEach(s=>L.push("• "+s));}
      if(d.suplement.창체){L.push("");L.push("[창체방향]");L.push(d.suplement.창체);}
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
      L.push(`${i+1}. [${r.tier}] ${r.u} · ${r.t}`);
      L.push(`   50%컷:${r.c?.toFixed(2)} / 70%컷:${r.c70?.toFixed(2)}`);
      if(r.s27&&r.s27!=="없음")L.push(`   수능최저: ${r.s27.slice(0,60)}`);
    });
    if(d.rec.strategy){L.push("");L.push("[수시 6장 배분 전략]");L.push(d.rec.strategy);}
    if(d.consultant.opinion){L.push("");L.push("[컨설턴트 종합의견]");L.push(d.consultant.opinion);}
    L.push("");L.push("KAIROS 153 · 신지은");
    const text=L.join("\n");
    if(navigator.clipboard&&window.isSecureContext){
      navigator.clipboard.writeText(text).then(()=>alert("리포트 복사 완료!")).catch(()=>setReportText(text));
    } else {
      try{const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.focus();ta.select();const ok=document.execCommand("copy");document.body.removeChild(ta);if(ok)alert("리포트 복사 완료!");else setReportText(text);}
      catch(e){setReportText(text);}
    }
  };

  const TABS=[["analysis","📋 분석"],["suplement","🔧 보완사항"],["recs","🏫 대학추천"],["search","🔍 입결검색"],["report","📄 리포트"]];

  return(<div>
    <style>{`
      @media print {
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        span[title] { display: inline-block !important; } /* 배지 인쇄 보장 */
        button, select, textarea { display: none !important; }
      }
    `}</style>
    {/* 헤더 */}
    <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"12px",padding:"14px",marginBottom:"10px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"8px",marginBottom:"8px"}}>
        <div>
          <div style={{color:C.muted,fontSize:"10px",marginBottom:"2px"}}>KAIROS 153 · 신지은 · v11.4.5</div>
          <div style={{color:C.text,fontSize:"17px",fontWeight:900}}>{d.name}{d.gender&&" ("+d.gender+")"}</div>
          <div style={{color:C.sub,fontSize:"11px"}}>{d.school} [{d.schoolType}] · {d.계열}</div>
          {d.지망전공&&<div style={{color:C.violet,fontSize:"11px",marginTop:2}}>지망: {d.지망전공}{d.altMajor&&" → 변경고려: "+d.altMajor}</div>}
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:C.muted,fontSize:"10px"}}>종합 역량</div>
          <div style={{fontSize:"30px",fontWeight:900,lineHeight:1,color:d.total>=75?C.green:d.total>=60?C.gold:C.rose}}>{d.total}</div>
          <div style={{color:C.muted,fontSize:"9px"}}>/100 (학업40/진로39/공동체21)</div>
        </div>
      </div>
      <div style={{background:C.panel,borderRadius:"8px",padding:"7px 12px",fontSize:"11px",color:C.sub,marginBottom:"8px",lineHeight:1.7}}>
        서류등급 <b>{d.docGrade||"B"}</b> · 조정내신 <b>{d.adjGrade?.toFixed(2)||"-"}</b> · 진로일관성 <b>{d.careerConsistency||"유관일관"}</b>
      </div>
      {d.facts?.gradeAll5&&(
        <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:"8px",padding:"8px 12px",marginBottom:"8px",fontSize:"11px",color:"#1e40af",lineHeight:1.7}}>
          🔄 <b>5등급제 환산 적용</b> — 내신 {d.facts.gradeAll5}(5등급제) → <b>{d.facts.gradeConv?.base}</b>(9등급 환산, 부산교육청 기준)
          <div style={{fontSize:"10px",color:"#3b82f6"}}>참고범위: 보수(광주진협) {d.facts.gradeConv?.strict??"범위밖"} ~ 관대(대진대) {d.facts.gradeConv?.loose}. 모든 컷 비교는 환산값 기준.</div>
        </div>
      )}
      {d.parseWarnings&&d.parseWarnings.length>0&&(
        <div style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:"8px",padding:"8px 12px",marginBottom:"8px"}}>
          <div style={{fontSize:"11px",fontWeight:700,color:"#c2410c",marginBottom:4}}>⚠️ AI 파싱 경고 — 아래 항목이 기본값으로 적용됐습니다. 재분석을 권장합니다.</div>
          {d.parseWarnings.map((w,i)=>(
            <div key={i} style={{fontSize:"10px",color:"#9a3412",lineHeight:1.7}}>• {w}</div>
          ))}
        </div>
      )}
      {d.facts.byGroup&&Object.keys(d.facts.byGroup).some(k=>d.facts.byGroup[k])&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:"8px"}}>
          {Object.entries(d.facts.byGroup).filter(([,v])=>v!=null).map(([k,v])=>(
            <div key={k} style={{background:C.panel,border:"1px solid "+C.border,borderRadius:"6px",padding:"3px 8px",fontSize:"10px"}}>
              <span style={{color:C.muted}}>{k} </span><b style={{color:C.accent}}>{v}</b>
            </div>
          ))}
        </div>
      )}
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
      {[["학업(40%)",d.gradeLabels?.학업,C.accent],["진로(39%)",d.gradeLabels?.진로,C.green],["공동체(21%)",d.gradeLabels?.공동체,C.violet]].map(([l,g,c])=>(
        <div key={l} style={{flex:1,background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"10px",textAlign:"center"}}>
          <div style={{fontSize:"10px",color:C.muted,marginBottom:"2px"}}>{l}</div>
          <div style={{fontSize:"24px",fontWeight:900,color:c,lineHeight:1}}>{g}</div>
        </div>
      ))}
    </div>

    {/* 탭 */}
    <div style={{display:"flex",gap:"4px",marginBottom:"10px",flexWrap:"wrap"}}>
      {TABS.map(([id,label])=>(
        <button key={id} onClick={()=>setTab(id)} style={{padding:"7px 12px",border:"none",borderRadius:"8px",fontSize:"12px",fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:tab===id?C.accent:"transparent",color:tab===id?"white":C.muted}}>
          {label}
        </button>
      ))}
    </div>

    {/* 탭1: 분석 */}
    {tab==="analysis"&&(<div>
      {d.진로별유불리&&<div style={{background:C.violetLight,border:"1px solid "+C.violetBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:C.violet,marginBottom:"5px"}}>📊 진로별 성적 유불리</div>
        <div style={{fontSize:"12px",color:C.text,lineHeight:1.7}}>{d.진로별유불리}</div>
      </div>}
      <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"8px"}}>📈 성적 분석</div>
        {(d.facts.semTrend||d.grade.trend)&&<div style={{fontSize:"12px",color:C.sub,marginBottom:"8px",padding:"8px 10px",background:C.panel,borderRadius:"7px"}}>추이: {d.facts.semTrend||d.grade.trend}</div>}
        {d.analysis.trend&&<div style={{fontSize:"12px",color:C.text,lineHeight:1.7,marginBottom:"6px"}}>{d.analysis.trend}</div>}
        {d.combo.good&&<div style={{marginBottom:"6px"}}><span style={{fontSize:"10px",color:C.green}}>유리한 조합 </span><span style={{fontSize:"12px",color:C.text,lineHeight:1.6}}>{d.combo.good}</span></div>}
        {d.combo.bad&&<div><span style={{fontSize:"10px",color:C.rose}}>불리한 조합 </span><span style={{fontSize:"12px",color:C.text,lineHeight:1.6}}>{d.combo.bad}</span></div>}
      </div>
      {[["🔬 세특 진단",d.analysis.sebu],["🎯 진로 일관성",d.analysis.career],["🏆 리더십",d.analysis.leader]].filter(([,v])=>v).map(([t,c])=>(
        <div key={t} style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
          <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"5px"}}>{t}</div>
          <div style={{fontSize:"12px",color:C.text,lineHeight:1.7}}>{c}</div>
        </div>
      ))}
      {d.strengths.length>0&&<div style={{background:C.greenLight,border:"1px solid "+C.greenBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:C.green,marginBottom:"5px"}}>✅ 강점</div>
        {d.strengths.map((s,i)=><div key={i} style={{fontSize:"12px",color:C.text,marginBottom:"4px"}}>• {s}</div>)}
      </div>}
      {d.weaknesses.length>0&&<div style={{background:C.roseLight,border:"1px solid "+C.roseBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:C.rose,marginBottom:"5px"}}>⚠️ 보완점</div>
        {d.weaknesses.map((s,i)=><div key={i} style={{fontSize:"12px",color:C.text,marginBottom:"4px"}}>• {s}</div>)}
      </div>}
      {d.majors.length>0&&<div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"8px"}}>🎓 추천 전공</div>
        {d.majors.map((m,i)=>(<div key={i} style={{borderBottom:i<d.majors.length-1?"1px solid "+C.border:"none",paddingBottom:8,marginBottom:8}}>
          <div style={{fontWeight:700,fontSize:"13px",color:C.accent,marginBottom:2}}>{i+1}. {m.name}</div>
          <div style={{fontSize:"11px",color:C.sub,lineHeight:1.6}}>{m.reason}</div>
        </div>))}
      </div>}
      {d.consultant.opinion&&<div style={{background:C.goldLight,border:"1px solid "+C.goldBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:C.gold,marginBottom:"5px"}}>💬 컨설턴트 종합의견</div>
        <div style={{fontSize:"12px",color:C.text,lineHeight:1.7}}>{d.consultant.opinion}</div>
      </div>}
      {d.rec.strategy&&<div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"5px"}}>📋 수시 6장 배분 전략</div>
        <div style={{fontSize:"12px",color:C.text,lineHeight:1.7}}>{d.rec.strategy}</div>
      </div>}
      {d.consultant.counselPoint&&<div style={{background:C.goldLight,border:"1px solid "+C.goldBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:C.gold,marginBottom:"5px"}}>👪 학부모 상담 포인트</div>
        <div style={{fontSize:"12px",color:C.text,lineHeight:1.7}}>{d.consultant.counselPoint}</div>
      </div>}
    </div>)}

    {/* 탭2: 보완사항 */}
    {tab==="suplement"&&(<div>
      <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"10px"}}>🔧 추가 정보 입력 후 재분석</div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:"11px",color:C.sub,marginBottom:3}}>변경 고려 전공 (선택)</div>
          <input type="text" value={altMajor} onChange={e=>setAltMajor(e.target.value)} placeholder="예: 경영학, 컴퓨터공학"
            style={{width:"100%",padding:"8px 12px",background:C.panel,border:"1px solid "+C.border,borderRadius:"8px",color:C.text,fontSize:"13px",fontFamily:"inherit",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:"11px",color:C.sub,marginBottom:3}}>3학년 이수 예정 과목 (선택)</div>
          <textarea value={subjects} onChange={e=>setSubjects(e.target.value)} placeholder="예: 언어와 매체, 확률과 통계, 생활과 윤리"
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
          {d.suplement.추천전공세특?.length>0&&<div style={{background:C.aLight,border:"1px solid "+C.aBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:C.accent,marginBottom:"6px"}}>📌 추천전공 세특 방향</div>
            {d.suplement.추천전공세특.map((s,i)=><div key={i} style={{fontSize:"12px",color:C.text,lineHeight:1.7,marginBottom:3}}>• {s}</div>)}
          </div>}
          {d.altMajor&&d.suplement.희망전공세특?.length>0&&d.suplement.희망전공세특[0]!=="해당없음"&&
            <div style={{background:C.violetLight,border:"1px solid "+C.violetBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
              <div style={{fontSize:"11px",fontWeight:700,color:C.violet,marginBottom:"6px"}}>📌 희망전공 세특 방향 ({d.altMajor})</div>
              {d.suplement.희망전공세특.map((s,i)=><div key={i} style={{fontSize:"12px",color:C.text,lineHeight:1.7,marginBottom:3}}>• {s}</div>)}
            </div>}
          {d.suplement.창체&&<div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"5px"}}>🎭 창체·동아리 방향</div>
            <div style={{fontSize:"12px",color:C.text,lineHeight:1.7}}>{d.suplement.창체}</div>
          </div>}
        </div>
      ):(
        <div style={{background:C.panel,borderRadius:"10px",padding:"20px",textAlign:"center",color:C.muted,fontSize:"12px"}}>위에서 추가 정보 입력 후 재분석하면 보완사항이 표시됩니다</div>
      )}
    </div>)}

    {/* 탭3: 대학추천 */}
    {tab==="recs"&&(<div>
      <div style={{display:"flex",gap:"6px",marginBottom:"10px",background:C.panel,padding:"5px",borderRadius:"10px"}}>
        {[["학종","🎓 학종(종합)"],["교과","📚 교과"]].map(([id,label])=>(
          <button key={id} onClick={()=>setRecMode(id)} style={{flex:1,padding:"8px",border:"none",borderRadius:"8px",fontSize:"12px",fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:recMode===id?C.surface:"transparent",color:recMode===id?C.accent:C.muted,boxShadow:recMode===id?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>
            {label}
          </button>
        ))}
      </div>
      {recMode==="학종"&&(<div>
        <div style={{display:"flex",gap:"6px",marginBottom:"10px",background:C.panel,padding:"5px",borderRadius:"10px"}}>
          {[["추천학과","🎯 추천학과",d.recMajorGroup?.label||"전체"],["지망학과","🔍 지망학과",d.altMajor||d.지망전공||"전체"]].map(([id,label,sub])=>(
            <button key={id} onClick={()=>setJongSub(id)} style={{flex:1,padding:"7px 5px",border:"none",borderRadius:"8px",fontSize:"11px",fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:jongSub===id?C.surface:"transparent",color:jongSub===id?C.accent:C.muted,boxShadow:jongSub===id?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>
              <div>{label}</div><div style={{fontSize:"10px",fontWeight:400,marginTop:1}}>{sub}</div>
            </button>
          ))}
        </div>
        {jongSub==="추천학과"&&<div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
          <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"6px"}}>🎯 AI 추천 전공 기준 — {d.recMajorGroup?.label||"전체"}</div>
          <RecsPanel recs={jongRecRecs} majorGroup={d.recMajorGroup} mode="학종" schoolType={d.schoolType}/>
        </div>}
        {jongSub==="지망학과"&&<div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
          <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"6px"}}>🔍 지망 전공 기준 — {d.altMajor||d.지망전공||"미입력"}</div>
          <RecsPanel recs={jongWishRecs} majorGroup={wishMajorGroup} mode="학종" schoolType={d.schoolType}/>
        </div>}
      </div>)}
      {recMode==="교과"&&<div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"4px"}}>📚 교과전형 추천 — {d.계열}</div>
        <RecsPanel recs={gyogwaRecs} majorGroup={null} mode="교과" schoolType={d.schoolType}/>
      </div>}
    </div>)}

    {/* 탭4: 입결검색 */}
    {tab==="search"&&(<div>
      <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:C.sub,marginBottom:"8px"}}>🔍 입결 검색</div>
        <input type="text" value={searchQ} onChange={e=>{setSearchQ(e.target.value);setSearchPage(1);}} placeholder="대학명·학과명·전형명 (2글자 이상)"
          style={{width:"100%",padding:"9px 12px",background:C.panel,border:"1px solid "+C.border,borderRadius:"8px",color:C.text,fontSize:"13px",fontFamily:"inherit",boxSizing:"border-box",marginBottom:"10px"}}/>
        <div style={{display:"flex",gap:5,margin:"8px 0"}}>
          {["전체","인문","자연","통합"].map(g=>(
            <button key={g} onClick={()=>{setGyeyeolFilter(g);setSearchPage(1);}}
              style={{padding:"4px 10px",borderRadius:"20px",fontSize:"11px",cursor:"pointer",fontFamily:"inherit",
                background:gyeyeolFilter===g?C.accent:C.panel,color:gyeyeolFilter===g?"white":C.sub,
                border:"1px solid "+(gyeyeolFilter===g?C.accent:C.border)}}>
              {g}
            </button>
          ))}
        </div>
        {searchQ.length>=2&&<div style={{fontSize:"10px",color:C.muted,marginBottom:6}}>검색결과 {searchResults.length}개</div>}
        {searchResults.slice(0,PAGE_SIZE*searchPage).map((r,i)=>(
          <div key={i} style={{borderBottom:"1px solid "+C.border,padding:"8px 0"}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontWeight:700,fontSize:"13px",color:C.text}}>{r.u}</span>
              <span style={{fontSize:"10px",background:C.panel,color:C.sub,padding:"1px 6px",borderRadius:"4px",border:"1px solid "+C.border}}>{r.g}</span>
            </div>
            <div style={{fontSize:"12px",color:C.accent,marginTop:2}}>→ {r.m}</div>
            <div style={{fontSize:"11px",color:C.sub,marginTop:1}}>{r.t}</div>
            <div style={{fontSize:"10px",color:C.muted,marginTop:2}}>
              50%컷 <b style={{color:C.accent}}>{r.c?.toFixed(2)}</b> | 70%컷 <b style={{color:C.rose}}>{r.c70?.toFixed(2)}</b>
              {r.avg&&<span style={{marginLeft:6}}>평균 {r.avg?.toFixed(2)}</span>}
            </div>
            {r.s27&&r.s27!=="없음"&&<div style={{fontSize:"10px",color:C.rose,marginTop:3,background:C.roseLight,borderRadius:"4px",padding:"2px 6px"}}>수능최저: {r.s27.slice(0,70)}</div>}
          </div>
        ))}
        {searchResults.length>PAGE_SIZE*searchPage&&(
          <button onClick={()=>setSearchPage(p=>p+1)} style={{width:"100%",marginTop:8,padding:"9px",background:C.panel,border:"1px solid "+C.border,borderRadius:"8px",color:C.sub,fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>
            더보기 ({PAGE_SIZE*searchPage}/{searchResults.length})
          </button>
        )}
      </div>
    </div>)}

    {/* 탭5: 리포트 */}
    {tab==="report"&&(<div>
      <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"10px",padding:"14px",marginBottom:"8px"}}>
        <div style={{fontSize:"12px",fontWeight:700,color:C.text,marginBottom:"8px"}}>📄 리포트 출력</div>
        <button onClick={copyReport} style={{width:"100%",padding:"12px",background:C.accent,border:"none",borderRadius:"8px",color:"white",fontWeight:700,fontSize:"13px",cursor:"pointer",fontFamily:"inherit",marginBottom:"8px"}}>
          📋 리포트 전체 복사
        </button>
        <button onClick={()=>window.print()} style={{width:"100%",padding:"12px",background:C.goldLight,border:"1px solid "+C.goldBorder,borderRadius:"8px",color:C.gold,fontWeight:700,fontSize:"13px",cursor:"pointer",fontFamily:"inherit"}}>
          🖨️ PDF 저장 (인쇄)
        </button>
        {reportText&&(<div style={{marginTop:"10px"}}>
          <div style={{fontSize:"11px",color:C.sub,marginBottom:4}}>복사 안 될 경우 아래 전체 선택 후 복사하세요</div>
          <textarea readOnly value={reportText} onClick={e=>e.target.select()}
            style={{width:"100%",height:"200px",padding:"8px",background:C.panel,border:"1px solid "+C.border,borderRadius:"8px",fontSize:"10px",fontFamily:"monospace",resize:"vertical",boxSizing:"border-box"}}/>
          <button onClick={()=>setReportText("")} style={{marginTop:4,padding:"4px 12px",fontSize:"11px",cursor:"pointer",fontFamily:"inherit",background:"transparent",border:"1px solid "+C.border,borderRadius:"6px",color:C.muted}}>닫기</button>
        </div>)}
      </div>
    </div>)}

    <button onClick={onReset} style={{width:"100%",padding:"10px",borderRadius:"8px",border:"1px solid "+C.border,background:"transparent",color:C.muted,fontSize:"12px",cursor:"pointer",fontFamily:"inherit",marginTop:4}}>
      ← 다른 학생부 분석하기
    </button>
  </div>);
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
  const[parsedText,setParsedText]=useState("");
  const fileRef=useRef();

  const runAnalysis=useCallback(async(file)=>{
    setPhase("loading");setStep(1);
    try{
      const text=await readFile(file);
      setRawText(text);setParsedText(text);setPhase("parsing");
    }catch(e){setError(e.message||"파일 읽기 오류");setPhase("error");}
  },[]);

  const handleParsingConfirm=useCallback(async(gradeInfo,text)=>{
    if(!gradeInfo){setShowManual(true);setPhase("upload");return;}
    setPhase("loading");setStep(2);
    try{
      setStep(4);const raw=await callAI(makePrompt1(text,gradeInfo,null));
      setStep(6);const data=parseAnalysis(raw,text,gradeInfo);
      data.altMajor="";data.wishMajorGroup=data.recMajorGroup;data.suplement=null;
      setResult(data);setPhase("result");
    }catch(e){setError(e.message||"분석 오류");setPhase("error");}
  },[]);

  const handleReanalyze=useCallback(async(altMajor,subjects,club)=>{
    if(!result)return;
    setIsReanalyzing(true);
    try{
      const raw=await callAI(makePrompt2(result,altMajor,subjects,club),3000);
      const hasSubjects=!!(subjects&&subjects.trim());
      const sup=parseSuplement(raw,hasSubjects);
      const wishMajorGroup=detectMajorGroup(altMajor)||result.recMajorGroup;
      setResult(prev=>({...prev,altMajor,wishMajorGroup,suplement:sup}));
    }catch(e){alert("보완사항 분석 오류: "+e.message);}
    finally{setIsReanalyzing(false);}
  },[result]);

  const drop=useCallback((e)=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)runAnalysis(f);},[runAnalysis]);
  const reset=()=>{setPhase("upload");setResult(null);setError("");setStep(0);setShowManual(false);setRawText("");setParsedText("");};

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif",color:C.text}}>
      <div style={{background:C.surface,borderBottom:"1px solid "+C.border,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:"16px",fontWeight:900,letterSpacing:"2px"}}>KAIROS 153</div>
          <div style={{fontSize:"10px",color:C.muted}}>카이로스153 · 신지은 · v11.4.5</div>
        </div>
        <div style={{fontSize:"10px",color:C.muted,textAlign:"right"}}>
          <div>학종 인문{DB_JONG_HUM.length} · 자연{DB_JONG_NAT.length}</div>
          <div>교과 인문{DB_GYOGWA_HUM.length} · 자연{DB_GYOGWA_NAT.length}</div>
        </div>
      </div>
      <div style={{maxWidth:"640px",margin:"0 auto",padding:"16px 14px 60px"}}>
        {phase==="upload"&&(<>
          <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={drop} onClick={()=>fileRef.current?.click()}
            style={{border:"2px dashed "+(drag?C.accent:C.border),borderRadius:"12px",padding:"40px 20px",textAlign:"center",cursor:"pointer",background:drag?C.aLight:C.surface,transition:"all 0.2s",marginBottom:"12px"}}>
            <input ref={fileRef} type="file" accept=".pdf,.txt" style={{display:"none"}} onChange={e=>e.target.files[0]&&runAnalysis(e.target.files[0])}/>
            <div style={{fontSize:"32px",marginBottom:"8px"}}>{drag?"📂":"📄"}</div>
            <div style={{color:C.text,fontWeight:700,fontSize:"14px",marginBottom:"4px"}}>학생부 파일 드래그 또는 클릭</div>
            <div style={{color:C.sub,fontSize:"11px"}}>PDF(나이스플러스) · TXT · 최대 30MB</div>
          </div>
          <div style={{background:C.aLight,border:"1px solid "+C.aBorder,borderRadius:"10px",padding:"12px",fontSize:"11px",color:C.accent,lineHeight:1.8,marginBottom:"10px"}}>
            <div style={{fontWeight:700,marginBottom:"3px"}}>v11.4.5 — AI 역할 최소화 · 조정내신 · 공동체 4항목 · 배지 9종 · 전공매칭 개선</div>
            <div>업로드 → 내신 파싱 확인/정정 → 분석 순서로 진행</div>
          </div>
          <button onClick={()=>setShowManual(v=>!v)} style={{width:"100%",padding:"11px",background:"transparent",border:"1px solid "+C.border,borderRadius:"10px",color:C.sub,fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>
            {showManual?"▲ 수동 입력 닫기":"▼ 파일 없이 등급 직접 입력"}
          </button>
          {showManual&&<ManualInput onAnalyze={d=>{setResult(d);setPhase("result");}}/>}
        </>)}
        {phase==="parsing"&&parsedText&&(
          <div>
            <div style={{background:C.aLight,border:"1px solid "+C.aBorder,borderRadius:"10px",padding:"10px 12px",marginBottom:"10px",fontSize:"11px",color:C.accent}}>
              📊 내신을 자동 파싱했습니다. 오류가 있으면 수정 후 분석을 시작하세요.
            </div>
            <ParsingPhase text={parsedText} onConfirm={handleParsingConfirm}/>
            <button onClick={reset} style={{width:"100%",marginTop:8,padding:"9px",background:"transparent",border:"1px solid "+C.border,borderRadius:"8px",color:C.muted,fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>
              ← 다시 업로드
            </button>
          </div>
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
