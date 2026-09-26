/* MODEL — datos puros y persistencia. No conoce el DOM. */

class ExerciseModel{
  static all(){ return EX; }
  static byId(id){ return EX.find(e=>e.id===id); }
  static byTier(tier){ return EX.filter(e=>e.tier===tier); }
  static starterFor(ex){
    return "#include <iostream>\nusing namespace std;\n\nint main()\n{\n    // "+ex.title+"\n    // Escribe tu código aquí\n\n    return 0;\n}\n";
  }
}

class ProgressModel{
  constructor(storage){ this.storage=storage; this.state=this._load(); }
  _load(){ try{ const raw=this.storage.getItem('codefarm_progress'); if(raw) return JSON.parse(raw); }catch(e){} return {solved:[], streak:0}; }
  _save(){ try{ this.storage.setItem('codefarm_progress', JSON.stringify(this.state)); }catch(e){} }
  get solved(){ return this.state.solved; }
  get streak(){ return this.state.streak||0; }
  get xp(){ return this.state.solved.length*10; }
  isSolved(id){ return this.state.solved.includes(id); }
  isUnlocked(id){ return id===1 || this.state.solved.includes(id-1) || this.state.solved.includes(id); }
  markSolved(id){
    if(this.state.solved.includes(id)) return false;
    this.state.solved.push(id);
    this.state.streak=(this.state.streak||0)+1;
    this._save();
    return true;
  }
}

class CodeRepository{
  constructor(storage){ this.storage=storage; }
  _key(id){ return 'codefarm_code_'+id; }
  load(ex){ try{ const v=this.storage.getItem(this._key(ex.id)); if(v) return v; }catch(e){} return ExerciseModel.starterFor(ex); }
  save(ex, code){ try{ this.storage.setItem(this._key(ex.id), code); }catch(e){} }
  reset(ex){ return ExerciseModel.starterFor(ex); }
}

class RunResult{
  constructor(o){ Object.assign(this,{ok:true,error:null,output:'',expected:'',match:false,trace:[]},o); }
}

/* ExecutionService y CHECKERS provistos por el módulo de checkers (ver arriba). */

/* =========================================================
   Pequeño EventBus para el data-binding observable de la VM.
   ========================================================= */
class EventBus{
  constructor(){ this.l={}; }
  on(evt,fn){ (this.l[evt]=this.l[evt]||[]).push(fn); }
  emit(evt,payload){ (this.l[evt]||[]).forEach(fn=>fn(payload)); }
}

/* =========================================================
   VIEWMODEL — expone estado + comandos. La View solo lee de
   aquí y le delega las acciones del usuario; nunca toca el
   Model directamente.
   ========================================================= */
