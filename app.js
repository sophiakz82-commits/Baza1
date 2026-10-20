(() => {
  const KEY = 'telecom-project-records-v1';
  const fields = [
    { key: 'address', label: 'Адрес объекта', aliases: ['адрес','address','объект','местоположение','локация','адрес объекта','site','населенный пункт'] },
    { key: 'project', label: 'Название проекта', aliases: ['проект','название проекта','project','проектное название','заказ'] },
    { key: 'status', label: 'Статус / этап', aliases: ['статус','этап','state','status','результат','текущий статус'] },
    { key: 'year', label: 'Год / дата', aliases: ['год','дата','year','date','период','срок'] },
    { key: 'access', label: 'Допуск', aliases: ['допуск','доступ','согласование','access'] },
    { key: 'readiness', label: 'Стройготовность', aliases: ['стройготовность','готовность','готовность стройки','readiness'] },
    { key: 'tu', label: 'Технические условия', aliases: ['ту','технические условия','техническое условие'] },
    { key: 'cost', label: 'Стоимость', aliases: ['стоимость','цена','смета','бюджет','cost','расчет'] },
    { key: 'notes', label: 'Комментарий / причина', aliases: ['комментарий','примечание','причина','резюме','описание','notes','причина отказа'] }
  ];
  const el = id => document.getElementById(id);
  let records = readSaved(), activeFilter = 'all', pendingRows = [], pendingHeaders = [], toastTimer;

  function readSaved() { try { const d = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(d) ? d : []; } catch { return []; } }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(records)); } catch { showToast('Не удалось сохранить данные. Возможно, хранилище браузера заполнено.'); } }
  function clean(value) { return value == null ? '' : String(value).trim(); }
  function norm(value) { return clean(value).toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[.,;:()]/g,' ').replace(/\s+/g,' ').trim(); }
  function esc(value) { return clean(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function statusType(value) {
    const s = norm(value);
    if (/постро|выполнен|реализован|завершен|введен|готов/.test(s)) return 'built';
    if (/отсутств|нет допуска|нет доступ|не готов|стройготов|высок.*стоим|отлож|ожидан|приостанов|исключ|отказ|не реализован|не соглас/.test(s)) return 'attention';
    if (/работ|строительств|монтаж|заказан|в заказ|план|проектирован|согласован|актив/.test(s)) return 'active';
    return 'attention';
  }
  function statusLabel(r) {
    const raw = clean(r.status);
    if (raw) return raw.length > 26 ? raw.slice(0,24)+'…' : raw;
    const t = statusType([r.access,r.readiness,r.notes].join(' '));
    return t==='built' ? 'Построено' : t==='active' ? 'В работе' : 'Ожидает решения';
  }
  function typeClass(r) { return 'status-'+statusType([r.status,r.access,r.readiness,r.notes].join(' ')); }
  function uniqueAddresses() { return new Set(records.map(r => norm(r.address)).filter(Boolean)).size; }
  function render() {
    const addresses = uniqueAddresses();
    el('statObjects').textContent = addresses;
    el('statBuilt').textContent = new Set(records.filter(r=>statusType([r.status,r.notes].join(' '))==='built').map(r=>norm(r.address)).filter(Boolean)).size;
    el('statActive').textContent = new Set(records.filter(r=>statusType([r.status,r.notes].join(' '))==='active').map(r=>norm(r.address)).filter(Boolean)).size;
    el('statAttention').textContent = new Set(records.filter(r=>statusType([r.status,r.access,r.readiness,r.notes].join(' '))==='attention').map(r=>norm(r.address)).filter(Boolean)).size;
    const q = norm(el('searchInput').value);
    const rows = records.filter(r => {
      const haystack = norm([r.address,r.project,r.status,r.notes,r.access,r.readiness,r.tu].join(' '));
      return (!q || haystack.includes(q)) && (activeFilter==='all' || statusType([r.status,r.access,r.readiness,r.notes].join(' '))===activeFilter);
    });
    el('emptyState').classList.toggle('hidden',records.length>0);
    el('tableFooter').classList.toggle('hidden',records.length===0);
    el('rowCount').textContent = `${rows.length} ${plural(rows.length,'запись','записи','записей')} · ${uniqueAddresses()} ${plural(uniqueAddresses(),'адрес','адреса','адресов')}`;
    if (!records.length) { el('objectRows').innerHTML=''; }
    else if (!rows.length) { el('objectRows').innerHTML='<tr><td colspan="5"><div class="no-results">По вашему запросу ничего не найдено</div></td></tr>'; }
    else {
      el('objectRows').innerHTML=rows.slice(0,100).map((r) => {
        const i=records.indexOf(r), group=records.filter(x=>norm(x.address)===norm(r.address)).length;
        return `<tr data-index="${i}" class="data-row"><td><div class="address-cell"><span class="location-icon">⌖</span><div><div class="address-title">${esc(r.address||'Адрес не указан')}</div><div class="address-sub">${group>1?`${group} записи по адресу`:esc(r.city||'Карточка объекта')}</div></div></div></td><td>${esc(r.project||'—')}</td><td><span class="status-pill ${typeClass(r)}">${esc(statusLabel(r))}</span></td><td>${esc(r.year||r.updated||'—')}</td><td><button class="row-more" aria-label="Открыть объект" data-open="${i}">···</button></td></tr>`;
      }).join('');
    }
    renderActivity();
  }
  function plural(n,one,few,many) { const x=n%100; if(x>=11&&x<=14)return many; const d=n%10; return d===1?one:d>=2&&d<=4?few:many; }
  function renderActivity() {
    const latest=records.slice(-4).reverse();
    el('activityList').innerHTML=latest.length ? latest.map(r=>`<div class="activity-item"><span class="activity-dot" style="background:${statusType([r.status,r.notes].join(' '))==='built'?'#38a581':statusType([r.status,r.notes].join(' '))==='attention'?'#d39a46':'#7387e8'}"></span><div><p><b>${esc(r.address||'Новый объект')}</b> · ${esc(statusLabel(r))}</p><small>${esc(r.project||'Импорт из файла')} ${r.year?'· '+esc(r.year):''}</small></div></div>`).join('') : '<div class="activity-empty"><span class="activity-empty-icon">◷</span><p>Здесь появятся события по вашим объектам</p></div>';
  }
  function showToast(msg) { const t=el('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3500); }
  function openObject(index) {
    const r=records[index]; if(!r)return;
    const same=records.filter(x=>norm(x.address)===norm(r.address));
    el('dialogContent').innerHTML=`<div class="dialog-kicker">ИСТОРИЯ ОБЪЕКТА · ${same.length} ${plural(same.length,'ЗАПИСЬ','ЗАПИСИ','ЗАПИСЕЙ')}</div><h2 class="dialog-title">${esc(r.address||'Адрес не указан')}</h2><p class="dialog-subtitle">Собранная история по адресу из всех импортированных проектов</p><div class="history-list">${same.map(x=>`<article class="history-card"><div class="history-card-head"><div><div class="history-project">${esc(x.project||'Проект не указан')}</div><div class="history-meta">${esc(x.year||'Дата не указана')}</div></div><span class="status-pill ${typeClass(x)}">${esc(statusLabel(x))}</span></div><div class="history-grid">${[['Допуск',x.access],['Стройготовность',x.readiness],['Технические условия',x.tu],['Стоимость',x.cost],['Решение / комментарий',x.notes]].filter(a=>a[1]).map(a=>`<div class="history-field"><label>${esc(a[0].toLocaleUpperCase('ru'))}</label><div>${esc(a[1])}</div></div>`).join('')}</div></article>`).join('')}</div>`;
    el('objectDialog').showModal();
  }
  function parseCsv(text) {
    const first=(text.split(/\r?\n/)[0]||'');
    const delimiters=['\t','; ',','].sort((a,b)=>first.split(b).length-first.split(a).length);
    const delimiter=delimiters[0]; let rows=[], row=[], cell='', quoted=false;
    for(let i=0;i<text.length;i++) { const c=text[i]; if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;} else if(c===delimiter&&!quoted){row.push(cell);cell='';} else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c; }
    row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
  }
  function rowsFromMatrix(matrix) {
    const nonempty=matrix.filter(row=>Array.isArray(row)&&row.some(v=>clean(v)));
    if(!nonempty.length)return {headers:[],rows:[]};
    let headerIndex=nonempty.findIndex(row=>row.some(c=>fields.some(f=>f.aliases.some(a=>norm(c)===norm(a)))));
    if(headerIndex<0)headerIndex=0;
    const headers=nonempty[headerIndex].map((v,i)=>clean(v)||`Столбец ${i+1}`);
    const rows=nonempty.slice(headerIndex+1).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]??'']))).filter(row=>Object.values(row).some(v=>clean(v)));
    return {headers,rows};
  }
  function guessHeader(f,headers) { return headers.findIndex(h=>f.aliases.some(a=>norm(h)===norm(a))) ; }
  function importRows(rawRows, headers, mapping) {
    const normalized=rawRows.map(row=>{
      const out={}; for(const f of fields){const col=mapping[f.key];out[f.key]=col?clean(row[col]):'';}
      out.sourceFile=el('fileInput').files[0]?.name||'Импорт';out.updated=new Date().toLocaleDateString('ru-RU');return out;
    }).filter(r=>Object.values(r).some(Boolean));
    if(!normalized.length){showToast('В файле не удалось найти строки с данными.');return;}
    const addressCount=normalized.filter(r=>r.address).length;
    records=records.concat(normalized);persist();render();
    showToast(`Добавлено ${normalized.length} ${plural(normalized.length,'запись','записи','записей')}${addressCount<normalized.length?' · проверьте столбец с адресом':''}`);
  }
  function mapRows(headers, rawRows) {
    const mapping={}; fields.forEach(f=>{const i=guessHeader(f,headers);mapping[f.key]=i>=0?headers[i]:'';});
    const addressMapped=!!mapping.address;
    if(addressMapped) { importRows(rawRows,headers,mapping); return; }
    const content=el('mappingContent');
    content.innerHTML=`<div class="dialog-kicker">СОПОСТАВЛЕНИЕ СТОЛБЦОВ</div><h2 class="dialog-title">Уточните поля файла</h2><p class="mapping-intro">Не удалось автоматически определить адрес. Выберите, какой столбец соответствует каждому полю. Это поможет корректно объединять записи по объектам.</p><div class="mapping-list">${fields.map(f=>`<div class="mapping-row"><label for="map-${f.key}">${esc(f.label)}</label><span class="mapping-arrow">←</span><select id="map-${f.key}" data-field="${f.key}"><option value="">Не использовать</option>${headers.map(h=>`<option value="${esc(h)}" ${f.key==='address'&&guessHeader(f,headers)<0&&headers.indexOf(h)===0?'selected':''}>${esc(h)}</option>`).join('')}</select></div>`).join('')}</div><div class="mapping-actions"><button class="cancel-btn" id="cancelMapping">Отмена</button><button class="button primary" id="applyMapping">Импортировать строки</button></div>`;
    el('mappingDialog').showModal();
    el('cancelMapping').onclick=()=>el('mappingDialog').close();
    el('applyMapping').onclick=()=>{const m={};content.querySelectorAll('select').forEach(s=>m[s.dataset.field]=s.value);if(!m.address){showToast('Укажите столбец с адресом объекта.');return;}el('mappingDialog').close();importRows(rawRows,headers,m);};
  }
  async function handleFile(file) {
    if(!file)return;
    const ext=file.name.split('.').pop().toLowerCase();
    try {
      let parsed;
      if(ext==='json') { const data=JSON.parse(await file.text());const list=Array.isArray(data)?data:(data.rows||data.data||[]);if(!list.length)throw new Error('В JSON не найден массив объектов.');const headers=[...new Set(list.flatMap(x=>Object.keys(x)))];parsed={headers,rows:list}; }
      else if(['csv','tsv'].includes(ext)) { const matrix=parseCsv(await file.text());parsed=rowsFromMatrix(matrix); }
      else if(['xlsx','xls'].includes(ext)) { if(!window.XLSX)throw new Error('Для чтения Excel требуется подключение к интернету. Сохраните лист как CSV и попробуйте снова.');const data=await file.arrayBuffer();const wb=XLSX.read(data,{type:'array',cellDates:true});const sheet=wb.Sheets[wb.SheetNames[0]];parsed=rowsFromMatrix(XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false})); }
      else throw new Error('Формат не поддерживается. Выберите Excel, CSV или JSON.');
      if(!parsed.headers.length||!parsed.rows.length)throw new Error('Файл пустой или не содержит таблицу с заголовками.');
      pendingHeaders=parsed.headers;pendingRows=parsed.rows;mapRows(pendingHeaders,pendingRows);
    } catch(err) { showToast(err.message||'Не удалось прочитать файл.'); }
    el('fileInput').value='';
  }
  el('fileInput').addEventListener('change',e=>handleFile(e.target.files[0]));
  el('searchInput').addEventListener('input',render);
  el('objectRows').addEventListener('click',e=>{const btn=e.target.closest('[data-open]');const row=e.target.closest('[data-index]');if(btn)openObject(Number(btn.dataset.open));else if(row)openObject(Number(row.dataset.index));});
  el('filterButton').addEventListener('click',()=>el('filterStrip').classList.toggle('show'));
  el('filterStrip').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;activeFilter=b.dataset.filter;el('filterStrip').querySelectorAll('.filter-chip').forEach(x=>x.classList.toggle('selected',x===b));render();});
  el('showAll').addEventListener('click',()=>{activeFilter='all';el('searchInput').value='';el('filterStrip').classList.add('show');el('filterStrip').querySelectorAll('.filter-chip').forEach(x=>x.classList.toggle('selected',x.dataset.filter==='all'));render();});
  document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();el('searchInput').focus();}});
  const d=new Date();el('today').textContent=d.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
  render();
})();
