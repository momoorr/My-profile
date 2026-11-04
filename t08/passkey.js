// T08 — Passwordless account bootstrap and passkey enrollment UI.
// Only public Supabase URL + publishable key from the existing T07 config.
// Real private data is requested ONLY from the separately protected server API.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.0';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../t07/config.js';

const $ = (id) => document.getElementById(id);
let supabase = null;
let currentUser = null;
let busy = false;
const API_URL = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/t08-private-read`;
const display = (id, visible) => { $(id).hidden = !visible; };
const message = (text, isError = false) => {
  const el = $('t08-auth-message');
  el.textContent = text;
  el.dataset.error = String(isError);
};
const labelDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '날짜 미확인' : new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit'}).format(d);
};
function showLogin() {
  currentUser = null;
  display('t08-email-setup', true);
  display('t08-enroll', false);
  display('t08-signed-in', false);
  display('t08-private-data', false);
  $('t08-items').replaceChildren();
  $('t08-lock-status').textContent = '잠금 상태 · 패스키 로그인이 필요합니다';
  $('t08-lock-description').textContent = '이메일 링크는 최초 패스키 등록용이며 비공개 자료 열람 권한이 아닙니다.';
}
async function listPasskeys() {
  if (!supabase || !currentUser) return;
  const host = $('t08-passkey-list');
  host.replaceChildren();
  const { data, error } = await supabase.auth.passkey.list();
  if (error) throw error;
  const keys = Array.isArray(data) ? data : (Array.isArray(data?.passkeys) ? data.passkeys : []);
  $('t08-passkey-count').textContent = `${keys.length}개 등록됨`;
  if (keys.length === 0) {
    host.textContent = '등록된 패스키가 없습니다. 첫 패스키를 등록해 주세요.';
    return;
  }
  for (const key of keys) {
    const div = document.createElement('div');
    div.className = 'passkey-entry';
    const content = document.createElement('span');
    content.textContent = `${key.friendly_name || '이름 없는 패스키'} · ${labelDate(key.created_at)}`;
    const rename = document.createElement('button');
    rename.type = 'button';
    rename.textContent = '이름 변경';
    rename.addEventListener('click', async () => {
      const name = prompt('패스키 이름 (예: 노트북, 휴대폰)', key.friendly_name || '');
      if (name === null) return;
      const trimmed = name.trim();
      if (!trimmed || trimmed.length > 120) {message('이름은 1~120자로 입력해 주세요.', true);return;}
      await work(async () => {
        const {error} = await supabase.auth.passkey.update({passkeyId:key.id, friendlyName: trimmed});
        if (error) throw error;
        message('패스키 이름을 변경했습니다.');
        await listPasskeys();
      });
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '삭제';
    remove.addEventListener('click', async () => {
      const warning = keys.length === 1 ? '마지막 패스키를 삭제하면 패스키 로그인을 할 수 없습니다. 삭제할까요?' : '이 패스키를 삭제할까요?';
      if (!confirm(warning)) return;
      await work(async () => {
        const {error} = await supabase.auth.passkey.delete({passkeyId:key.id});
        if (error) throw error;
        message('패스키가 삭제됐습니다. 남은 패스키로 다시 로그인되는지 별도로 확인해 주세요.');
        await listPasskeys();
      });
    });
    div.append(content, rename, remove);
    host.append(div);
  }
}
async function refreshSession() {
  if (!supabase) return;
  const {data:{session},error} = await supabase.auth.getSession();
  if (error || !session) {showLogin();return;}
  const {data:{user},error:userError} = await supabase.auth.getUser();
  if (userError || !user || user.is_anonymous) {showLogin();return;}
  currentUser = user;
  display('t08-email-setup', false);
  display('t08-enroll', true);
  display('t08-signed-in', true);
  $('t08-lock-status').textContent = '계정 세션 확인됨 · 비공개 자료는 별도 서버 검사';
  $('t08-lock-description').textContent = '이메일 링크로만 로그인한 상태에서는 비공개 자료를 열 수 없습니다. 패스키로 로그인한 다음 서버 응답을 확인하세요.';
  await listPasskeys();
}
async function work(fn) {
  if (busy) return;
  busy = true;
  try {await fn();}
  catch (e) { console.error('T08 authentication action failed', e?.name || 'Error'); message(`처리 실패: ${e?.message || '알 수 없는 오류'}`, true); }
  finally {busy = false;}
}

$('t08-email-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  await work(async () => {
    if (!supabase) throw Error('인증 서비스를 초기화하지 못했습니다.');
    const email = $('t08-email').value.trim();
    const redirect = new URL('./', location.href).href;
    const {error} = await supabase.auth.signInWithOtp({email, options:{emailRedirectTo:redirect, shouldCreateUser:true}});
    if (error) throw error;
    message('이메일 확인 링크를 보냈습니다. 링크를 열면 패스키 등록을 시작할 수 있어요.');
    $('t08-email').value = '';
  });
});
$('t08-register').addEventListener('click', () => work(async () => {
  if (!currentUser) throw Error('먼저 이메일 링크로 계정을 확인해 주세요.');
  message('기기에서 패스키를 생성하거나 취소할 수 있습니다.');
  const {data,error} = await supabase.auth.registerPasskey();
  if (error) {
    if (error.name === 'NotAllowedError' || /cancel|abort|notallowed/i.test(error.message || '')) {
      message('패스키 등록이 취소됐습니다. 목록에서 추가되지 않았는지 확인해 주세요.');
      await listPasskeys();
      return;
    }
    throw error;
  }
  message('패스키가 등록됐습니다. 다른 기기/관리자에도 한 개 더 등록해 보세요.');
  await listPasskeys();
  if (data?.id) {
    const newName = prompt('등록한 패스키 이름을 지정할까요? (선택)', '내 첫 번째 패스키');
    if (newName?.trim()) {
      const {error:updateErr} = await supabase.auth.passkey.update({passkeyId:data.id,friendlyName:newName.trim().slice(0,120)});
      if (updateErr) message('패스키는 등록됐지만 이름 변경에 실패했습니다. 목록에서 다시 시도해 주세요.', true);
      else await listPasskeys();
    }
  }
}));
$('t08-reload-keys').addEventListener('click', () => work(listPasskeys));
$('t08-passkey-login').addEventListener('click', () => work(async () => {
  message('패스키 로그인 창을 확인해 주세요.');
  const {data,error} = await supabase.auth.signInWithPasskey();
  if (error) throw error;
  if (!data?.session) throw Error('패스키 로그인 세션이 반환되지 않았습니다.');
  await refreshSession();
  message('패스키 로그인 요청이 처리됐습니다. 비공개 자료는 서버 접근 권한 확인 후 표시됩니다.');
}));
$('t08-logout').addEventListener('click', () => work(async () => {
  const {error} = await supabase.auth.signOut({scope:'local'});
  if (error) throw error;
  showLogin();
  message('로그아웃했습니다. 비공개 자료는 화면에서 제거했습니다.');
}));
$('t08-fetch-private').addEventListener('click', () => work(async () => {
  const {data:{session},error} = await supabase.auth.getSession();
  if (error || !session) throw Error('인증 세션이 없습니다.');
  display('t08-private-data', false);
  $('t08-items').replaceChildren();
  const response = await fetch(API_URL, {
    method:'GET',
    headers:{Authorization:`Bearer ${session.access_token}`,apikey:SUPABASE_PUBLISHABLE_KEY},
    cache:'no-store',
    credentials:'omit'
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    message(`비공개 자료 차단: HTTP ${response.status} · ${result.error || '요청 거부'}`, true);
    return;
  }
  const result = await response.json();
  const items = Array.isArray(result?.items) ? result.items : [];
  for (const item of items) {
    const div = document.createElement('article');
    div.className = 'private-result';
    const h = document.createElement('h3');
    h.textContent = item.title || '제목 없음';
    const p = document.createElement('p');
    p.textContent = item.body || '';
    div.append(h,p);
    $('t08-items').append(div);
  }
  display('t08-private-data', true);
  message(`서버 조회 성공: ${items.length}개 (실제 자료는 서버에 있을 때만 표시)`);
}));

async function init() {
  try {
    if (!SUPABASE_URL.startsWith('https://') || !SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')) {
      throw Error('공개 Supabase URL과 publishable key 설정을 확인해 주세요.');
    }
    if (!window.isSecureContext || !('PublicKeyCredential' in window)) {
      throw Error('패스키는 HTTPS와 지원 브라우저/기기가 필요합니다. GitHub Pages HTTPS에서 실행해 주세요.');
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true,
        storageKey:'aleph-t08-passkey-session',experimental:{passkey:true}}
    });
    supabase.auth.onAuthStateChange((event) => {
      if (['SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED'].includes(event)) {
        // Avoid awaiting Supabase calls inside the synchronous auth event callback.
        setTimeout(() => {refreshSession().catch((e) => message(e.message,true));},0);
      }
    });
    await refreshSession();
    message('패스키 기능 준비 완료. 신규 계정은 이메일 링크로 확인 후 등록하세요.');
  } catch(e) {
    message(`초기화 실패: ${e.message}`,true);
    $('t08-email-submit').disabled = true;
    $('t08-passkey-login').disabled = true;
  }
}
showLogin();
init();
