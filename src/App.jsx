import { useState, useRef, useCallback } from "react";

/*
카이로스153 생기부 분석기 v11.3  대표 컨설턴트: 신지은
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[v11.2 변경사항]
1. 입결 DB 교체 (맥에듀테크 2027 수시입결검색기, 135개 대학/6,645개)
2. Tier 판정: 절대값→nGap 정규화 (spread 기반)
3. c30 필드 완전 제거
4. suneungOk/수능전략 관련 코드 전부 제거
5. 배지 6종 (구간좁음 2단계, 특목자사, 입결변동, 전형변동)
6. 고교유형 DB 연동 (db_school_type.js, 144개 대학)
7. 보완사항: 동아리 입력 추가, 수능전략 제거
8. 내신 수동입력=새데이터, 신뢰도 표시
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*/

// ── 여대 목록 ──────────────────────────────────────────────────────
const WOMENS_UNIV = new Set(["이화여대","숙명여대","성신여대","덕성여대","서울여대"]);

// ── 22개 전공 그룹 매핑 ────────────────────────────────────────────
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

// ── 내신 파싱 (v11.3 실제 생기부 구조 기반) ─────────────────────
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

  for(let i=0; i<lines.length; i++){
    const line = lines[i];

    // 학기 감지: "1" 또는 "2" 단독 라인 + 다음이 교과명(숫자 아님)
    if(/^[12]$/.test(line) && i+1<lines.length && !/^\d+$/.test(lines[i+1])){
      currentSem = line;
      continue;
    }

    // 성취도(수강자수) 패턴: A(257), B(108), C(246), D(257), E(246)
    // 9등급: A~E / 5등급: A~E (동일)
    const am = line.match(/^([A-E])\((\d+)\)$/);
    if(am){
      const achieve = am[1];
      // P 과목 제외
      if(achieve === "P") continue;
      // 다음 라인이 등급
      if(i+1 >= lines.length) continue;
      const gradeStr = lines[i+1];
      if(!/^\d+(\.\d+)?$/.test(gradeStr)) continue;
      const grade = parseFloat(gradeStr);
      if(grade < 1 || grade > maxG) continue;

      // 역방향으로 학점수 탐색
      let unit = null;
      let subject = "";
      for(let j=i-1; j>=Math.max(0,i-6); j--){
        if(/^[1-8]$/.test(lines[j])){
          unit = parseInt(lines[j]);
          // 과목명: 학점수 바로 앞 라인
          if(j-1>=0 && !/^[12]$/.test(lines[j-1]) && !/^[1-8]$/.test(lines[j-1])){
            subject = lines[j-1];
          }
          break;
        }
      }
      if(!unit) continue;

      subjects.push({
        sem: currentSem,
        subject,
        unit,
        achieve,
        grade,
        manual: false,
      });
      i++; // 등급 라인 건너뛰기
    }
  }

  if(subjects.length < 3) return null;

  const aCount = subjects.filter(s=>s.achieve==="A").length;
  const aRatio = Math.round(aCount/subjects.length*100)/100;
  const achieveBonus = aRatio>=0.6?-0.2:aRatio>=0.4?-0.1:0;
  const totalUnits = subjects.reduce((s,r)=>s+r.unit,0);
  const rawAvg = Math.round(subjects.reduce((s,r)=>s+r.unit*r.grade,0)/totalUnits*100)/100;
  const byGroup = calcSubjectGroups(subjects);

  return {
    rawAvg, achieveBonus,
    avg: Math.round((rawAvg+achieveBonus)*100)/100,
    gradeSystem, admitYear: detected.year,
    subjects, aCount, aRatio, byGroup,
    confidence: subjects.length>=10?0.92:subjects.length>=5?0.80:0.65,
    manualCount: 0, is5,
  };
}

