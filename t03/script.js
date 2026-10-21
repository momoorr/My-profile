'use strict';

// T03: 네트워크 요청, 외부 라이브러리, 계정·분석 코드를 사용하지 않습니다.
const STORE_KEY = 'aleph.t03.cardstudio.v1';
const PALETTE = ['#2d3138', '#ffffff', '#dff2ff'];
const RATIOS = Object.freeze({square:{w:1080,h:1080,title:'1:1'},portrait:{w:1080,h:1350,title:'4:5'},story:{w:1080,h:1920,title:'9:16'}});
const PRESETS = ['grid','orbit','lines'];
const q = (s) => document.querySelector(s);
const canvas = q('#preview-canvas');
const ctx = canvas.getContext('2d');
const els = {
  image:q('#image-input'),text:q('#text-input'),count:q('#char-count'),size:q('#size-input'),sizeValue:q('#size-value'),
  x:q('#x-input'),y:q('#y-input'),xValue:q('#x-value'),yValue:q('#y-value'),
  message:q('#editor-message'),imageSize:q('#image-size'),download:q('#download-button'),backup:q('#export-json'),
  json:q('#json-input'),templateName:q('#template-name'),save:q('#save-template'),list:q('#template-list'),templateCount:q('#template-count')
};
const own = (obj,key) => Object.prototype.hasOwnProperty.call(obj,key);
const freshEditor = () => ({ratio:'square',text:'오늘의 작은 기록',fontSize:64,color:PALETTE[0],x:50,y:53,background:{type:'preset',id:'grid'}});
const clone = (value) => JSON.parse(JSON.stringify(value));
const countChars = (text) => Array.from(text).length;
const validBg = (b) => b && typeof b === 'object' && !Array.isArray(b) && ((b.type==='preset' && PRESETS.includes(b.id)) || (b.type==='upload' && typeof b.data==='string' && /^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(b.data) && b.data.length<=4500000));
const validEditor = (v) => v && typeof v === 'object' && !Array.isArray(v) && own(RATIOS,v.ratio) && typeof v.text==='string' && countChars(v.text)<=160 && v.text.split(/\r?\n/).length<=12 && Number.isInteger(v.fontSize) && v.fontSize>=28 && v.fontSize<=112 && PALETTE.includes(v.color) && Number.isInteger(v.x) && v.x>=8 && v.x<=92 && Number.isInteger(v.y) && v.y>=8 && v.y<=92 && validBg(v.background);
const validTemplate = (t) => t && typeof t==='object' && typeof t.id==='string' && t.id.length<=100 && /^[a-z0-9-]+$/i.test(t.id) && typeof t.name==='string' && t.name.length>=1 && t.name.length<=28 && validEditor(t.editor);
let editor = freshEditor();
let templates = [];
let uploadedImage = null;
let storeAvailable = true;
let renderScheduled = false;

