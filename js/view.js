class StatsView{
  constructor(vm){ this.vm=vm; vm.onStatsChanged(s=>this.render(s)); this.render(vm.stats()); }
  render(s){
    document.getElementById('xpLbl').textContent = s.xp+' XP';
    document.getElementById('progLbl').textContent = s.solved+'/30';
    document.getElementById('streakLbl').textContent = s.streak;
  }
}

class MapView{
  constructor(vm){
    this.vm=vm;
    vm.onNavigate(p=>{ if(p.view==='map'){ this.render(); this.show(); } else { this.hide(); } });
  }
  show(){ document.getElementById('mapView').classList.remove('hidden'); }
  hide(){ document.getElementById('mapView').classList.add('hidden'); }
  render(){
    this.vm.mapData().forEach(group=>{
      const box=document.getElementById('tier'+group.tier);
      box.innerHTML='';
      group.exercises.forEach(ex=>{
        const d=document.createElement('div');
        d.className='node '+(ex.solved?'solved':(ex.unlocked?group.meta.cls:'locked'));
        d.textContent = ex.solved?'✓':(ex.unlocked?ex.id:'🔒');
        d.title=ex.title;
        if(ex.unlocked) d.onclick=()=>this.vm.openExercise(ex.id);
        box.appendChild(d);
      });
    });
  }
}

/* Tablero de granja: dibuja variables y vectores REALES como cestas de fruta
   (una casilla A con, por ejemplo, 5 manzanas 🍎 si A vale 5) y las actualiza
   evento a evento según lo que el intérprete reporta que tu programa hizo. */
function fmtVal(v){ if(typeof v!=='number') return String(v); return Number.isInteger(v)? String(v) : String(Math.round(v*100)/100); }

const FRUITS = ['🍎','🍊','🍇','🍓','🥝','🍋','🍑'];
function hashName(name){ let h=0; for(const c of String(name)) h=(h*31+c.charCodeAt(0))>>>0; return h; }
function fruitFor(name){ return FRUITS[hashName(name)%FRUITS.length]; }

/* Construye el contenido gráfico de una casilla a partir de su valor numérico. */
function fruitMarkup(value, icon){
  if(typeof value!=='number' || Number.isNaN(value)) return '<div class="fruits">❔</div>';
  const isNeg = value<0;
  const isFloat = !Number.isInteger(value);
  const n = Math.round(Math.abs(value));
  if(isFloat || n>18){
    // Valores grandes o decimales: una sola fruta "grande" con el número, para no saturar.
    return '<div class="fruits big">'+(isNeg?'🥀':icon)+'</div>';
  }
  if(n===0) return '<div class="fruits">🫙</div>';
  const symbol = isNeg? '🥀' : icon;
  return '<div class="fruits">'+symbol.repeat(n)+'</div>';
}

