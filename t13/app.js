/* MOA T13 M1 — 규칙 기반 교육 문의 접수·분류 데모.
   실제 AI 호출·개인정보 조회·메시지 발송 없음. */
(() => {
  'use strict';

  const STORAGE_KEY = 'moa-t13-demo-m1-v1';
  const MAX_COUNT = 100;
  const examples = Object.freeze({
    assignment: '과제를 어디에서 제출하나요?',
    project: '최종 프로젝트는 언제, 어떻게 진행하나요?',
    attendance: '제 출결 내역을 알려주세요.'
  });
  const sources = Object.freeze({
    assignment: '과제는 교육 플랫폼의 ‘과제 제출’ 메뉴에서 제출한다.',
    project: '최종 프로젝트의 세부 진행 방식은 아직 문서에 정리되지 않았다.'
  });
  const categories = Object.freeze({
    common: { label: '공통 안내', hint: '공식 자료에 답변 근거가 있습니다.', answer: '과제는 교육 플랫폼의 ‘과제 제출’ 메뉴에서 제출하시면 됩니다.', source: '가상 공식 자료 01 · 과제 제출 위치', tag: 'common' },
    info: { label: '정보 확인 필요', hint: '공식 안내에 없는 내용은 답하지 않습니다.', answer: null, source: '가상 공식 자료 02 또는 현재 공개된 근거 부족', tag: 'info' },
    private: { label: '담당자 확인 필요', hint: '개인별 출결은 이 시연 앱에서 조회할 수 없습니다.', answer: null, source: '개인정보 접근·권한 확인 원칙(데모 운영 규칙)', tag: 'private' },
    personal: { label: '개별 상담', hint: '개인별 판단이 필요한 상담은 자동 안내하지 않습니다.', answer: null, source: '개별 상담 분리 원칙(데모 운영 규칙)', tag: 'personal' }
  });

  const $ = selector => document.querySelector(selector);
  const ui = {
    form: $('#inquiryForm'), input: $('#inquiryText'), error: $('#inputError'), count: $('#charCount'),
    list: $('#ticketList'), empty: $('#emptyList'), detail: $('#ticketDetail'), filter: $('#filterSelect'),
    total: $('#totalCount'), common: $('#commonCount'), review: $('#reviewCount'), reset: $('#resetBtn'), toast: $('#toast')
  };
  const demoData = [examples.assignment, examples.project, examples.attendance];
  const timeLabel = () => new Intl.DateTimeFormat('ko-KR', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
  const makeTicket = (text, id, createdAt) => ({ id, text, category: classify(text), createdAt });
  const defaultTickets = () => demoData.map((s, index) => makeTicket(s, index + 1, '예시 데이터'));
  const saved = readStorage();
  let tickets = saved ?? defaultTickets();
  let selected = tickets[0]?.id ?? null;
  let filter = 'all';
  let toastTimer;
  persist();

  // 명시된 시나리오에만 좁게 대응. 애매하거나 복합적인 질문은 안전하게 확인 대상으로 둔다.
  function classify(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (/(출결|출석|결석|지각|내\s*(기록|내역)|출석률|수강\s*여부)/.test(t)) return 'private';
    if (/(개별\s*상담|진로|취업\s*상담|개인\s*상담|고민|면담)/.test(t)) return 'personal';
    if (/(최종\s*프로젝트|프로젝트\s*진행|프로젝트\s*일정)/.test(t)) return 'info';
    if (/(마감|기한|언제까지|몇\s*시|기간|연장|지연|늦게|평가|점수|채점|제출\s*확인|제출했|제출\s*여부)/.test(t)) return 'info';
    // 공식 근거는 '과제 제출 위치'뿐이다. 짧은 단어만 일치한다고 답변하지 않는다.
    if (/<[^>]*>|https?:\/\/|[{}]/.test(t)) return 'info';
    const mentionsAssignment = /(과제|숙제)/.test(t);
    const asksWhere = /(어디|어느\s*곳|어느\s*메뉴|메뉴|경로|위치|어디서|어떻게\s*제출|제출\s*방법)/.test(t);
    const mentionsSubmit = /(제출|올리|등록)/.test(t);
    if (mentionsAssignment && asksWhere && mentionsSubmit) return 'common';
    return 'info';
  }

  function isValidTicket(o) {
    return o && Number.isSafeInteger(o.id) && o.id > 0 && typeof o.text === 'string' && o.text.trim().length >= 1 && o.text.length <= 280 && Object.hasOwn(categories, o.category) && o.category === classify(o.text) && typeof o.createdAt === 'string';
  }
  function readStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length <= MAX_COUNT && parsed.every(isValidTicket) ? parsed : null;
    } catch (_) { return null; }
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets)); } catch (_) { /* 미지원 환경에서는 메모리 상태로 계속 실행 */ }
  }
  function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = String(text);
    return el;
  }
  function tagFor(key) {
    const meta = categories[key];
    return node('span', `tag tag-${meta.tag}`, meta.label);
  }
  function notify(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('visible'), 2700);
  }
  function renderMetrics() {
    const common = tickets.filter(x => x.category === 'common').length;
    const reviews = tickets.length - common;
    ui.total.replaceChildren(document.createTextNode(tickets.length + ' '), node('small', '', '건'));
    ui.common.replaceChildren(document.createTextNode(common + ' '), node('small', '', '건'));
    ui.review.replaceChildren(document.createTextNode(reviews + ' '), node('small', '', '건'));
  }
  function renderList() {
    const data = filter === 'all' ? tickets : tickets.filter(x => x.category === filter);
    ui.list.replaceChildren();
    ui.empty.hidden = data.length !== 0;
    data.slice().reverse().forEach(ticket => {
      const li = node('li');
      const btn = node('button', 'ticket-button' + (selected === ticket.id ? ' selected' : ''));
      btn.type = 'button';
      btn.dataset.id = String(ticket.id);
      btn.setAttribute('aria-pressed', selected === ticket.id ? 'true' : 'false');
      btn.setAttribute('aria-label', `문의 ${ticket.id}, ${ticket.text}, ${categories[ticket.category].label}`);
      const meta = node('div', 'ticket-meta');
      meta.append(node('span','ticket-id','MOA-' + String(ticket.id).padStart(3,'0')), tagFor(ticket.category), node('span','ticket-time',ticket.createdAt));
      btn.append(meta, node('p','ticket-text',ticket.text), node('p','ticket-desc','접수됨 · 운영자 검토 전'));
      li.append(btn);
      ui.list.append(li);
    });
  }
  function renderDetail() {
    const ticket = tickets.find(x => x.id === selected);
    ui.detail.replaceChildren();
    if (!ticket) {ui.detail.append(node('p','detail-empty','목록에서 문의를 선택해 주세요.'));return;}
    const meta = categories[ticket.category];
    const grid = node('div','detail-grid');
    const left = node('article','detail-box');
    left.append(node('p','box-label','문의 내용'),node('p','inquiry-value',ticket.text));
    const line = node('div','status-line');
    line.append(tagFor(ticket.category), node('span','ticket-id','MOA-'+String(ticket.id).padStart(3,'0')));
    left.append(line,node('p','detail-caption',meta.hint));
    const right = node('article','detail-box');
    right.append(node('p','box-label',meta.answer ? '근거 있는 답변 초안 · 미발송' : '자동 답변 보류 · 미발송'));
    const answer = node('p','answer'+(meta.answer?'':' placeholder'),meta.answer || '공식 자료로 확인되지 않아 답변 초안을 만들지 않았습니다. 운영 담당자가 확인해야 합니다.');
    right.append(answer);
    const notes = node('ul','result-list');
    const first = node('li','',`판단 근거: ${meta.source}`);
    const second = node('li','',meta.answer?'답변에 없는 일정·메뉴·정책은 추가하지 않았습니다.':'확인 전에는 일정·절차·개인 정보를 추정하지 않습니다.');
    notes.append(first,second);
    right.append(notes);
    grid.append(left,right);
    ui.detail.append(grid);
  }
  function render() {renderMetrics();renderList();renderDetail();}
  function setError(message) {ui.error.textContent = message;ui.error.hidden = !message;ui.input.setAttribute('aria-invalid', message?'true':'false');}
  function updateCount() {ui.count.textContent = `${ui.input.value.length} / 280`;}
  function nextId() {return tickets.reduce((a,x)=>Math.max(a,x.id),0)+1;}
  document.querySelectorAll('.example').forEach(button => button.addEventListener('click',() => {
    ui.input.value = examples[button.dataset.example];
    document.querySelectorAll('.example').forEach(b=>b.classList.toggle('active',b===button));
    setError('');updateCount();ui.input.focus();
  }));
  ui.input.addEventListener('input', () => {setError('');updateCount();document.querySelectorAll('.example').forEach(x=>x.classList.remove('active'));});
  ui.form.addEventListener('submit',event => {
    event.preventDefault();
    const text = ui.input.value.trim();
    if (text.length < 3) {setError('문의 내용을 3자 이상 입력해 주세요.');ui.input.focus();return;}
    if (text.length > 280) {setError('문의는 280자 이내로 입력해 주세요.');ui.input.focus();return;}
    if (tickets.length >= MAX_COUNT) {setError('데모는 최대 100건까지만 저장할 수 있습니다. 초기화 후 사용해 주세요.');return;}
    const id = nextId();
    tickets.push(makeTicket(text,id,timeLabel()));selected=id;filter='all';ui.filter.value='all';persist();render();
    ui.input.value='';updateCount();setError('');document.querySelectorAll('.example').forEach(x=>x.classList.remove('active'));
    notify('문의 MOA-'+String(id).padStart(3,'0')+'이(가) 접수되었습니다.');
  });
  ui.list.addEventListener('click',event => {
    const button = event.target.closest('button[data-id]');if(!button)return;
    const id=Number(button.dataset.id);if(!tickets.some(x=>x.id===id))return;
    selected=id;renderList();renderDetail();
  });
  ui.filter.addEventListener('change',()=>{filter=ui.filter.value; const visible=tickets.filter(x=>filter==='all'||x.category===filter);if(!visible.some(x=>x.id===selected)) selected=visible.at(-1)?.id ?? null;renderList();renderDetail();});
  ui.reset.addEventListener('click',()=>{
    if(!window.confirm('추가한 문의가 삭제되고 기본 가상 문의 3건으로 돌아갑니다. 초기화할까요?'))return;
    tickets=defaultTickets();selected=tickets[0].id;filter='all';ui.filter.value='all';ui.input.value='';updateCount();setError('');persist();render();notify('예시 문의 3건으로 초기화했습니다.');
  });
  render();
})();
