(() => {
  'use strict';
  const research = window.MOA_RESEARCH;
  if (!research || !Array.isArray(research.cases) || research.cases.length !== 20) {
    document.body.prepend(document.createTextNode('연구 예시 자료를 불러오지 못했습니다. 파일들을 함께 복사했는지 확인해 주세요.'));
    return;
  }
  const byId = Object.fromEntries(research.cases.map(c => [c.id,c]));
  const $ = id => document.getElementById(id);
  const state = {id:'Q11',condition:'A',mode:'base'};
  const TYPE = {S:'답변 가능',U:'정보 확인 필요',M:'일부 답변 가능'};
  const CONTEXT = {Q09:['F01'],Q10:['F04','F05'],Q11:['F02','F10'],Q12:['F02','F10'],Q13:['F03'],Q14:['F06'],Q15:['F07'],Q16:['F08'],Q17:['F01'],Q18:['F02','F10'],Q19:['F03'],Q20:['F08']};
  const safeSpecial = {
    Q11:'공식 안내문에는 최종 프로젝트의 세부 진행 방식이 아직 정리되지 않았다고 되어 있습니다. 한 팀의 구성 인원은 공식 안내문만으로 확인할 수 없어 정보 확인이 필요합니다.',
    Q18:'공식 안내문에 따르면 최종 프로젝트의 세부 진행 방식은 아직 문서에 정리되지 않았습니다. 팀원 수는 안내문으로 확인할 수 없어 정보 확인이 필요합니다.',
    Q02:'공식 안내문에 따르면 최종 프로젝트의 세부 진행 방식은 아직 문서에 정리되지 않았습니다.',
    Q12:'공식 안내문에는 최종 프로젝트의 세부 진행 방식이 아직 정리되지 않았다고 되어 있습니다. 발표 날짜와 시간은 공식 안내문만으로 확인할 수 없어 정보 확인이 필요합니다.'
  };
  function normalize(v){return String(v||'').trim().replace(/\s+/g,' ');}
  function caseNow(){return byId[state.id];}
  function setText(id,value){$(id).textContent=value;}
  function elem(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;}
  function questionOptions(){
    const groups={S:elem('optgroup'),U:elem('optgroup'),M:elem('optgroup')};
    groups.S.label='S · 답변 가능 (8개)';groups.U.label='U · 확인 필요 (8개)';groups.M.label='M · 일부만 답변 가능 (4개)';
    research.cases.forEach(c=>{const o=elem('option','',`${c.id} · ${c.question}`);o.value=c.id;groups[c.type].append(o);});
    $('questionSelect').replaceChildren(groups.S,groups.U,groups.M);
  }
  function contentLabel(){
    const c=caseNow(),v=$('draft').value;
    $('charCount').textContent=`${v.length} / 4000자`;
    const which=['A','B'].find(x=>normalize(c.versions[x].answer)===normalize(v));
    $('answerOrigin').textContent=which?`논문 실제 응답 ${which}`:'직접 편집한 답변';
    return which||null;
  }
  function drawFacts(c){
    const ids=[...new Set([...(c.fact_ids||[]),...(CONTEXT[c.id]||[])])];
    const out=[];
    if(!ids.length){out.push(elem('div','fact-item','이 질문의 답을 직접 뒷받침하는 안내 항목이 없습니다.'));}
    for(const id of ids){const item=elem('div','fact-item');item.append(elem('strong','',id),elem('span','',research.facts[id]));out.push(item);}
    for(const unknown of c.unknown){const item=elem('div','fact-item unspecified');item.append(elem('strong','','미확인'),elem('span','',`${unknown} · 공식 문서에 없음`));out.push(item);}
    $('facts').replaceChildren(...out);
  }
  function clearResult(){
    $('resultIntro').hidden=false;$('resultContent').hidden=true;
    $('resultState').textContent='점검 대기';$('resultState').className='result-state';$('inputError').hidden=true;
  }
  function setCondition(c){
    state.condition=c;
    document.querySelectorAll('[data-condition]').forEach(b=>{const active=b.dataset.condition===c;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    $('draft').value=caseNow().versions[c].answer;
    contentLabel();clearResult();
  }
  function changeCase(id){
    if(!byId[id]){setText('inputError','선택한 문의를 찾지 못했습니다.');$('inputError').hidden=false;return;}
    state.id=id;
    const c=caseNow();
    $('questionSelect').value=id;
    document.querySelectorAll('[data-case]').forEach(b=>{const active=b.dataset.case===id;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
    setText('questionLabel',`교육생 문의 · ${id} · ${TYPE[c.type]}`);
    setText('questionText',c.question);
    drawFacts(c);
    setCondition('A');
  }
  function safeAnswer(c){
    if(safeSpecial[c.id])return safeSpecial[c.id];
    const verified=(c.fact_ids||[]).map(id=>research.facts[id]).filter(Boolean);
    const documented=verified.length?`공식 안내문에 따르면 ${verified.join(' ')}`:'';
    const unknown=c.unknown.length?`문의하신 ${c.unknown.join(' 및 ')}는 제공된 공식 안내문으로 확인할 수 없어 정보 확인이 필요합니다.`:'';
    return [documented,unknown].filter(Boolean).join(' ') || '공식 안내문에서 확인되지 않는 문의입니다. 해당 내용은 정보 확인이 필요합니다.';
  }
  function warningPatterns(t,c){
    const issues=[];
    function add(term,why){if(issues.some(x=>x.term===term))return;issues.push({term,why});}
    // 규칙 기반 표시, 의미·의도 판정 불가. 프로젝트 관련 공지와 F10의 일정 공지는 분리한다.
    const sentences=t.split(/(?<=[.!?。])\s+|\n+/).map(s=>s.trim()).filter(Boolean);
    for (const sentence of sentences){
      if((['Q02','Q11','Q12','Q18'].includes(c.id)) && /(?:안내해\s*드리겠습니다|안내해드리겠습니다|안내하겠습니다|별도(?:로)?\s*안내|공지(?:될|할)\s*예정|공지하겠습니다|정리되면.*(?:안내|공지)|확정되면.*(?:안내|공지)|안내해\s*드릴\s*예정)/.test(sentence))add(sentence,'문서에 없는 후속 안내 시행·공지 약속일 수 있습니다. F02는 세부 진행 방식이 아직 문서화되지 않았다는 사실만 규정합니다.');
      if((['Q02','Q11','Q12','Q18'].includes(c.id)) && /공지사항/.test(sentence) && /(?:안내|공지|올라오|확인)/.test(sentence))add(sentence,'F10의 공지사항 안내는 교육 일정 변경에 관한 규칙입니다. 최종 프로젝트 전반에 자동 적용되는지 별도 확인해야 합니다.');
    }
    if(['Q11','Q18'].includes(c.id) && /\d+\s*명/.test(t))add(t.match(/\d+\s*명/)[0],'최종 프로젝트 한 팀의 구성 인원은 공식 자료에 없습니다.');
    if(c.id==='Q12' && /\d+\s*월\s*\d+\s*일|\d{4}[-./]\d\d[-./]\d\d/.test(t))add('발표 날짜 표현','최종 프로젝트 발표 일정은 공식 자료에 없습니다.');
    if(['Q09','Q17'].includes(c.id) && /(?:자동\s*발송|자동으로\s*(?:이메일|메일)|(?:이메일|메일).*(?:자동|발송됩니다))/.test(t) && !/(?:명시되지|알\s*수\s*없|확인\s*필요|불명|미확인)/.test(t))add('이메일 자동 발송 표현','제출 확인 이메일의 자동 발송 여부는 공식 자료에 없습니다.');
    if(c.id==='Q14' && /\d+\s*시간/.test(t) && !/확인\s*필요|명시되지/.test(t))add('답변 시간','운영 문의 답변 시간 보장은 공식 자료에 없습니다.');
    if(c.id==='Q15' && /\d+\s*일/.test(t) && !/확인\s*필요|명시되지/.test(t))add('최소 출석일수','수료 최소 출석일수는 공식 자료에 없습니다.');
    if(c.id==='Q16' && /(?:무료|\d+\s*원|비용이\s*없)/.test(t) && !/확인\s*필요|명시되지/.test(t))add('발급 수수료','수료증 발급 수수료는 공식 자료에 없습니다.');
    if(c.id==='Q10' && /(?:24\s*시간|지각.*(?:가능|허용)|마감.*(?:허용|가능))/.test(t) && !/확인\s*필요|명시되지/.test(t))add('마감 후 제출','지각 제출 허용 범위는 공식 자료에 없습니다.');
    if(['Q13','Q19'].includes(c.id) && /PDF.*(?:다운로드|내려받).*(?:가능|허용)|(?:다운로드|내려받).*(?:가능|허용)/.test(t) && !/확인\s*필요|명시되지|알\s*수\s*없/.test(t))add('PDF 다운로드 허용','자료실 PDF 다운로드 허용 여부는 공식 자료에 없습니다.');
    return issues;
  }
  function showAnnotated(text,highlight){
    const box=$('annotatedAnswer');box.replaceChildren();
    if(!highlight || !text.includes(highlight)){box.textContent=text;return;}
    const index=text.indexOf(highlight);
    box.append(document.createTextNode(text.slice(0,index)),elem('mark','',highlight),document.createTextNode(text.slice(index+highlight.length)));
  }
  function finding(msg){$('findingList').append(elem('p','finding-line',msg));}
  function review(){
    const c=caseNow(),text=$('draft').value.trim(),original=contentLabel();
    $('inputError').hidden=true;
    if(!text){$('inputError').textContent='점검할 답변을 먼저 입력해 주세요. 비어 있는 입력은 점검하지 않습니다.';$('inputError').hidden=false;$('draft').focus();return;}
    if(text.length>4000){$('inputError').textContent='최대 4,000자까지 입력할 수 있습니다.';$('inputError').hidden=false;return;}
    $('findingList').replaceChildren();
    let warn=false, highlight='';
    if(original){
      const v=c.versions[original];warn=v.unsupported;
      setText('resultMode',`T10 논문 저장 판정 · ${c.id}-${original} · 기본 판정 · AI 보조 의미 판정`);
      setText('resultHeadline',v.unsupported?'근거 없는 절차·안내 단정이 표시된 응답':'기본 판정에서 이 유형의 안내로 표시되지 않은 응답');
      setText('resultDescription',v.unsupported?'질문에 모르는 정보를 보류했더라도, 답변의 다른 부분이 문서에 없는 후속 절차를 약속할 수 있습니다.':'이 문항의 저장된 판정 결과입니다. 모든 상황에서 답변의 정확성·안전성을 보장하는 결과는 아닙니다.');
      highlight=v.unsupported?v.excerpt:'';
      finding('판정 근거: '+v.reason);
      if(v.expanded!==v.unsupported || v.narrow!==v.unsupported){
        finding(`판정 경계에 따른 변화: 기본 ${v.unsupported?'오류':'오류 아님'} / 넓은 해석 ${v.expanded?'오류':'오류 아님'} / 좁은 해석 ${v.narrow?'오류':'오류 아님'}.`);
      }
      finding('의미 판정은 T10에서 수행한 AI 보조 판정입니다. 이번 앱이 새로 의미를 채점한 결과가 아닙니다.');
    }else{
      const issues=warningPatterns(text,c);warn=issues.length>0;
      setText('resultMode',`편집한 답변 · 사전 정의된 표현 규칙 ${issues.length}개 탐지 · 자동 의미 채점 아님`);
      setText('resultHeadline',warn?`주의 표현 ${issues.length}개를 검토하세요`:'설정된 주의 문구는 찾지 못했습니다');
      setText('resultDescription',warn?'자동 탐지된 문구는 담당자가 공식 자료와 대조해 판단해야 합니다. 탐지 결과 자체가 최종 오류 판정은 아닙니다.':'주의 문구 0개는 올바른 답변이라는 뜻이 아닙니다. 새로 작성한 표현 전체의 의미와 문서 근거는 사람의 확인이 필요합니다.');
      if(warn){highlight=issues[0].term;if(!text.includes(highlight))highlight='';issues.forEach(x=>finding(x.why));}
      finding('주의: 패턴 탐지는 놓침·오탐이 있을 수 있습니다. 공식 안내문 F01~F10을 참고해 모든 사실·정책·절차를 직접 확인해 주세요.');
    }
    showAnnotated(text,highlight);
    setText('safeAnswer',safeAnswer(c));
    $('resultState').textContent=original?(warn?'논문 기록: 주의':'논문 기록: 기본 오류 없음'):(warn?'검토할 표현 있음':'추가 수동 확인');
    $('resultState').className='result-state '+(warn?'warn':'neutral');
    $('resultIntro').hidden=true;$('resultContent').hidden=false;
    $('results').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }
  async function copySafe(){
    const value=$('safeAnswer').textContent,btn=$('copySafe');
    try {if(!navigator.clipboard?.writeText)throw new Error('clipboard');await navigator.clipboard.writeText(value);btn.textContent='복사 완료 ✓';}
    catch {btn.textContent='복사 불가 · 문장을 직접 선택해 주세요';}
    setTimeout(()=>{btn.textContent='수정 예시 복사 ↗';},2600);
  }
  const STAT_MODES = {
    base: {
      label:'기본 판정', field:'unsupported',
      description:'문서에 없는 후속 안내 시행·공지 약속을 포함한 답변을 셉니다.',
      title:['B에서 1개 적지만,','우위로 단정할 수 없습니다.'],
      body:'기본 판정의 차이는 Q02 한 쌍에서 나왔습니다. 넓은 해석과 좁은 해석에서는 두 조건의 건수가 같아집니다.',
      explanation:'5%p는 15%와 10%의 차이입니다. B의 전체 정확도가 5% 높아졌다는 뜻이 아닙니다.',
      note:'Q02-B의 조건부 공지사항 확인 권고는 기본 판정에서 제외했습니다. 이 한 문장의 해석에 따라 A와 B의 차이가 달라집니다.'
    },
    wide: {
      label:'넓은 해석', field:'expanded',
      description:'기본 판정에 더해, Q02-B의 조건부 공지사항 확인 권고까지 포함한 사후 해석입니다.',
      title:['이 기준에서는','A와 B가 모두 3개입니다.'],
      body:'Q02-B의 조건부 공지사항 확인 권고도 근거 없는 안내로 포함하면, A와 B 모두 20개 중 3개입니다. 두 조건의 비율 차이는 없습니다.',
      explanation:'두 비율은 각각 15%이고 차이는 0%p입니다. 같은 건수라고 해서 두 프롬프트의 성능이 항상 같다고 증명된 것은 아닙니다.',
      note:'논문의 사후 민감도 분석입니다. 새로운 응답을 수집한 것이 아니라 같은 응답을 더 넓은 범위로 판정했습니다.'
    },
    narrow: {
      label:'좁은 해석', field:'narrow',
      description:'명시적인 공지 채널 약속만 포함한 사후 해석입니다. 일반적인 후속 안내 약속은 제외합니다.',
      title:['이 기준에서는','A와 B가 모두 1개입니다.'],
      body:'명시적인 공지 채널 약속만 포함하면, A와 B 모두 20개 중 1개입니다. 포함하는 표현의 범위가 줄어 건수도 작아졌습니다.',
      explanation:'각각 5%는 20개 중 1개라는 뜻입니다. 나머지 19개가 모두 정답이거나 전체 정확도가 95%라는 뜻은 아닙니다.',
      note:'논문의 사후 민감도 분석입니다. 범위를 좁혀 센 것이며, 답변을 수정하거나 앱이 오류를 줄인 결과가 아닙니다.'
    }
  };
  function renderStats(mode){
    const config=STAT_MODES[mode];
    if(!config)return;
    state.mode=mode;
    document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
    const total=research.cases.length,counts={};
    ['A','B'].forEach(condition=>{
      const flaggedCases=research.cases.filter(c=>c.versions[condition][config.field]===true);
      const count=flaggedCases.length;
      counts[condition]=count;
      const percentage=100*count/total;
      $('stat'+condition).replaceChildren(elem('span','count-total',`${total}개 중`),document.createTextNode(' '),elem('strong','',`${count}개`));
      setText('rate'+condition,`이 기준의 발견 비율 ${percentage}%`);
      const dots=research.cases.map(c=>{
        const flagged=c.versions[condition][config.field]===true;
        const dot=elem('span','answer-dot'+(flagged?' flagged':''));
        dot.setAttribute('aria-hidden','true');
        dot.title=`${c.id}-${condition} · ${flagged?'이 기준에서 근거 없는 안내로 판정':'이 기준에서는 해당 판정 없음'}`;
        return dot;
      });
      const dotsBox=$('dots'+condition);
      dotsBox.replaceChildren(...dots);
      dotsBox.setAttribute('aria-label',`${condition}: ${config.label}, ${total}개 중 ${count}개 답변에 근거 없는 안내 포함. 판정 문항: ${flaggedCases.map(c=>c.id).join(', ')||'없음'}. 나머지 답변의 정확성을 보장하지 않습니다.`);
    });
    setText('criterionLabel',`현재 기준 · ${config.label}`);
    setText('criterionDescription',config.description);
    setText('statCaption',config.note);
    setText('interpretationMode',`${config.label}에서의 비교`);
    setText('comparisonDifference',`건수 차이 · A − B: ${counts.A-counts.B}개 (${100*(counts.A-counts.B)/total}%p)`);
    $('interpretationTitle').replaceChildren(document.createTextNode(config.title[0]),document.createElement('br'),document.createTextNode(config.title[1]));
    setText('interpretationBody',config.body);
    setText('comparisonExplanation',config.explanation);
    setText('statsAnnouncement',`${config.label}. A ${total}개 중 ${counts.A}개, B ${total}개 중 ${counts.B}개. ${config.description} 앱 정확도 점수가 아닙니다.`);
  }
  questionOptions();
  $('questionSelect').addEventListener('change',e=>changeCase(e.target.value));
  document.querySelectorAll('[data-case]').forEach(b=>b.addEventListener('click',()=>changeCase(b.dataset.case)));
  document.querySelectorAll('[data-condition]').forEach(b=>b.addEventListener('click',()=>setCondition(b.dataset.condition)));
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>renderStats(b.dataset.mode)));
  $('draft').addEventListener('input',()=>{contentLabel();clearResult();});
  $('draft').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();review();}});
  $('reload').addEventListener('click',()=>setCondition(state.condition));
  $('review').addEventListener('click',review);
  $('copySafe').addEventListener('click',copySafe);
  changeCase('Q11');renderStats('base');
})();
