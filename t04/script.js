'use strict';
/* T04 실제 조회: 공개 모델 기반 날씨 데이터 / 공식 fixture 합성 검사와 분리 */
(() => {
  const API_URL='https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m&timezone=Asia%2FSeoul&temperature_unit=celsius';
  const SOURCE='Open-Meteo';
  const SIGNAL_ID='seoul-current-temperature';
  const STORAGE_KEY='aleph.t04.public-weather.v2';
  const MAX_RECORDS=60;
  const REQUEST_TIMEOUT_MS=10000;
  const core=window.T04Core;
  const $=s=>document.querySelector(s);
  const el={
    temp:$('#temp'),tempUnit:$('#temp-unit'),state:$('#state-pill'),readingCaption:$('#reading-caption'),
    sourceTime:$('#source-time'),fetchedTime:$('#fetched-time'),sourceUnit:$('#source-unit'),sourceUrl:$('#source-url'),
    refresh:$('#refresh-button'),refreshNote:$('#refresh-note'),statusTitle:$('#status-title'),
    statusDescription:$('#status-description'),errorCode:$('#error-code'),
    lastTitle:$('#last-good-title'),lastDescription:$('#last-good-description'),
    today:$('#today-kst'),count:$('#record-count'),delta:$('#delta-value'),
    history:$('#history-body'),historyExplanation:$('#history-explanation'),download:$('#download-button')
  };
  const kstStamp=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  function fmt(iso){return iso?kstStamp.format(new Date(iso))+' KST':'원천 시각 없음';}
  function kstDay(date){return core.kstDate(typeof date==='string'?date:date.toISOString());}
  function beforeDay(day){const ms=Date.parse(day+'T00:00:00Z');return new Date(ms-86400000).toISOString().slice(0,10);}
  function freshStore(){return {version:2,days:[],lastGood:null};}
  function validItem(row){
    if(!row || typeof row!=='object'||Array.isArray(row)||typeof row.record_id!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.record_date) || !row.raw || typeof row.raw!=='object')return false;
    try {core.validateNormalizedReading(row.reading);}catch{return false;}
    return row.record_date===row.reading.record_date &&row.record_id===`live-${row.reading.signal_id}-${row.record_date}`&&
      row.raw.value===row.reading.normalized_value&&row.raw.unit===row.reading.unit&&
      row.raw.time!==undefined&&row.reading.source_time===new Date(`${row.raw.time}+09:00`).toISOString();
  }
  function validStore(store){
    if(!store||typeof store!=='object'||Array.isArray(store)||store.version!==2||!Array.isArray(store.days)||store.days.length>MAX_RECORDS)return false;
    const seen=new Set();
    if(!store.days.every(row=>{if(!validItem(row)||seen.has(row.record_date))return false;seen.add(row.record_date);return true;}))return false;
    if(store.lastGood!==null){try{core.validateNormalizedReading(store.lastGood);}catch{return false;}}
    return true;
  }
  let storageWarning='';
  function readStore(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(raw===null)return freshStore();
      const value=JSON.parse(raw);
      if(!validStore(value))throw new Error('INVALID_STORE');
      return value;
    }catch{
      storageWarning='기존 브라우저 기록을 읽거나 검증하지 못해 새 기록으로 시작했습니다. 임의의 기록을 복원하지 않습니다.';
      return freshStore();
    }
  }
  let store=readStore();
  let current=null;
  let isBusy=false;
  let freshness='idle';
  let errorCode='none';
  function persist(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store));return true;}
    catch{storageWarning='브라우저 저장이 차단되어 현재 조회값은 보이지만 새로고침 후 기록이 유지되지 않을 수 있습니다.';return false;}
  }
  function parseLive(payload,fetchedAt){
    if(!payload||typeof payload!=='object'||payload.timezone!=='Asia/Seoul'||!payload.current||!payload.current_units)throw new Error('schema_error');
    const raw={value:payload.current.temperature_2m,unit:payload.current_units.temperature_2m,time:payload.current.time};
    if(typeof raw.time!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw.time) || raw.unit!=='°C'||!Number.isFinite(raw.value)||raw.value< -100||raw.value>80)throw new Error('schema_error');
    const t=new Date(raw.time+'+09:00');
    if(!Number.isFinite(t.getTime())||t.getTime()>Date.parse(fetchedAt)+600000)throw new Error('schema_error');
    const reading={signal_id:SIGNAL_ID,normalized_value:raw.value,unit:raw.unit,source_name:SOURCE,source_url:API_URL,source_time:t.toISOString(),fetched_at:fetchedAt,record_timezone:'Asia/Seoul',record_date:kstDay(fetchedAt)};
    try{core.validateNormalizedReading(reading);}catch{throw new Error('schema_error');}
    return {reading,raw};
  }
  function upsert(reading,raw){
    const existing=store.days.find(row=>row.record_date===reading.record_date);
    const row={record_id:existing?.record_id||`live-${reading.signal_id}-${reading.record_date}`,record_date:reading.record_date,first_fetched_at:existing?.first_fetched_at||reading.fetched_at,last_fetched_at:reading.fetched_at,reading,raw};
    store.days=store.days.filter(x=>x.record_date!==reading.record_date).concat(row).sort((a,b)=>a.record_date.localeCompare(b.record_date)).slice(-MAX_RECORDS);
    store.lastGood=reading;
    persist();
    return !!existing;
  }
  function setStatus(type,code,title,description){
    el.state.textContent=type;
    el.statusTitle.textContent=title;
    el.statusDescription.textContent=description+(storageWarning?' '+storageWarning:'');
    el.errorCode.textContent=code;
  }
  function lastGood(){
    const reading=store.lastGood;
    el.lastTitle.textContent=reading?`${reading.normalized_value.toFixed(1)} ${reading.unit} · 오래된 값`:'아직 정상 조회 기록 없음';
    el.lastDescription.textContent=reading?`마지막 정상 조회 ${fmt(reading.fetched_at)} · 원천 ${fmt(reading.source_time)}. 현재 조회 성공으로 오해하지 마세요.`:'실패한 응답은 정상값을 덮어쓰지 않습니다.';
  }
  function renderHistory(){
    const date=kstDay(new Date());
    el.today.textContent=date;el.count.textContent=store.days.length+'일';
    const today=store.days.find(row=>row.record_date===date);
    const yesterday=store.days.find(row=>row.record_date===beforeDay(date));
    if(today&&yesterday&&today.reading.unit===yesterday.reading.unit){
      const change=today.reading.normalized_value-yesterday.reading.normalized_value;
      el.delta.textContent=`${change>0?'+':''}${change.toFixed(1)} ${today.reading.unit}`;
      el.historyExplanation.textContent=`실제 공개 원천: ${yesterday.record_date} ${yesterday.reading.normalized_value.toFixed(1)} ${yesterday.reading.unit} → ${today.record_date} ${today.reading.normalized_value.toFixed(1)} ${today.reading.unit}. 각 날짜의 최신 성공값으로 계산했습니다.`;
    }else{
      el.delta.textContent='비교할 기록 없음';
      el.historyExplanation.textContent='KST 기준 어제와 오늘에 성공 조회한 기록이 모두 있어야 전일 대비를 계산합니다. 추정값이나 합성 데이터를 사용하지 않습니다.';
    }
    el.history.replaceChildren();
    if(!store.days.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.textContent='실제 일일 기록이 없습니다.';tr.append(td);el.history.append(tr);return;}
    for(const row of [...store.days].sort((a,b)=>b.record_date.localeCompare(a.record_date))){
      const tr=document.createElement('tr');
      for(const val of [row.record_date,`${row.reading.normalized_value.toFixed(1)} ${row.reading.unit}`,fmt(row.reading.source_time),fmt(row.reading.fetched_at),'실제 정상']){
        const td=document.createElement('td');td.textContent=val;tr.append(td);
      }
      el.history.append(tr);
    }
  }
  function showReading(reading){
    el.temp.textContent=reading.normalized_value.toFixed(1);
    el.tempUnit.textContent=reading.unit;
    el.sourceTime.textContent=fmt(reading.source_time);
    el.fetchedTime.textContent=fmt(reading.fetched_at);
    el.sourceUnit.textContent=reading.unit;
    el.readingCaption.textContent='실제 공개 API에서 받은 최신 응답입니다. 날씨 모델 기반 값으로 관측소 실측값은 아닙니다.';
  }
  function failure(code,description){
    freshness='stale';errorCode=code;current=null;
    el.temp.textContent='—';
    el.readingCaption.textContent='현재 조회 실패 · 마지막 정상값은 아래에 "오래된 값"으로 따로 표시합니다.';
    el.sourceTime.textContent='이번 조회 실패';el.fetchedTime.textContent='이번 조회 실패';el.sourceUnit.textContent='확인 불가';
    setStatus('조회 실패',code,'이번 조회는 실패했습니다',description+' 아래 마지막 정상 기록은 유지됩니다. 다시 시도 버튼을 이용하세요.');
    lastGood();renderHistory();
  }
  async function refresh(){
    if(isBusy)return;
    isBusy=true;el.refresh.disabled=true;el.refresh.textContent='조회 중…';
    setStatus('조회 중','none','외부 공개 API 조회 중','실제 응답을 기다리는 중입니다.');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try{
      const response=await fetch(API_URL,{method:'GET',mode:'cors',cache:'no-store',credentials:'omit',signal:controller.signal});
      if(!response.ok){
        const code=(response.status===401||response.status===403)?'auth':response.status===429?'rate_limit':'schema_error';
        failure(code,`외부 원천이 HTTP ${response.status} 응답을 반환했습니다.`);return;
      }
      const payload=await response.json().catch(()=>{throw new Error('schema_error');});
      const {reading,raw}=parseLive(payload,new Date().toISOString());
      const sameDay=upsert(reading,raw);
      freshness='fresh';errorCode='none';current=reading;
      showReading(reading);
      setStatus('정상','none','실제 원천 응답 성공',sameDay?`KST ${reading.record_date}의 동일한 일별 기록 ID로 정상값을 갱신했습니다.`:`KST ${reading.record_date}에 새로운 일별 기록 한 건을 생성했습니다.`);
      lastGood();renderHistory();
    }catch(error){
      const code=error?.name==='AbortError'?'timeout':error?.message==='schema_error'?'schema_error':navigator.onLine===false?'offline':'offline';
      const explanations={timeout:'10초 동안 응답이 없어 중단했습니다.',schema_error:'응답 데이터 구조나 값의 형식을 검증하지 못했습니다.',offline:'네트워크, CORS 또는 외부 연결 문제로 응답을 받지 못했습니다.'};
      failure(code,explanations[code]);
    }finally{
      clearTimeout(timer);isBusy=false;el.refresh.disabled=false;el.refresh.textContent='실제 데이터 다시 조회 ↗';
      el.refreshNote.textContent='수동 재시도 가능 · 실패해도 기존 일일 기록 유지';
    }
  }
  function csvEsc(value){const s=String(value);return /[,\n\r"]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}
  function saveCsv(){
    const data=[['kst_date','normalized_value','unit','source_name','source_url','source_observed_at','fetched_at','record_id','raw_value','raw_unit','raw_time'],...store.days.map(r=>[r.record_date,r.reading.normalized_value,r.reading.unit,r.reading.source_name,r.reading.source_url,r.reading.source_time,r.reading.fetched_at,r.record_id,r.raw.value,r.raw.unit,r.raw.time])];
    const content='\uFEFF'+data.map(row=>row.map(csvEsc).join(',')).join('\r\n');
    const blob=new Blob([content],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='t04_real_daily_records.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  el.sourceUrl.href=API_URL;
  el.refresh.addEventListener('click',refresh);
  el.download.addEventListener('click',saveCsv);
  lastGood();renderHistory();
  window.T04LiveTest={getStore:()=>JSON.parse(JSON.stringify(store)),getCurrent:()=>current?JSON.parse(JSON.stringify(current)):null,getFreshness:()=>freshness,getErrorCode:()=>errorCode,refresh,parseLive};
  refresh();
})();
