/* VIEWMODEL — expone estado (bindings) y comandos. La View solo lee de
   aquí y delega acciones; nunca toca el Model directamente. */

class AppViewModel{
  constructor(progressModel, codeRepo, execService){
    this.progress=progressModel; this.codeRepo=codeRepo; this.exec=execService;
    this.bus=new EventBus();
    this.currentExercise=null;
  }
  onNavigate(fn){ this.bus.on('navigate', fn); }
  onCodeReset(fn){ this.bus.on('codeReset', fn); }
  onRunResult(fn){ this.bus.on('runResult', fn); }
  onStatsChanged(fn){ this.bus.on('stats', fn); }

  // ---- lecturas (bindings) ----
  mapData(){
    return [1,2,3].map(tier=>({
      tier, meta:TIER_META[tier],
      exercises:ExerciseModel.byTier(tier).map(ex=>({
        id:ex.id, title:ex.title,
        solved:this.progress.isSolved(ex.id),
        unlocked:this.progress.isUnlocked(ex.id)
      }))
    }));
  }
  stats(){ return {xp:this.progress.xp, streak:this.progress.streak, solved:this.progress.solved.length}; }

  // ---- comandos (acciones del usuario) ----
  openExercise(id){
    const ex=ExerciseModel.byId(id);
    if(!ex || !this.progress.isUnlocked(id)) return;
    this.currentExercise=ex;
    this.bus.emit('navigate', {view:'exercise', exercise:ex, code:this.codeRepo.load(ex)});
  }
  backToMap(){
    this.currentExercise=null;
    this.bus.emit('navigate', {view:'map'});
    this.bus.emit('stats', this.stats());
  }
  resetCode(){
    if(!this.currentExercise) return;
    this.bus.emit('codeReset', {code:this.codeRepo.reset(this.currentExercise)});
  }
  saveDraft(code){ if(this.currentExercise) this.codeRepo.save(this.currentExercise, code); }
  run(code){
    if(!this.currentExercise) return;
    this.saveDraft(code);
    const result=this.exec.run(this.currentExercise, code);
    if(result.ok && result.match) this.progress.markSolved(this.currentExercise.id);
    this.bus.emit('runResult', result);
    this.bus.emit('stats', this.stats());
  }
}

/* =========================================================
   VIEW — solo DOM. Se suscribe a la VM y le delega comandos.
   ========================================================= */
