import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import {SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY} from './config.js';
const $ = id=>document.getElementById(id);
const state={db:null,user:null,board:null,plans:[],tasks:[],logs:[],revisions:[],readonly:false};
const idParam = new URL(location.href).searchParams.get('board');
const uuidRe=/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const mins=n=>`${Math.round(n)}분`;
const notify=(s)=>{ $('toast').textContent=s; clearTimeout(notify.timer);notify.timer=setTimeout(()=>{$('toast').textContent=''},5000);};
function must(error){if(error)throw error;}
function disableWrites(flag){for(const id of ['plan-form','task-form','log-form']) $(id).querySelectorAll('input,select,button').forEach(e=>e.disabled=flag);}
function errorMessage(e){return e?.message||String(e);}
function guard(f){
  return async e=>{
    if(e?.type === 'submit') e.preventDefault();
    try {
      await f(e);
    } catch(error) {
      console.error(error);
      notify('처리 실패: '+errorMessage(error));
    }
  };
}
function localDate(s){return new Date(s).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function dateToISO(v){return new Date(v).toISOString();}
async function fetchBoard(){
 const db=state.db;
 let bq=db.from('t06_plans').select('*').order('created_at',{ascending:true});
 if(idParam){bq=bq.eq('id',idParam)}else{bq=bq.eq('owner_id',state.user.id)}
 const {data:plans,error}=await bq;must(error);state.plans=plans??[];
 const ids=state.plans.map(p=>p.id);
 state.readonly=!!idParam && !state.plans.some(p=>p.owner_id===state.user.id);
 state.tasks=[];state.logs=[];state.revisions=[];
 if(ids.length){const {data:t,error:te}=await db.from('t06_tasks').select('*').in('plan_id',ids);must(te);state.tasks=t??[];
 const tids=state.tasks.map(t=>t.id);if(tids.length){const {data:l,error:le}=await db.from('t06_logs').select('*').in('task_id',tids);must(le);state.logs=l??[];}
 const {data:r,error:re}=await db.from('t06_plan_revisions').select('*').in('plan_id',ids).order('changed_at',{ascending:false});must(re);state.revisions=r??[];}
 disableWrites(state.readonly);$('connection').textContent=state.readonly?'공개 열람 모드':'서버 연결됨 · 내 계획';render();}
function render(){
 const filteredPlans=state.plans.filter(p=>{const f=$('plan-filter').value;return f==='all'||p.status===(f==='active'?'active':'closed');});
 $('plans').innerHTML=filteredPlans.length?filteredPlans.map(p=>`<div class="item"><header><div><strong>${esc(p.title)}</strong><p class="meta">${esc(p.starts_on)} ~ ${esc(p.ends_on)} · 우선순위 ${p.priority} · 예상 ${mins(p.expected_minutes)} · ${p.status==='active'?'진행 중':'종료'} · ${p.is_public?'공개':'비공개'}</p></div></header><p>성공 기준: ${esc(p.goal)}</p><p class="meta">수정 이력: ${state.revisions.filter(r=>r.plan_id===p.id).length}회 (기존 값 보존)</p>${!state.readonly?`<div class="actions"><button data-act="edit-plan" data-id="${p.id}">계획 고치기</button><button data-act="close-plan" data-id="${p.id}">${p.status==='active'?'계획 종료':'다시 진행'}</button><button data-act="share-plan" data-id="${p.id}">${p.is_public?'공개 끄기':'공개 켜기'}</button></div>`:''}</div>`).join(''):'<p class="muted">저장된 계획이 없습니다.</p>';
 const own=state.plans.filter(p=>p.owner_id===state.user.id);const opt=own.map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join('');$('task-plan').innerHTML='<option value="">계획 선택</option>'+opt;
 const s=$('search').value.toLocaleLowerCase('ko');const status=$('status-filter').value;const priority={high:0,medium:1,low:2};
 const filtered=state.tasks.filter(t=>(status==='all'||t.status===status)&&(t.title+' '+t.tag).toLocaleLowerCase('ko').includes(s)).sort((a,b)=>{const k=$('sort').value;return k==='priority'?priority[a.priority]-priority[b.priority]:k==='minutes'?a.expected_minutes-b.expected_minutes:a.due_on.localeCompare(b.due_on)});
 $('tasks').innerHTML=filtered.length?filtered.map(t=>`<div class="item"><header><strong>${esc(t.title)}</strong><span class="pill">${{todo:'할 일',doing:'진행 중',done:'완료'}[t.status]}</span></header><p class="meta">${esc(state.plans.find(p=>p.id===t.plan_id)?.title||'')} · 마감 ${esc(t.due_on)} · ${esc(t.tag)} · 예상 ${mins(t.expected_minutes)} · ${t.priority}</p>${!state.readonly?`<div class="actions"><button data-act="set-task" data-id="${t.id}" data-value="todo">할 일</button><button data-act="set-task" data-id="${t.id}" data-value="doing">진행 중</button><button data-act="set-task" data-id="${t.id}" data-value="done">완료</button><button data-act="edit-task" data-id="${t.id}">고치기</button><button data-act="remove-task" data-id="${t.id}">지우기</button></div>`:''}</div>`).join(''):'<p class="muted">해당 조건의 할 일이 없습니다.</p>';
 $('log-task').innerHTML='<option value="">할 일 선택</option>'+state.tasks.filter(t=>own.some(p=>p.id===t.plan_id)).map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join('');
 $('logs').innerHTML=state.logs.length?state.logs.slice().sort((a,b)=>b.started_at.localeCompare(a.started_at)).map(l=>`<div class="item"><strong>${esc(state.tasks.find(t=>t.id===l.task_id)?.title||'')}</strong><span class="meta">${localDate(l.started_at)} → ${localDate(l.ended_at)} / ${mins((Date.parse(l.ended_at)-Date.parse(l.started_at))/60000)}</span><p>멈춘 이유: ${esc(l.reason||'기록 없음')}</p></div>`).join(''):'<p class="muted">아직 실행 기록이 없습니다.</p>';
 const relevantTasks=state.tasks;const expected=relevantTasks.reduce((n,t)=>n+t.expected_minutes,0);const actual=state.logs.reduce((n,l)=>n+(Date.parse(l.ended_at)-Date.parse(l.started_at))/60000,0);let t=today();let done=relevantTasks.filter(x=>x.status==='done').length;let late=relevantTasks.filter(x=>x.status!=='done'&&x.due_on<t).length;
 $('total-tasks').textContent=relevantTasks.length;$('done-tasks').textContent=done;$('late-tasks').textContent=late;$('expected-total').textContent=mins(expected);$('actual-total').textContent=mins(actual);$('difference').textContent=(actual-expected>0?'+':'')+mins(actual-expected);
 $('reflection').textContent=state.logs.length?`실제 실행 ${mins(actual)} / 예상 ${mins(expected)}. 차이는 ${mins(actual-expected)}입니다. ${late}개의 할 일이 마감일을 지났습니다. 다음 계획은 이 차이를 참고해 작성해 보세요.`:'실제 실행 기록이 아직 없어 예상·실제 차이를 평가할 수 없습니다.';
}
$('plan-form').addEventListener('submit',guard(async()=>{
    console.log('T06 저장 함수 진입', Boolean(state.db), Boolean(state.user));
    const fields={title:$('plan-title').value.trim(),starts_on:$('plan-from').value,ends_on:$('plan-to').value,priority:$('plan-priority').value,goal:$('plan-goal').value.trim(),expected_minutes:Number($('plan-minutes').value)};if(fields.ends_on<fields.starts_on)throw Error('종료일이 시작일보다 빠릅니다.');const {error}=await state.db.from('t06_plans').insert({...fields,owner_id:state.user.id});must(error);$('plan-form').reset();notify('서버에 계획을 저장했습니다.');await fetchBoard()}));
$('task-form').addEventListener('submit',guard(async()=>{const fields={plan_id:$('task-plan').value,title:$('task-title').value.trim(),due_on:$('task-due').value,priority:$('task-priority').value,tag:$('task-tag').value.trim(),expected_minutes:Number($('task-minutes').value)};const {error}=await state.db.from('t06_tasks').insert(fields);must(error);$('task-form').reset();notify('할 일이 서버에 저장됐습니다.');await fetchBoard()}));
$('log-form').addEventListener('submit',guard(async()=>{const start=dateToISO($('log-start').value),end=dateToISO($('log-end').value);if(Date.parse(end)<=Date.parse(start))throw Error('끝 시각은 시작 시각보다 늦어야 합니다.');const {error}=await state.db.from('t06_logs').insert({task_id:$('log-task').value,started_at:start,ended_at:end,reason:$('log-reason').value.trim()});must(error);$('log-form').reset();notify('실제 실행 기록을 서버에 저장했습니다.');await fetchBoard()}));
document.addEventListener('click',guard(async e=>{const b=e.target.closest('button[data-act]');if(!b||state.readonly)return;const act=b.dataset.act,id=b.dataset.id;
 if(act==='edit-plan'){const p=state.plans.find(x=>x.id===id);const title=prompt('계획 제목 수정',p.title);if(title===null)return;const goal=prompt('성공 기준 수정',p.goal);if(goal===null)return;const {error}=await state.db.from('t06_plans').update({title:title.trim(),goal:goal.trim()}).eq('id',id);must(error);notify('계획 수정 및 수정 전 값 이력이 저장됐습니다.');}
 if(act==='close-plan'||act==='share-plan'){const p=state.plans.find(x=>x.id===id);const upd=act==='close-plan'?{status:p.status==='active'?'closed':'active'}:{is_public:!p.is_public};const {error}=await state.db.from('t06_plans').update(upd).eq('id',id);must(error);}
 if(act==='set-task'){const {error}=await state.db.from('t06_tasks').update({status:b.dataset.value}).eq('id',id);must(error);}
 if(act==='edit-task'){const t=state.tasks.find(x=>x.id===id);const title=prompt('할 일 수정',t.title);if(title===null)return;const {error}=await state.db.from('t06_tasks').update({title:title.trim()}).eq('id',id);must(error);}
 if(act==='remove-task'){if(!confirm('이 할 일과 실행 기록이 함께 삭제됩니다. 진행할까요?'))return;const {error}=await state.db.from('t06_tasks').delete().eq('id',id);must(error);}
 await fetchBoard();}));
for(const k of ['plan-filter','search','status-filter','sort'])$(k).addEventListener(k==='search'?'input':'change',render);
$('copy-link').addEventListener('click',guard(async()=>{const p=state.plans.find(p=>p.is_public);if(!p){notify('공개된 계획이 없습니다. 먼저 공개 설정을 켜 주세요.');return;}const link=new URL(location.href);link.searchParams.set('board',p.id);await navigator.clipboard.writeText(link.href);notify('공개 읽기 전용 링크를 복사했습니다.');}));
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),plans:state.plans,tasks:state.tasks,logs:state.logs,revisions:state.revisions},null,2)],{type:'application/json'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download='plandosee-backup.json';a.click();URL.revokeObjectURL(u);});
async function init(){const good=SUPABASE_URL.startsWith('https://')&&!SUPABASE_URL.includes('YOUR_PROJECT_REF')&&!SUPABASE_PUBLISHABLE_KEY.includes('YOUR_PUBLISHABLE_KEY');if(!good){disableWrites(true);$('connection').textContent='서버 설정 필요';return;}
 try{state.db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true}});let {data:{session},error}=await state.db.auth.getSession();must(error);if(!session){let x=await state.db.auth.signInAnonymously();must(x.error);session=x.data.session;}state.user=session.user;$('setup').hidden=true;await fetchBoard();notify('실제 서버 데이터베이스에 연결됐습니다.');}catch(e){console.error(e);$('connection').textContent='서버 연결 실패';$('setup').querySelector('p').textContent='연결 실패: '+errorMessage(e)+' · Supabase URL/키, 익명 로그인 허용, 테이블 생성 및 RLS를 확인해 주세요.';disableWrites(true);}}
$('plan-from').value=today();$('plan-to').value=today();$('task-due').value=today();init();