function report(message, error=false) {
  els.message.textContent = message;
  els.message.classList.toggle('is-error',error);
}
function persist() {
  if (!storeAvailable) return false;
  try {localStorage.setItem(STORE_KEY,JSON.stringify({version:1,editor,templates}));return true;}
  catch(e){storeAvailable=false;report('브라우저 저장 공간을 사용할 수 없습니다. JSON 백업으로 기록을 보관하세요.',true);return false;}
}
function safeRestore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw === null) return;
    const data = JSON.parse(raw);
    if (!validBundle(data)) throw new Error('Invalid saved data');
    editor = clone(data.editor);
    templates = clone(data.templates);
    report('브라우저에 저장된 편집 기록과 템플릿을 복원했습니다.');
  } catch(e) {
    if (e?.name === 'SecurityError') {storeAvailable=false;report('브라우저 저장이 제한됩니다. JSON 백업을 이용해 주세요.',true);}
    else {report('저장된 작업이 손상되어 기본 화면으로 안전하게 시작했습니다. JSON 백업으로 복구할 수 있습니다.',true);}
  }
}
function validBundle(data) {
  return data && typeof data==='object' && !Array.isArray(data) && data.version===1 && validEditor(data.editor) && Array.isArray(data.templates) && data.templates.length<=24 && data.templates.every(validTemplate) && new Set(data.templates.map(t=>t.id)).size === data.templates.length;
}
function loadImage(source) {
  return new Promise((resolve,reject)=>{
    const image = new Image();
    image.onload = () => (image.naturalWidth>0 && image.naturalHeight>0) ? resolve(image) : reject(new Error('이미지 크기 확인 실패'));
    image.onerror = () => reject(new Error('이미지를 열지 못했습니다'));
    image.src=source;
  });
}
async function setEditor(next, notification='') {
  if (!validEditor(next)) {report('잘못된 편집 데이터입니다. 기존 화면을 유지했습니다.',true);return false;}
  let nextImage = null;
  if (next.background.type==='upload') {
    try {nextImage=await loadImage(next.background.data);}
    catch(e){report('저장 이미지가 손상되어 기존 화면을 유지했습니다.',true);return false;}
  }
  editor = clone(next);
  uploadedImage=nextImage;
  syncControls();draw();persist();
  if(notification) report(notification);
  return true;
}
function syncControls() {
  els.text.value=editor.text;
  els.count.textContent=`${countChars(editor.text)} / 160`;
  els.size.value=String(editor.fontSize);els.sizeValue.textContent=`${editor.fontSize}px`;
  els.x.value=String(editor.x);els.y.value=String(editor.y);
  els.xValue.textContent=`${editor.x}%`;els.yValue.textContent=`${editor.y}%`;
  els.imageSize.textContent=`${RATIOS[editor.ratio].w} × ${RATIOS[editor.ratio].h}`;
  document.querySelectorAll('[data-color]').forEach(b=>{const on=b.dataset.color===editor.color;b.classList.toggle('is-selected',on);b.setAttribute('aria-pressed',String(on));});
  document.querySelectorAll('[data-ratio]').forEach(b=>{const on=b.dataset.ratio===editor.ratio;b.classList.toggle('is-selected',on);b.setAttribute('aria-pressed',String(on));});
  document.querySelectorAll('[data-bg]').forEach(b=>{const on=editor.background.type==='preset'&&b.dataset.bg===editor.background.id;b.classList.toggle('is-selected',on);b.setAttribute('aria-pressed',String(on));});
}
function scheduleDraw(){if(renderScheduled)return;renderScheduled=true;requestAnimationFrame(()=>{renderScheduled=false;draw();});}
function update(part,announce='') {Object.assign(editor,part);syncControls();scheduleDraw();persist();if(announce)report(announce);}