class FarmBoard{
  constructor(container){ this.container=container; }
  reset(){
    this.container.innerHTML=''; this.rows={}; this.scalars={};
    this.scalarWrap=document.createElement('div'); this.scalarWrap.className='flex flex-wrap gap-2';
    this.statusEl=document.createElement('div'); this.statusEl.className='text-xs text-[var(--muted)]';
    this.statusEl.textContent='Presiona ▶ Ejecutar para ver tu programa en acción.';
    this.container.appendChild(this.scalarWrap); this.container.appendChild(this.statusEl);
    this.harvestCount=0;
  }
  ensureRow(name, minLen){
    if(!this.rows[name]){
      const wrap=document.createElement('div');
      const label=document.createElement('div'); label.className='text-xs font-bold text-[var(--muted)] mb-1'; label.textContent='🌾 vector '+name;
      const cellsWrap=document.createElement('div'); cellsWrap.className='flex flex-wrap gap-2';
      wrap.appendChild(label); wrap.appendChild(cellsWrap);
      this.container.insertBefore(wrap, this.statusEl);
      this.rows[name]={wrap,cellsWrap,cells:[],icon:fruitFor(name)};
    }
    const row=this.rows[name];
    while(row.cells.length<minLen){
      const idx=row.cells.length;
      const c=document.createElement('div'); c.className='crate';
      c.innerHTML='<div class="idx">'+name+'['+idx+']</div><div class="fruits">🫙</div><div class="val">0</div>';
      row.cellsWrap.appendChild(c); row.cells.push(c);
    }
    return row;
  }
  setScalar(name,value){
    let box=this.scalars[name];
    if(!box){
      box=document.createElement('div'); box.className='crate';
      this.scalarWrap.appendChild(box); this.scalars[name]={el:box, icon:fruitFor(name+'#s')};
      box=this.scalars[name];
    }
    box.el.innerHTML='<div class="idx">'+name+'</div>'+fruitMarkup(value, box.icon)+'<div class="val">'+fmtVal(value)+'</div>';
    box.el.classList.remove('on'); void box.el.offsetWidth; box.el.classList.add('on');
  }
  setCell(name,idx,value){
    const row=this.ensureRow(name, idx+1);
    const cell=row.cells[idx];
    cell.innerHTML='<div class="idx">'+name+'['+idx+']</div>'+fruitMarkup(value, row.icon)+'<div class="val">'+fmtVal(value)+'</div>';
    cell.classList.remove('on'); void cell.offsetWidth; cell.classList.add('on');
  }
  initArray(name,values){
    const row=this.ensureRow(name, values.length);
    values.forEach((v,i)=>{
      row.cells[i].innerHTML='<div class="idx">'+name+'['+i+']</div>'+fruitMarkup(v, row.icon)+'<div class="val">'+fmtVal(v)+'</div>';
    });
  }
  peek(name,idx){
    const row=this.rows[name]; if(!row||!row.cells[idx]) return;
    row.cells[idx].classList.add('peek');
    setTimeout(()=>row.cells[idx] && row.cells[idx].classList.remove('peek'), 260);
  }
  status(t){ if(this.statusEl) this.statusEl.textContent=t; }
  harvest(){ this.harvestCount++; this.status('🧺 Salida impresa: '+this.harvestCount+' línea(s).'); }
}

