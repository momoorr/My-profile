'use strict';
/* Official deterministic fixtures are synthetic; never save them to the live weather store. */
(() => {
  const core = window.T04Core;
  const fixtures = window.T04Fixtures;
  if (!core || !fixtures) throw new Error('OFFICIAL_FIXTURE_ASSETS_MISSING');
  const $ = s => document.querySelector(s);
  const ui = {
    success:$('#replay-success'), five:$('#replay-five'), timeout:$('#replay-timeout'),retry:$('#replay-retry'),reset:$('#replay-reset'),
    status:$('#replay-status'),freshness:$('#replay-freshness'),error:$('#replay-error'),note:$('#replay-note'),
    value:$('#replay-value'),rows:$('#replay-rows'),delta:$('#replay-delta'),records:$('#replay-records'),results:$('#replay-results')
  };
  let state=core.resetEvaluationState();
  let logs=[];
  let retryReady=false;
  const lookup = id => { const f=fixtures[id]; if(!f) throw new Error('Fixture not found: '+id);return f; };
  function evaluate(fixture) {
    const result=core.runFixture(state,fixture);
    const expect=fixture.expected;
    const current=result.current_reading;
    const value=current?.normalized_value??null;
    const rowMatch=result.daily_readings.length===expect.row_count;
    const preserved=result.daily_readings.every(row=>row.reading?.normalized_value===row.normalized_value);
    const expectedRecord=expect.record_date?result.daily_readings.some(r=>r.record_date===expect.record_date):true;
    const deltaMatches=expect.delta===result.last_delta;
    const sameId=expect.same_record_id_as ? result.daily_readings[0]?.record_id===`demo-aleph-demo-index-2026-08-24` : true;
    const pass=result.status.freshness===expect.freshness&&result.status.error_code===expect.error_code&&
       rowMatch&&value===expect.stored_value&&deltaMatches&&expectedRecord&&preserved&&sameId;
    state=result;
    logs.push({fixture:fixture.fixture_id, code:result.status.error_code, freshness:result.status.freshness, rows:result.daily_readings.length,value,pass});
    return {pass,result};
  }
  function render() {
    const status=state.status;
    ui.freshness.textContent=status?.freshness??'—';
    ui.error.textContent=status?.error_code??'—';
    ui.rows.textContent=String(state.daily_readings.length);
    ui.value.textContent=state.current_reading ? `${state.current_reading.normalized_value} ${state.current_reading.unit}${status?.freshness==='stale'?' · 오래된 값':''}` : '—';
    ui.delta.textContent=state.last_delta===null?'비교 불가':`${state.last_delta} pt`;
    ui.records.textContent=state.daily_readings.map(r=>`${r.record_date}: ${r.normalized_value} ${r.unit}`).join(' · ')||'합성 기록 없음';
    ui.status.textContent=!status?'아직 시작하지 않음':status.freshness==='fresh'?'정상 (합성)':'실패 · 이전 값 보존';
    ui.note.textContent=state.last_run?`${state.last_run.fixture_id} · ${state.last_run.virtual_now} (가상 시간) · ${state.last_run.outcome}`:'합성 데이터는 실제 조회 기록에 영향을 주지 않습니다.';
    ui.retry.disabled=!retryReady;
    ui.results.replaceChildren();
    if(!logs.length){ const tr=document.createElement('tr'), td=document.createElement('td');td.colSpan=6;td.textContent='검사를 실행하면 결과가 여기에 쌓입니다.';tr.append(td);ui.results.append(tr);return; }
    for(const log of logs){
      const tr=document.createElement('tr');
      for(const val of [log.fixture,log.freshness,log.code,log.rows,log.value===null?'—':`${log.value} pt`,log.pass?'PASS':'FAIL']) {
        const td=document.createElement('td');td.textContent=String(val);tr.append(td);
      }
      ui.results.append(tr);
    }
  }
  function reset(){state=core.resetEvaluationState();logs=[];retryReady=false;render();}
  function runSeq(ids){ for(const id of ids) evaluate(lookup(id)); render(); }
  function baseline(){reset();runSeq(['T04-NORMAL-D1-A','T04-NORMAL-D1-B']);}
  ui.success.addEventListener('click',()=>{baseline();runSeq(['T04-NORMAL-D2']);});
  ui.five.addEventListener('click',()=>{
    const failIDs=['T04-TIMEOUT','T04-AUTH-401','T04-RATE-429','T04-OFFLINE','T04-SCHEMA-BREAK'];
    const summary=[];
    for(const id of failIDs){
      state=core.resetEvaluationState();
      core.validateNormalizedReading(lookup('T04-NORMAL-D1-A').payload);
      evaluate(lookup('T04-NORMAL-D1-A'));
      evaluate(lookup('T04-NORMAL-D1-B'));
      const result=evaluate(lookup(id));
      summary.push(logs.at(-1));
      if(!result.pass) ui.note.textContent=`${id} 검사 실패`; 
    }
    logs=summary;retryReady=false;render();
  });
  ui.timeout.addEventListener('click',()=>{
    baseline();runSeq(['T04-TIMEOUT']);retryReady=true;render();
  });
  ui.retry.addEventListener('click',()=>{
    if(!retryReady)return;
    runSeq(['T04-RECOVER-D2']);retryReady=false;render();
  });
  ui.reset.addEventListener('click',reset);
  window.T04ReplayTest = { reset, runSeq, getState:()=>JSON.parse(JSON.stringify(state)), getLogs:()=>JSON.parse(JSON.stringify(logs)) };
  render();
})();