function drawPreset(w,h,name) {
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);
  if (name==='grid') {
    ctx.fillStyle='#dff2ff';ctx.fillRect(0,0,w*.27,h);ctx.fillRect(w*.86,0,w*.14,h);
    ctx.strokeStyle='#2d3138';ctx.lineWidth=3;
    ctx.strokeRect(w*.08,h*.10,w*.84,h*.80);
    ctx.beginPath();ctx.arc(w*.72,h*.19,w*.095,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#2d3138';ctx.fillRect(w*.1,h*.86,w*.14,5);
    ctx.fillRect(w*.80,h*.13,w*.07,5);
  } else if(name==='orbit') {
    ctx.fillStyle='#dff2ff';ctx.fillRect(0,0,w,h);
    const radius=w*.46;
    ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(w*.5,h*.5,radius,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#2d3138';ctx.lineWidth=3;
    for(let r=radius*.67;r<=radius*.99;r+=radius*.32){ctx.beginPath();ctx.arc(w*.5,h*.5,r,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle='#2d3138';ctx.beginPath();ctx.arc(w*.83,h*.5,13,0,Math.PI*2);ctx.fill();
  } else {
    ctx.fillStyle='#dff2ff';ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#ffffff';ctx.fillRect(w*.085,h*.075,w*.83,h*.85);
    ctx.strokeStyle='#2d3138';ctx.lineWidth=3;
    for(let i=0;i<8;i++){const y=h*(.14+i*.098);ctx.beginPath();ctx.moveTo(w*.13,y);ctx.lineTo(w*(i%2===0?.9:.72),y);ctx.stroke();}
    ctx.fillStyle='#dff2ff';ctx.fillRect(w*.18,h*.33,w*.65,h*.36);
  }
}
function drawUploaded(w,h,image){
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);
  if (!image) return;
  // 화면 비율과 관계없이 중심을 기준으로 cover 크롭합니다.
  const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight);
  const iw=image.naturalWidth*scale, ih=image.naturalHeight*scale;
  ctx.drawImage(image,(w-iw)/2,(h-ih)/2,iw,ih);
}
function graphemes(text) {
  if(typeof Intl.Segmenter==='function')return Array.from(new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(text),p=>p.segment);
  return Array.from(text);
}
function breakLines(text,maxWidth,fontSize){
  ctx.font=`800 ${fontSize}px "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif`;
  const lines=[];
  for(const paragraph of text.replace(/\r\n/g,'\n').split('\n')) {
    if(!paragraph){lines.push('');continue;}
    let line='';
    for(const char of graphemes(paragraph)) {
      if(line && ctx.measureText(line+char).width>maxWidth){lines.push(line);line=char;}
      else line+=char;
    }
    lines.push(line);
  }
  return lines;
}
function drawText(w,h) {
  if(!editor.text.trim()) return;
  let font=editor.fontSize;
  let lines=breakLines(editor.text,w*.84,font);
  // 모든 문구가 화면 안에 들어오도록 글자 크기를 자동 보정합니다.
  while(font>22 && lines.length*font*1.35>h*.72){font-=2;lines=breakLines(editor.text,w*.84,font);}
  const lineHeight=font*1.35;
  const overall=lines.length*lineHeight;
  const x=w*editor.x/100;
  const requestedY=h*editor.y/100;
  const y=Math.max(overall/2+h*.04,Math.min(h-overall/2-h*.04,requestedY));
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`800 ${font}px "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif`;
  ctx.fillStyle=editor.color;
  lines.forEach((textLine,i)=>ctx.fillText(textLine,x,y+(i-(lines.length-1)/2)*lineHeight,w*.84));
}
function draw() {
  const {w,h}=RATIOS[editor.ratio];
  if(canvas.width!==w || canvas.height!==h){canvas.width=w;canvas.height=h;}
  ctx.clearRect(0,0,w,h);
  if(editor.background.type==='preset')drawPreset(w,h,editor.background.id);
  else drawUploaded(w,h,uploadedImage);
  drawText(w,h);
  els.imageSize.textContent=`${w} × ${h}`;
}
function fileAsDataURL(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('파일 읽기 실패'));r.readAsDataURL(blob);});}
async function fileIsPNGorJPEG(file){
  const arr = new Uint8Array(await file.slice(0,12).arrayBuffer());
  const png=[137,80,78,71,13,10,26,10].every((n,i)=>arr[i]===n);
  const jpg=arr[0]===255 && arr[1]===216 && arr[2]===255;
  return png?'png':jpg?'jpeg':null;
}
async function compressedImage(file) {
  if(!file || file.size===0 || file.size>12*1024*1024)throw new Error('12MB 이하의 정상 PNG·JPEG 파일을 선택하세요.');
  const kind=await fileIsPNGorJPEG(file);
  if(!kind)throw new Error('파일 내용이 PNG 또는 JPEG 형식이 아닙니다.');
  const source=await fileAsDataURL(file);
  const img=await loadImage(source);
  const factor=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
  const scratch=document.createElement('canvas');scratch.width=Math.max(1,Math.round(img.naturalWidth*factor));scratch.height=Math.max(1,Math.round(img.naturalHeight*factor));
  const sc=scratch.getContext('2d');sc.fillStyle='#ffffff';sc.fillRect(0,0,scratch.width,scratch.height);sc.drawImage(img,0,0,scratch.width,scratch.height);
  const data=scratch.toDataURL('image/jpeg',.83); // EXIF를 제거하고 저장 크기를 줄임
  if(data.length>4500000)throw new Error('저장용으로 변환된 이미지가 너무 큽니다. 더 작은 이미지를 사용해 주세요.');
  return {type:'upload',data};
}
els.image.addEventListener('change',async e=>{
  const f=e.target.files?.[0];e.target.value='';if(!f)return;
  try {
    const bg=await compressedImage(f);const ok=await setEditor({...editor,background:bg},`'${f.name.slice(0,64)}' 이미지를 불러왔습니다.`);
    if(ok)report('이미지를 불러왔습니다. 문구를 움직여 보고 PNG를 저장해 보세요.');
  }catch(error){report(`${error.message} 기존 이미지와 편집 내용은 유지했습니다.`,true);}
});
els.text.addEventListener('input',()=>{
  const value=els.text.value;
  els.count.textContent=`${countChars(value)} / 160`;
  if(countChars(value)>160 || value.split(/\r?\n/).length>12){report('문구는 최대 160자, 12줄까지 가능합니다. 기존 미리보기는 유지했습니다.',true);return;}
  editor.text=value;scheduleDraw();persist();report('문구가 미리보기에 반영됐습니다.');
});
els.size.addEventListener('input',()=>update({fontSize:Number(els.size.value)}));
els.x.addEventListener('input',()=>update({x:Number(els.x.value)}));
els.y.addEventListener('input',()=>update({y:Number(els.y.value)}));
document.querySelectorAll('[data-color]').forEach(b=>b.addEventListener('click',()=>update({color:b.dataset.color})));
document.querySelectorAll('[data-ratio]').forEach(b=>b.addEventListener('click',()=>update({ratio:b.dataset.ratio})));
document.querySelectorAll('[data-bg]').forEach(b=>b.addEventListener('click',()=>setEditor({...editor,background:{type:'preset',id:b.dataset.bg}},'직접 제작한 배경 예제를 적용했습니다.')));