class ExerciseView{
  constructor(vm){
    this.vm=vm; this.playTimer=null;
    this.farmBoard=new FarmBoard(document.getElementById('farmBoard'));
    vm.onNavigate(p=>{ if(p.view==='exercise') this.open(p.exercise, p.code); else this.hide(); });
    vm.onCodeReset(p=>{ this.setEditorValue(p.code); });
    vm.onRunResult(r=>this.showResult(r));

    document.getElementById('backBtn').onclick=()=>vm.backToMap();
    document.getElementById('resetBtn').onclick=()=>vm.resetCode();
    document.getElementById('runBtn').onclick=()=>vm.run(document.getElementById('editor').value);
    const editor=document.getElementById('editor');
    editor.addEventListener('input', e=>{ vm.saveDraft(e.target.value); this.paintHighlight(); });
    editor.addEventListener('scroll', ()=>{
      const hl=document.getElementById('highlightLayer');
      hl.scrollTop=editor.scrollTop; hl.scrollLeft=editor.scrollLeft;
    });
    editor.addEventListener('keydown', e=>{
      if(e.key==='Tab'){ e.preventDefault(); const s=editor.selectionStart, en=editor.selectionEnd;
        editor.value = editor.value.slice(0,s)+'    '+editor.value.slice(en);
        editor.selectionStart=editor.selectionEnd=s+4; this.paintHighlight(); vm.saveDraft(editor.value); }
    });
  }
  setEditorValue(code){ document.getElementById('editor').value=code; this.paintHighlight(); }
  paintHighlight(){
    const code=document.getElementById('editor').value;
    document.querySelector('#highlightLayer code').innerHTML = highlightCpp(code);
  }
  hide(){ document.getElementById('exView').classList.add('hidden'); }
  open(ex, code){
    document.getElementById('mapView').classList.add('hidden');
    document.getElementById('exView').classList.remove('hidden');
    const meta=TIER_META[ex.tier];
    const badge=document.getElementById('exBadge');
    badge.className='text-xs font-bold inline-block px-2 py-1 rounded-md mb-2 '+meta.badge;
    badge.textContent = meta.label+' · Ejercicio '+ex.id;
    document.getElementById('exTitle').textContent=ex.title;
    document.getElementById('exDesc').textContent=ex.desc;
    this.setEditorValue(code);
    document.getElementById('consoleBox').textContent='// La salida de tu programa aparecerá aquí';
    document.getElementById('resultBanner').className='hidden';
    this.farmBoard.reset();
  }
  playTrace(trace, onDone){
    if(this.playTimer) clearInterval(this.playTimer);
    this.farmBoard.reset();
    const consoleBox=document.getElementById('consoleBox'); consoleBox.textContent='';
    const cap=trace.slice(0,150);
    const delay=Math.max(15, Math.min(80, 2600/Math.max(cap.length,1)));
    let i=0;
    this.playTimer=setInterval(()=>{
      if(i>=cap.length){ clearInterval(this.playTimer); this.farmBoard.status('✅ Ejecución terminada.'); if(onDone) onDone(); return; }
      const ev=cap[i];
      switch(ev.kind){
        case 'initArray': this.farmBoard.initArray(ev.name, ev.values); this.farmBoard.status('Sembrando el vector '+ev.name+'...'); break;
        case 'setCell': this.farmBoard.setCell(ev.name, ev.idx, ev.value); this.farmBoard.status('Actualizando '+ev.name+'['+ev.idx+']...'); break;
        case 'compare': this.farmBoard.peek(ev.name1, ev.idx1); this.farmBoard.peek(ev.name2, ev.idx2); this.farmBoard.status('Comparando '+ev.name1+'['+ev.idx1+'] con '+ev.name2+'['+ev.idx2+']...'); break;
        case 'var': this.farmBoard.setScalar(ev.name, ev.value); this.farmBoard.status('Actualizando la variable '+ev.name+'...'); break;
        case 'loop': if(ev.name!=null) this.farmBoard.status('Ciclo for: '+ev.name+' = '+ev.value); break;
        case 'print': consoleBox.textContent += ev.text; this.farmBoard.harvest(); break;
      }
      i++;
    }, delay);
  }
  showResult(r){
    const banner=document.getElementById('resultBanner');
    if(!r.ok){
      this.farmBoard.reset();
      this.farmBoard.status('⚠️ Se detuvo por un error.');
      document.getElementById('consoleBox').textContent='⚠️ '+r.error;
      banner.className='p-3 rounded-xl font-semibold text-sm bg-[var(--red)]/20 border border-[var(--red)] text-[var(--red)]';
      banner.textContent='❌ Hay un error en tu código: '+r.error;
      return;
    }
    this.playTrace(r.trace, ()=>{
      document.getElementById('consoleBox').textContent = r.output || '(sin salida)';
      if(r.match){
        banner.className='p-3 rounded-xl font-semibold text-sm bg-[var(--green)]/20 border border-[var(--green)] text-[var(--green)]';
        banner.textContent='✅ ¡Correcto! Tu lógica funciona sin importar qué valores hayas elegido. Cosechaste este ejercicio.';
      } else {
        banner.className='p-3 rounded-xl font-semibold text-sm bg-[var(--yellow)]/20 border border-[var(--yellow)] text-[var(--yellow)]';
        banner.textContent='❌ '+(r.message || 'Tu salida no cumple todavía con lo que pide el ejercicio.');
      }
    });
  }
}

/* =========================================================
   BOOTSTRAP — composición: se arma el grafo de objetos.
   ========================================================= */