// ── ParsingPhase: 내신 파싱 확인/정정 단계 (v11.3 신규) ──────────
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
      gradeSystem,
      selectedKey:calcMode,
      selectedAvg:selectedAvg?.toFixed(2)||parsed.rawAvg.toFixed(2),
      byGroup,achieveBonus,aCount,subjects,
    },text);
  };

  return(
    <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:"12px",padding:"16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
        <div style={{fontSize:"13px",fontWeight:700,color:C.text}}>📊 내신 파싱 결과 확인</div>
        <div style={{fontSize:"10px",color:C.muted}}>신뢰도 {confDisplay}% {manualCount>0?"("+manualCount+"과목 수동)":""}</div>
      </div>
      {/* 등급제 */}
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
      {/* 파싱 테이블 */}
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
      {/* 계산 기준 */}
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
            <div style={{fontSize:"10px",color:C.muted,marginTop:4}}>
              선택 평균: {selSubjects.length>0?calcCustom(subjects,selSubjects)?.toFixed(2)||"–":"–"}
            </div>
          </div>
        )}
      </div>
      {/* 계산 결과 */}
      <div style={{background:C.panel,borderRadius:"8px",padding:"10px 12px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:"12px",fontWeight:700,color:C.text}}>
            적용 등급 ({calcMode}): <span style={{color:C.accent,fontSize:"15px"}}>{selectedAvg?.toFixed(2)||"–"}</span>
          </span>
          <span style={{fontSize:"10px",color:C.muted}}>성취도 A: {aRatio}% → 보정 {achieveBonus}</span>
        </div>
        <div style={{fontSize:"10px",color:C.sub,lineHeight:1.8}}>
          전과목 {byGroup.전과목?.toFixed(2)||"–"} |
          국영수사과 {byGroup.국영수사과?.toFixed(2)||"–"} |
          국영수사 {byGroup.국영수사?.toFixed(2)||"–"} |
          국영수과 {byGroup.국영수과?.toFixed(2)||"–"}
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
  if(["영재학교","한국과학영재"].some(k=>text.includes(k))) return "영재고";
  if(["과학고"].some(k=>text.includes(k))) return "과학고";
  if(["외국어고","외고"].some(k=>text.includes(k))) return "외고";
  if(["국제고"].some(k=>text.includes(k))) return "국제고";
  if(["자율형사립고","자사고","민족사관","하나고","상산고","현대청운","포항제철","김천고","북일고","광양제철"].some(k=>text.includes(k))) return "자사고";
  return "일반고";
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

// ── nGap Tier 상수 (새 엑셀 데이터 검증값) ────────────────────────
const SPREAD_MIN = 0.15;
const TIER_THRESHOLD = { 안정:-0.3, 적정:0.3, 소신:0.7, 상향:1.2 };
const C50_RANGE = 1.5;  // 표시 범위 제한 (안정 과다 방지)

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

// ── nGap 기반 Tier 판정 ────────────────────────────────────────────
function calcNGap(grade, c, c70){
  const spread = Math.max(c70 - c, SPREAD_MIN);
  return (grade - c) / spread;
}
function calcJongTier(grade, c, c70, achieveBonus=0){
  const g = parseFloat(grade) + achieveBonus;
  const ng = calcNGap(g, c, c70);
  if(ng <= TIER_THRESHOLD.안정) return "안정";
  if(ng <= TIER_THRESHOLD.적정) return "적정";
  if(ng <= TIER_THRESHOLD.소신) return "소신";
  if(ng <= TIER_THRESHOLD.상향) return "상향";
  return "제외";
}
function calcGyogwaTier(grade, c, c70){
  // 교과: 원래 등급 그대로 (성취도 보정 미적용)
  const ng = calcNGap(parseFloat(grade), c, c70);
  if(ng <= TIER_THRESHOLD.안정) return "안정";
  if(ng <= TIER_THRESHOLD.적정) return "적정";
  if(ng <= TIER_THRESHOLD.소신) return "소신";
  if(ng <= TIER_THRESHOLD.상향) return "상향";
  return "제외";
}

// ── 캠퍼스 base 대학명 추출 (dedup용) ────────────────────────────
function getBaseUniv(u){
  return u.replace(/\(서울\)|\(죽전\)|\(에리카\)|\(글로컬\)|\(WISE\)|\(세종\)|\(원주\)|\(안성\)|\(글로벌\)|\(천안\)|\(의정부\)|\(성남\)|\(다빈치\)/g,'').trim();
}

// ── 학종 합격가능성 (세특 가중치만, 수능최저 제거) ────────────────
// poss는 원래 등급 기준 (학교군 보정 미적용 → tier와 역할 분리)
// 수능최저는 UniCard에서 텍스트만 표시
function calcJongPoss(grade, sebu, c, c70){
  const g=parseFloat(grade);
  if(!isFinite(g)||!c) return 1;
  const diff=g-c;
  let ns;
  if(diff<=-0.3) ns=5; else if(diff<=0.3) ns=4; else if(diff<=0.8) ns=3;
  else if(diff<=1.3) ns=2; else ns=1;
  const sm={탁월:5,우수:4,보통:3,빈약:2};
  let base=ns*0.4+(sm[sebu]||3)*0.6;
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

// ── buildJongRecs: 학종 추천 (nGap 기반) ──────────────────────────
function buildJongRecs(grade, sebu, gyeyeol, gender, majorGroup, achieveBonus=0, strongSide=null){
  const db = getJongDB(gyeyeol);
  const g = parseFloat(grade);
  const filtered = db.filter(r =>
    !(gender==="남" && WOMENS_UNIV.has(r.u)) &&
    r.c >= g - C50_RANGE && r.c <= g + C50_RANGE
  );
  const scored = filtered.map(r => {
    const tier = calcJongTier(g, r.c, r.c70, achieveBonus);
    if(tier === "제외") return null;
    const ng = calcNGap(g + achieveBonus, r.c, r.c70);
    const majorMatch = majorGroup ? isMajorMatch(r.m, majorGroup.matchTerms) : false;
    const poss = calcJongPoss(grade, sebu, r.c, r.c70);
    const ew=getEvalWeight(r.u,r.t);
    const evalScore=(ew&&strongSide)?(ew[strongSide]||0):0;
    return {...r, tier, ng: Math.round(ng*100)/100, diff: g-r.c, majorMatch, poss, evalScore};
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
    (b.evalScore||0)-(a.evalScore||0) ||
    (to[a.tier]||3)-(to[b.tier]||3) ||
    b.poss-a.poss || a.c-b.c
  );
  // majorGroup 있을 때 → 전공 매칭된 학과만 표시 (Option A)
  const display = majorGroup
    ? all.filter(r=>r.majorMatch)
    : all;

  return {
    안정: display.filter(r=>r.tier==="안정").slice(0,10),
    적정: display.filter(r=>r.tier==="적정").slice(0,10),
    소신: display.filter(r=>r.tier==="소신").slice(0,10),
    상향: display.filter(r=>r.tier==="상향").slice(0,5),
    all: display,
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

// ── AI 시스템 프롬프트 ─────────────────────────────────────────────
const SYS="당신은 대한민국 최고의 입학사정관이자 입시 전문 컨설턴트입니다. 반드시 아래 형식으로만 응답하세요. JSON 금지. 마크다운 금지. 각 항목은 항목명:: 으로 시작. 배열은 ◆ 기호 구분. 팩트 항목은 지정된 값만 출력. 확언 금지. 수능 판단 금지. 근거 기반(생기부 실제 기재 내용만). 과장 수치 금지.";

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

강점역량::학업/진로/공동체 중 세특 기재 내용 근거로 가장 두드러진 역량 하나
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
세특수준: ${analysisResult.facts.sebuLevel}
진로일관성: ${analysisResult.facts.careerConsistency}

${subjects
  ?`추천전공세특::이수 예정 과목별 각각 세특 탐구 방향 (과목명:제안 형식 ◆ 구분)
${altMajor?`희망전공세특::변경 고려 전공 "${altMajor}" 기준 이수 예정 과목별 세특 탐구 방향 (과목명:제안 형식 ◆ 구분)`:"희망전공세특::해당없음"}`
  :`추천전공세특::추천 전공 연계 세특 방향 ◆ 3개
${altMajor?`희망전공세특::변경 고려 전공 "${altMajor}" 연계 세특 방향 ◆ 3개`:"희망전공세특::해당없음"}`
}
${club?`창체방향::${club} 동아리에서 전공 연계 활동 방향 2문장`:`창체방향::전공 연계 가능한 동아리 유형 추천 2문장 (특정 동아리명 지정 금지)`}`;
}

// ── 내신 파싱 v11.3으로 교체 (위 신규 블록 참조) ──

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
  const parsed=parseGradesFromText(text);
  const gradeAll=gradeInfo
    ?String(gradeInfo.selectedAvg)
    :(()=>{
      const nums=(s("내신추이","").match(/\d+\.\d+/g)||[]).map(Number).filter(n=>n>0&&n<9);
      return nums.length?String(Math.round(nums.reduce((a,b)=>a+b,0)/nums.length*100)/100):"3.0";
    })();
  const sebuLevel=s("세부수준","보통");
  const careerConsistency=s("진로일관성수준","부분일관");
  const leadershipLevel=s("리더십수준","없음");
  const strongSide=(()=>{const v=s("강점역량","진로").trim();if(v.includes("학업"))return"academic";if(v.includes("공동체"))return"community";return"career";})();
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
    name:s("이름","미확인"),gender,school:s("학교"),strongSide,
    schoolType:detectSchoolType(text),계열,지망전공,
    recMajorGroup,
    facts:{gradeAll,sebuLevel,careerConsistency,leadershipLevel,
           parseInfo:gradeInfo?`확정등급(${gradeInfo.selectedKey}/${gradeInfo.subjects?.length||0}과목,A${gradeInfo.aCount||0}개)`:"추이기반추정",
           achieveBonus:gradeInfo?.achieveBonus||0,
           gradeSystem:gradeInfo?.gradeSystem||"9등급",
           byGroup:gradeInfo?.byGroup||{}},
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
    rec:{type:s("추천전형","종합"),reason:s("전형이유"),
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
  const hasSubjects=arguments[1]||false;
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

// ── getBadges: 배지 6종 ────────────────────────────────────────────
function getBadges(r){
  const badges=[];
  const spread=r.c70-r.c;
  // ① 수능최저
  if(r.s27&&r.s27!=="없음") badges.push({type:"suneung",label:"수능최저",
    tip:`수능최저: ${r.s27}`,bg:"#fff1f2",tc:"#e11d48"});
  // ② 구간좁음 (2단계)
  if(spread<0.25) badges.push({type:"tight2",label:"⚠️구간매우좁음",
    tip:"합격 구간 매우 좁음 (spread<0.25). 내신이 컷에 근접해야 유리",bg:"#fef9c3",tc:"#854d0e"});
  else if(spread<0.40) badges.push({type:"tight1",label:"⚠️구간좁음",
    tip:"합격 구간 좁음 (spread<0.40). 내신 편차 주의",bg:"#fef9c3",tc:"#a16207"});
  // ③ 고교유형 텍스트 표기 (v11.3 신호등→텍스트)
  const st=SCHOOL_TYPE_RATIO[r.u];
  if(st){
    const schoolType=arguments[1]||"일반고";
    const fieldMap={"일반고":"일반고","자사고":"자사고","외고":"외고","국제고":"국제고","과학고":"과학고","영재고":"영재고"};
    const field=fieldMap[schoolType]||"일반고";
    const pct=st[field]??st["일반고"]??0;
    const label=schoolType==="일반고"
      ?`일반고 ${st.일반고||0}% · 특목자사 ${st.특목자사||0}%`
      :`일반고 ${st.일반고||0}% · ${schoolType} ${pct}%`;
    const tip=`일반고 ${st.일반고||0}% · 과학고 ${st.과학고||0}% · 외고 ${st.외고||0}% · 국제고 ${st.국제고||0}% · 자사고 ${st.자사고||0}% · 영재고 ${st.영재고||0}%`;
    const tc=pct<5?"#e11d48":pct<15?"#92400e":"#475569";
    const bg=pct<5?"#fff1f2":pct<15?"#fef9c3":"#f8fafc";
    badges.push({type:"school",label,tip,bg,tc});
  }
  // ④ 작년 입결 주의
  if(r.avg&&r.c>r.avg+0.45) badges.push({type:"warn",label:"⚠️작년입결주의",
    tip:"작년에 낮은 등급도 합격한 전형. 작년 50컷 기준 지원 결정 시 위험. 4개년 평균 및 전형 구조 변경 확인 권장",bg:"#fff7ed",tc:"#c2410c"});
  // ⑤ 작년 입결 참고
  if(r.avg&&r.c<r.avg-0.45) badges.push({type:"ref",label:"💡작년입결참고",
    tip:"작년에 높은 등급만 합격한 전형. 작년 50컷보다 성적 불리해도 지원 고려 가능. 4개년 평균 및 전형 구조 변경 확인 권장",bg:"#f0fdf4",tc:"#15803d"});
  // ⑥ 전형변동
  if(r.chg) badges.push({type:"chg",label:"⚡전형변동",
    tip:`2027 변경: ${r.chg} / 최신 모집요강 직접 확인 필요`,bg:"#f5f3ff",tc:"#6d28d9"});
  // ⑦ 면접전형 (v11.3 신규)
  const isInterview=r.method?.includes("면접")||r.t?.includes("면접형")||r.t?.includes("면접");
  if(isInterview) badges.push({type:"interview",label:"🎤면접",
    tip:"면접 포함 전형. 면접 준비 별도 필요",bg:"#eff6ff",tc:"#1d4ed8"});
  return badges;
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
        {r.avg&&<span style={{marginLeft:6,color:C.muted}}>평균 {r.avg?.toFixed(2)}</span>}
        {r.c70est&&<span style={{marginLeft:4,fontSize:"9px",color:C.muted}}>(c70추정)</span>}
      </div>
      {(r.chasu!=null||r.compet!=null||r.volatility||r.trend)&&(
        <div style={{fontSize:"10px",color:C.sub,lineHeight:1.8,marginTop:2}}>
          {r.chasu!=null&&r.n&&<span style={{marginRight:8}}>추합률 {Math.round(r.chasu/r.n*100)}%</span>}
          {r.compet!=null&&<span style={{marginRight:8}}>경쟁률 {r.compet}:1</span>}
          {r.volatility&&<span style={{marginRight:8}}>변동성 {r.volatility}</span>}
          {r.trend&&<span>추세 {r.trend}</span>}
        </div>
      )}
      {badges.filter(b=>["tight2","tight1","warn","ref","chg"].includes(b.type)).map((b,bi)=>(
        <div key={bi} style={{fontSize:"10px",color:b.tc,marginTop:"3px",background:b.bg,borderRadius:"6px",padding:"3px 8px",lineHeight:1.5}}>{b.tip}</div>
      ))}
      {(() => {
        const ew = getEvalWeight(r.u, r.t);
        return ew ? (
          <div style={{fontSize:"10px",color:C.violet,marginTop:3,lineHeight:1.6}}>
            평가비율: 학업{ew.academic} / 진로{ew.career} / 공동체{ew.community}
            {ew.note&&" ("+ew.note+")"}
            <span style={{marginLeft:4,color:C.muted,fontSize:"9px"}} title="평가 비율이 높다고 합격 가능성이 높은 것은 아님. 실제 평가는 정성적으로 이루어지며 이 순서는 참고용입니다">ⓘ참고</span>
          </div>
        ) : null;
      })()}
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
    const scores=calcScores(grade,sebu,career,leader);
    const total=calcTotal(scores);
    const rmg=detectMajorGroup(지망);
    onAnalyze({
      name:"수동입력",gender:gen,school:"",schoolType:"일반고",계열:gyeyeol,지망전공:지망,
      recMajorGroup:rmg,wishMajorGroup:rmg,altMajor:"",
      facts:{gradeAll:grade,sebuLevel:sebu,careerConsistency:career,leadershipLevel:leader,parseInfo:"수동입력",achieveBonus:0},
      grade:{all:grade,trend:"",bySubject:[]},
      combo:{good:"",bad:"",sim:""},진로별유불리:"",
      scores,total,gradeLabels:{학업:gradeLabel(scores.학업),진로:gradeLabel(scores.진로),공동체:gradeLabel(scores.공동체)},
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
  const[gyeyeolFilter,setGyeyeolFilter]=useState("전체");
  const[searchPage,setSearchPage]=useState(1);
  const PAGE_SIZE=50;
  const GYEYEOL_TABS=["전체","인문","자연","통합"];

  const achieveBonus=d.facts?.achieveBonus||0;
  const wishMajorGroup=d.altMajor?detectMajorGroup(d.altMajor)||d.wishMajorGroup:d.wishMajorGroup;
  const jongRecRecs=buildJongRecs(d.facts.gradeAll,d.facts.sebuLevel,d.계열,d.gender,d.recMajorGroup,achieveBonus,d.strongSide);
  const jongWishRecs=buildJongRecs(d.facts.gradeAll,d.facts.sebuLevel,d.계열,d.gender,wishMajorGroup,achieveBonus,d.strongSide);
  const gyogwaRecs=buildGyogwaRecs(d.facts.gradeAll,d.계열,d.gender);

  // 입결 검색
  const jongDB=getJongDB(d.계열); const gyogwaDB=getGyogwaDB(d.계열);
  const allDb=[...jongDB,...gyogwaDB];
  const searchResults=searchQ.length>=2?allDb.filter(r=>
    (gyeyeolFilter==="전체"||r.g===gyeyeolFilter)&&
    (r.u.includes(searchQ)||r.m.includes(searchQ)||r.t.includes(searchQ))
  ):[];

  // 리포트
  const copyReport=()=>{
    const L=[];
    L.push("KAIROS 153 · 카이로스153 대입컨설팅 · 2027학년도 · v11.3");
    L.push(`학생: ${d.name}${d.gender?" ("+d.gender+")":""} | ${d.school||""} [${d.schoolType}] | ${d.계열}`);
    L.push(`내신: ${d.facts.gradeAll}등급 [${d.facts.parseInfo}] 등급제: ${d.facts.gradeSystem||"9등급"}`);
    if(d.facts.byGroup&&Object.keys(d.facts.byGroup).some(k=>d.facts.byGroup[k])){
      const bg=d.facts.byGroup;
      L.push(`성적기준: 전과목 ${bg.전과목||"–"} / 국영수사과 ${bg.국영수사과||"–"} / 국영수사 ${bg.국영수사||"–"} / 국영수과 ${bg.국영수과||"–"}`);
    }
    L.push(`세특: ${d.facts.sebuLevel} | 진로: ${d.facts.careerConsistency} | 리더십: ${d.facts.leadershipLevel}`);
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
          세특 <b>{d.facts.sebuLevel}</b> · 진로 <b>{d.facts.careerConsistency}</b> · 리더십 <b>{d.facts.leadershipLevel}</b>
          · 강점역량 <b style={{color:C.accent}}>{d.strongSide==="academic"?"학업":d.strongSide==="community"?"공동체":"진로"}</b>
          {d.facts.achieveBonus<0&&<span style={{color:C.green,marginLeft:6}}>· 성취도보정 {d.facts.achieveBonus}</span>}
      </div>
      {d.facts.byGroup&&Object.keys(d.facts.byGroup).some(k=>d.facts.byGroup[k])&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:"8px"}}>
          {Object.entries(d.facts.byGroup).filter(function(e){return e[1]!=null;}).map(function(e){const k=e[0],v=e[1]; return(
            <div key={k} style={{background:C.panel,border:"1px solid "+C.border,borderRadius:"6px",padding:"3px 8px",fontSize:"10px"}}>
              <span style={{color:C.muted}}>{k} </span><b style={{color:C.accent}}>{v}</b>
            </div>
          );})}
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
          {[["🔬 세특 진단",d.analysis.sebu],["🎯 진로 일관성",d.analysis.career],["🏆 리더십",d.analysis.leader]].filter(([_,v])=>v).map(([t,c])=>(
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
              {d.suplement.추천전공세특?.length>0&&<div style={{background:C.aLight,border:"1px solid "+C.aBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
                <div style={{fontSize:"11px",fontWeight:700,color:C.accent,marginBottom:"6px"}}>📌 추천전공 세특 방향 {d.suplement.hasSubjects?"(이수과목별)":""}</div>
                {d.suplement.추천전공세특.map((s,i)=><div key={i} style={{fontSize:"12px",color:C.text,lineHeight:1.7,marginBottom:3}}>• {s}</div>)}
              </div>}
              {d.altMajor&&d.suplement.희망전공세특?.length>0&&d.suplement.희망전공세특[0]!=="해당없음"&&
                <div style={{background:C.violetLight,border:"1px solid "+C.violetBorder,borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
                  <div style={{fontSize:"11px",fontWeight:700,color:C.violet,marginBottom:"6px"}}>📌 희망전공 세특 방향 {d.suplement.hasSubjects?"(이수과목별)":""} ({d.altMajor})</div>
                  {d.suplement.희망전공세특.map((s,i)=><div key={i} style={{fontSize:"12px",color:C.text,lineHeight:1.7,marginBottom:3}}>• {s}</div>)}
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
            <input type="text" value={searchQ} onChange={e=>{setSearchQ(e.target.value);setSearchPage(1);}} placeholder="대학명·학과명·전형명 (2글자 이상)"
              style={{width:"100%",padding:"9px 12px",background:C.panel,border:"1px solid "+C.border,borderRadius:"8px",color:C.text,fontSize:"13px",fontFamily:"inherit",boxSizing:"border-box",marginBottom:"10px"}}/>
            <div style={{display:"flex",gap:5,margin:"8px 0"}}>
              {GYEYEOL_TABS.map(g=>(
                <button key={g} onClick={()=>{setGyeyeolFilter(g);setSearchPage(1);}}
                  style={{padding:"4px 10px",borderRadius:"20px",fontSize:"11px",cursor:"pointer",fontFamily:"inherit",
                    background:gyeyeolFilter===g?C.accent:C.panel,color:gyeyeolFilter===g?"white":C.sub,
                    border:"1px solid "+(gyeyeolFilter===g?C.accent:C.border)}}>
                  {g}
                </button>
              ))}
            </div>
            {searchQ.length>=2&&<div style={{fontSize:"10px",color:C.muted,marginBottom:6}}>검색결과 {searchResults.length}개</div>}
            {searchQ.length>=2&&searchResults.length===0&&<div style={{color:C.muted,fontSize:"12px",textAlign:"center",padding:"20px"}}>검색 결과 없음</div>}
            {searchResults.slice(0, PAGE_SIZE*searchPage).map((r,i)=>(
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
                  {r.avg&&<span>평균 {r.avg?.toFixed(2)}</span>}
                  {r.chasu!=null&&r.n&&<span style={{marginLeft:6}}>추합률 {Math.round(r.chasu/r.n*100)}%</span>}
                  {r.compet!=null&&<span style={{marginLeft:6}}>경쟁률 {r.compet}:1</span>}
                  {r.volatility&&<span style={{marginLeft:6}}>변동성 {r.volatility}</span>}
                  {r.trend&&<span style={{marginLeft:6}}>추세 {r.trend}</span>}
                </div>
                {r.s27&&r.s27!=="없음"&&<div style={{fontSize:"10px",color:C.rose,marginTop:3,background:C.roseLight,borderRadius:"4px",padding:"2px 6px"}}>수능최저: {r.s27.slice(0,70)}</div>}
              </div>
            ))}
            {searchResults.length > PAGE_SIZE*searchPage&&(
              <button onClick={()=>setSearchPage(p=>p+1)}
                style={{width:"100%",marginTop:8,padding:"9px",background:C.panel,border:"1px solid "+C.border,borderRadius:"8px",color:C.sub,fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>
                더보기 ({PAGE_SIZE*searchPage}/{searchResults.length})
              </button>
            )}
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
              ["추천전공 세특 방향",d.suplement?.추천전공세특?.length>0],
              ["희망전공 세특 방향",!!(d.altMajor&&d.suplement?.희망전공세특?.length>0)],
              ["창체·동아리 방향",!!d.suplement?.창체],
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
    return(
      <div style={{marginBottom:"12px"}}>
        <div style={{fontWeight:700,fontSize:"11pt",borderBottom:"1px solid #e2e8f0",paddingBottom:"3px",marginBottom:"6px"}}>
          {label} ({items.length}개)
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"9pt"}}>
          <thead>
            <tr style={{background:"#f8fafc"}}>
              {["대학","전형","학과","50%컷","70%컷","수능최저"].map(h=>(
                <th key={h} style={{padding:"3px 5px",textAlign:"left",border:"1px solid #e2e8f0",fontSize:"8pt"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((r,i)=>(
              <tr key={i} style={{borderBottom:"1px solid #e2e8f0",background:i%2===0?"#fff":"#f8fafc"}}>
                <td style={{padding:"3px 5px",fontWeight:700,border:"1px solid #e2e8f0"}}>
                  {r.u}{r.gapType==="촘촘"&&<span style={{marginLeft:3,fontSize:"7pt",color:"#854d0e"}}>⚠️</span>}
                </td>
                <td style={{padding:"3px 5px",fontSize:"8pt",border:"1px solid #e2e8f0"}}>{r.t}</td>
                <td style={{padding:"3px 5px",color:"#1d4ed8",border:"1px solid #e2e8f0"}}>
                  {majorGroup&&r.majorMatch?majorGroup.recMajor:r.m}
                </td>
                <td style={{padding:"3px 5px",textAlign:"center",border:"1px solid #e2e8f0"}}>{r.c?.toFixed(2)}</td>
                <td style={{padding:"3px 5px",textAlign:"center",border:"1px solid #e2e8f0"}}>{r.c70?.toFixed(2)}</td>
                <td style={{padding:"3px 5px",fontSize:"7pt",border:"1px solid #e2e8f0"}}>
                  {r.s27&&r.s27!=="없음"?r.s27.slice(0,25):"없음"}
                </td>
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
          {d.facts.achieveBonus<0&&` (성취도보정 ${d.facts.achieveBonus})`}
        </p>
        {d.analysis.trend&&<p style={{margin:"2px 0",fontSize:"10pt"}}>성적추이: {d.analysis.trend}</p>}
        {d.지망전공&&<p style={{margin:"2px 0",fontSize:"10pt"}}>지망전공: {d.지망전공}{d.altMajor&&` → 변경고려: ${d.altMajor}`}</p>}
        <div style={{display:"flex",gap:"10px",margin:"8px 0",padding:"8px",background:"#f8fafc",borderRadius:"6px"}}>
          <div>학업역량: <b>{d.gradeLabels.학업}</b> ({d.scores.학업})</div>
          <div>진로역량: <b>{d.gradeLabels.진로}</b> ({d.scores.진로})</div>
          <div>공동체역량: <b>{d.gradeLabels.공동체}</b> ({d.scores.공동체})</div>
          <div>종합: <b>{d.total}/100</b></div>
        </div>
      </div>

      {/* ── 2페이지: AI 분석 ── */}
      <div className="print-page page-break">
        {/* AI 분석 결과 헤더 제거 v11.3 */}
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
          {d.suplement.추천전공세특?.length>0&&<><h4>추천전공 세특 방향{d.suplement.hasSubjects?" (이수과목별)":""}</h4>{d.suplement.추천전공세특.map((s,i)=><p key={i}>• {s}</p>)}</>}
          {d.altMajor&&d.suplement.희망전공세특?.length>0&&<><h4>희망전공 세특 방향{d.suplement.hasSubjects?" (이수과목별)":""} ({d.altMajor})</h4>{d.suplement.희망전공세특.map((s,i)=><p key={i}>• {s}</p>)}</>}
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
      setRawText(text);
      setParsedText(text);
      setPhase("parsing");
    }catch(e){setError(e.message||"파일 읽기 오류");setPhase("error");}
  },[]);
  const handleParsingConfirm=useCallback(async(gradeInfo,text)=>{
    // 파싱 실패 → 수동입력 화면으로 전환
    if(!gradeInfo){
      setShowManual(true);
      setPhase("upload");
      return;
    }
    setPhase("loading");setStep(2);
    try{
      setStep(4);const raw=await callAI(makePrompt1(text,gradeInfo));
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
      {/* 상단 바 */}
      <div style={{background:C.surface,borderBottom:"1px solid "+C.border,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:"16px",fontWeight:900,letterSpacing:"2px"}}>KAIROS 153</div>
          <div style={{fontSize:"10px",color:C.muted}}>카이로스153 · 신지은 · v11.3</div>
        </div>
        <div style={{fontSize:"10px",color:C.muted,textAlign:"right"}}>
          <div>학종 인문{DB_JONG_HUM.length} · 자연{DB_JONG_NAT.length}</div>
          <div>교과 인문{DB_GYOGWA_HUM.length} · 자연{DB_GYOGWA_NAT.length}</div>
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
              <div style={{fontWeight:700,marginBottom:"3px"}}>v11.3 — 파싱 확인 · 5개년 지표 · 배지 7종 · 26개 전공</div>
              <div>업로드 → 내신 파싱 확인/정정 → 분석 순서로 진행</div>
              <div>학종: 추합률·경쟁률·변동성·추세 · 강점역량 매칭 정렬</div>
            </div>
            <button onClick={()=>setShowManual(v=>!v)} style={{width:"100%",padding:"11px",background:"transparent",border:"1px solid "+C.border,borderRadius:"10px",color:C.sub,fontSize:"12px",cursor:"pointer",fontFamily:"inherit"}}>
              {showManual?"▲ 수동 입력 닫기":"▼ 파일 없이 등급 직접 입력"}
            </button>
            {showManual&&<ManualInput onAnalyze={d=>{setResult(d);setPhase("result");}}/>}
          </>
        )}

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