let dragging=false;
function moveFromPoint(ev) {
  const rect=canvas.getBoundingClientRect();
  const x=Math.min(92,Math.max(8,Math.round((ev.clientX-rect.left)/rect.width*100)));
  const y=Math.min(92,Math.max(8,Math.round((ev.clientY-rect.top)/rect.height*100)));
  update({x,y});
}
canvas.addEventListener('pointerdown',e=>{dragging=true;canvas.setPointerCapture(e.pointerId);moveFromPoint(e);canvas.focus();});
canvas.addEventListener('pointermove',e=>{if(dragging)moveFromPoint(e);});
canvas.addEventListener('pointerup',()=>{dragging=false;});
canvas.addEventListener('pointercancel',()=>{dragging=false;});
canvas.addEventListener('keydown',e=>{
  const delta=e.shiftKey?5:1;
  const p={x:editor.x,y:editor.y};
  if(e.key==='ArrowLeft')p.x-=delta;
  else if(e.key==='ArrowRight')p.x+=delta;
  else if(e.key==='ArrowUp')p.y-=delta;
  else if(e.key==='ArrowDown')p.y+=delta;
  else return;
  e.preventDefault();update({x:Math.max(8,Math.min(92,p.x)),y:Math.max(8,Math.min(92,p.y))});
});
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
els.download.addEventListener('click',()=>{
  if(els.text.value!==editor.text){report('입력한 문구가 너무 깁니다. 문구를 수정한 뒤 저장해 주세요.',true);return;}
  draw();
  canvas.toBlob(blob=>{if(!blob){report('이미지를 만들지 못했습니다. 다시 시도해 주세요.',true);return;}downloadBlob(blob,`card_${RATIOS[editor.ratio].title.replace(':','x')}.png`);report('미리보기와 같은 PNG 파일을 저장했습니다.');},'image/png');
});
function downloadBackup(){
  const value={version:1,editor:clone(editor),templates:clone(templates)};
  downloadBlob(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),'cardstudio_backup.json');
  report('JSON 백업 파일을 저장했습니다. 이미지 정보가 포함될 수 있으므로 공유 시 주의하세요.');
}
els.backup.addEventListener('click',downloadBackup);
els.json.addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  if(file.size<=0 || file.size>16*1024*1024){report('JSON 파일은 16MB 이하여야 합니다. 기존 작업을 유지했습니다.',true);return;}
  try {
    const parsed=JSON.parse(await file.text());
    if(!validBundle(parsed))throw new Error('필수 항목 누락 또는 지원하지 않는 구조');
    let restoreImg=null;
    if(parsed.editor.background.type==='upload')restoreImg=await loadImage(parsed.editor.background.data);
    for(const t of parsed.templates){if(t.editor.background.type==='upload')await loadImage(t.editor.background.data);}
    // 모든 형식 검증 및 이미지 읽기가 성공했을 때만 현재 기록을 교체합니다.
    editor=clone(parsed.editor);templates=clone(parsed.templates);uploadedImage=restoreImg;
    persist();syncControls();draw();renderTemplates();
    report(`정상 JSON을 복원했습니다. 템플릿 ${templates.length}개가 반영됐습니다.`);
  } catch(error) {report(`JSON 불러오기 실패: ${error.message}. 기존 작업은 유지했습니다.`,true);}
});
function safeName(){const name=els.templateName.value.trim();if(!name || name.length>28){report('템플릿 이름은 1~28자로 지정해 주세요.',true);return null;}return name;}
function newId(){return 'card-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);}
function renderTemplates(){
  els.templateCount.textContent=`${templates.length}개 저장`;
  els.list.replaceChildren();
  if(!templates.length){const p=document.createElement('p');p.className='empty';p.textContent='저장한 템플릿이 없습니다. 먼저 카드 하나를 저장해 보세요.';els.list.append(p);return;}
  templates.forEach(item=>{
    const article=document.createElement('article');article.className='template-item';
    const h=document.createElement('h3');h.textContent=item.name;
    const p=document.createElement('p');p.textContent=`${RATIOS[item.editor.ratio].title} · ${item.editor.text.slice(0,36) || '문구 없음'}`;
    const actions=document.createElement('div');actions.className='template-actions';
    [['불러오기','load'],['현재 내용으로 수정','update'],['삭제','delete']].forEach(([label,act])=>{
      const b=document.createElement('button');b.className='btn small secondary';b.type='button';b.textContent=label;
      b.addEventListener('click',async()=>{
        if(act==='load'){const ok=await setEditor(item.editor,`'${item.name}' 템플릿을 불러왔습니다.`);if(ok)els.templateName.value=item.name;}
        else if(act==='update'){
          if(els.text.value!==editor.text){report('긴 문구를 먼저 수정한 뒤 템플릿을 저장해 주세요.',true);return;}
          const name=safeName();if(!name)return;
          item.name=name;item.editor=clone(editor);persist();renderTemplates();report('템플릿을 현재 내용으로 수정했습니다. 새로고침 뒤에도 유지됩니다.');
        } else {
          if(!confirm(`'${item.name}' 템플릿을 삭제할까요?`))return;
          templates=templates.filter(x=>x.id!==item.id);persist();renderTemplates();report('템플릿을 삭제했습니다.');
        }
      });actions.append(b);
    });
    article.append(h,p,actions);els.list.append(article);
  });
}
els.save.addEventListener('click',()=>{
  if(els.text.value!==editor.text){report('긴 문구를 먼저 수정한 뒤 저장하세요.',true);return;}
  const name=safeName();if(!name)return;
  if(templates.length>=24){report('템플릿은 최대 24개까지 저장할 수 있습니다.',true);return;}
  templates.push({id:newId(),name,editor:clone(editor)});persist();renderTemplates();report(`'${name}' 템플릿을 저장했습니다.`);
});

safeRestore();syncControls();renderTemplates();
if(editor.background.type==='upload'){
  loadImage(editor.background.data).then(img=>{uploadedImage=img;draw();}).catch(()=>{editor=freshEditor();uploadedImage=null;syncControls();draw();report('저장된 배경 이미지가 손상되어 안전한 예제 화면으로 복구했습니다.',true);});
} else draw();
