function tokenize(src){
  src = src.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/\/\/.*$/gm,' ');
  const toks=[]; let i=0; const n=src.length;
  const isD=c=>c>='0'&&c<='9';
  const isA=c=>/[A-Za-z_]/.test(c);
  while(i<n){
    const c=src[i];
    if(/\s/.test(c)){i++;continue;}
    if(isD(c) || (c==='.'&&isD(src[i+1]))){
      let j=i; let isFloat=false;
      while(j<n && (isD(src[j])||src[j]==='.')){ if(src[j]==='.')isFloat=true; j++; }
      toks.push({t:'num',v:parseFloat(src.slice(i,j)),isInt:!isFloat}); i=j; continue;
    }
    if(isA(c)){
      let j=i; while(j<n && /[A-Za-z0-9_]/.test(src[j])) j++;
      toks.push({t:'id',v:src.slice(i,j)}); i=j; continue;
    }
    if(c==='"'){
      let j=i+1,s='';
      while(j<n && src[j]!=='"'){ if(src[j]==='\\'){ s+=({n:'\n',t:'\t'}[src[j+1]]||src[j+1]); j+=2;} else { s+=src[j]; j++; } }
      toks.push({t:'str',v:s}); i=j+1; continue;
    }
    const two=src.slice(i,i+2);
    if(['<<','>>','<=','>=','==','!=','&&','||','++','--'].includes(two)){ toks.push({t:'op',v:two}); i+=2; continue; }
    if('+-*/%=<>(){}[];,!.'.includes(c)){ toks.push({t:'op',v:c}); i++; continue; }
    i++;
  }
  toks.push({t:'eof',v:null});
  return toks;
}

function extractMainBody(src){
  const mi = src.indexOf('main');
  if(mi<0) return src;
  const bi = src.indexOf('{', mi);
  if(bi<0) return src;
  let depth=0, j=bi;
  for(; j<src.length; j++){
    if(src[j]==='{') depth++;
    else if(src[j]==='}'){ depth--; if(depth===0) break; }
  }
  return src.slice(bi+1, j);
}

class Parser{
  constructor(toks){ this.toks=toks; this.p=0; }
  peek(o=0){ return this.toks[this.p+o]; }
  next(){ return this.toks[this.p++]; }
  isOp(v){ const t=this.peek(); return t.t==='op'&&t.v===v; }
  isId(v){ const t=this.peek(); return t.t==='id'&&t.v===v; }
  expectOp(v){ if(!this.isOp(v)) throw new Error('Se esperaba "'+v+'" y se encontró "'+(this.peek().v)+'"'); return this.next(); }
  TYPES=['int','float','double','long','short'];
  parseProgram(){ const s=[]; while(this.peek().t!=='eof'){ s.push(this.parseStmt()); } return {k:'block',body:s}; }
  parseBlock(){ this.expectOp('{'); const s=[]; while(!this.isOp('}')){ s.push(this.parseStmt()); } this.expectOp('}'); return {k:'block',body:s}; }
  parseStmt(){
    if(this.isOp('{')) return this.parseBlock();
    if(this.isId('if')) return this.parseIf();
    if(this.isId('for')) return this.parseFor();
    if(this.isId('cout')) return this.parseCout();
    if(this.isId('return')){ this.next(); if(!this.isOp(';')) this.parseExpr(); this.expectOp(';'); return {k:'return'}; }
    if(this.peek().t==='id' && this.TYPES.includes(this.peek().v)) return this.parseDecl();
    const e=this.parseExpr(); this.expectOp(';'); return {k:'exprstmt', e};
  }
  parseDecl(){
    const type=this.next().v; const isInt=(type==='int'||type==='long'||type==='short');
    const decls=[];
    do{
      const name=this.next().v;
      let size=null, init=null, isArr=false;
      if(this.isOp('[')){ this.next(); isArr=true; if(!this.isOp(']')) size=this.parseExpr(); this.expectOp(']'); }
      if(this.isOp('=')){
        this.next();
        if(this.isOp('{')){
          this.next(); init=[]; if(!this.isOp('}')){ init.push(this.parseAssign()); while(this.isOp(',')){ this.next(); init.push(this.parseAssign()); } } this.expectOp('}');
        } else { init=this.parseAssign(); }
      }
      decls.push({name,size,init,isArr});
    } while(this.isOp(',') && this.next());
    this.expectOp(';');
    return {k:'decl', isInt, decls};
  }
  parseIf(){
    this.next(); this.expectOp('('); const cond=this.parseExpr(); this.expectOp(')');
    const then=this.parseStmt(); let els=null;
    if(this.isId('else')){ this.next(); els=this.parseStmt(); }
    return {k:'if', cond, then, els};
  }
  parseFor(){
    this.next(); this.expectOp('(');
    let init=null;
    if(!this.isOp(';')){
      if(this.peek().t==='id'&&this.TYPES.includes(this.peek().v)) init=this.parseDeclNoSemi();
      else { init=this.parseExpr(); }
    }
    this.expectOp(';');
    let cond=null; if(!this.isOp(';')) cond=this.parseExpr(); this.expectOp(';');
    let upd=null; if(!this.isOp(')')) upd=this.parseExpr(); this.expectOp(')');
    const body=this.parseStmt();
    return {k:'for', init, cond, upd, body};
  }
  parseDeclNoSemi(){
    const type=this.next().v; const isInt=(type==='int'||type==='long'||type==='short');
    const name=this.next().v; let init=null;
    if(this.isOp('=')){ this.next(); init=this.parseAssign(); }
    return {k:'decl', isInt, decls:[{name,size:null,init,isArr:false}]};
  }
  parseCout(){
    this.next();
    const parts=[];
    while(this.isOp('<<')){ this.next(); parts.push(this.parseAssign()); }
    this.expectOp(';');
    return {k:'cout', parts};
  }
  // expression grammar
  parseExpr(){ return this.parseAssign(); }
  parseAssign(){
    const left=this.parseLogicOr();
    if(this.isOp('=')){ this.next(); const right=this.parseAssign(); return {k:'assign', left, right}; }
    return left;
  }
  parseLogicOr(){ let l=this.parseLogicAnd(); while(this.isOp('||')){ this.next(); l={k:'bin',op:'||',l,r:this.parseLogicAnd()}; } return l; }
  parseLogicAnd(){ let l=this.parseEq(); while(this.isOp('&&')){ this.next(); l={k:'bin',op:'&&',l,r:this.parseEq()}; } return l; }
  parseEq(){ let l=this.parseRel(); while(this.isOp('==')||this.isOp('!=')){ const op=this.next().v; l={k:'bin',op,l,r:this.parseRel()}; } return l; }
  parseRel(){ let l=this.parseAdd(); while(this.isOp('<')||this.isOp('>')||this.isOp('<=')||this.isOp('>=')){ const op=this.next().v; l={k:'bin',op,l,r:this.parseAdd()}; } return l; }
  parseAdd(){ let l=this.parseMul(); while(this.isOp('+')||this.isOp('-')){ const op=this.next().v; l={k:'bin',op,l,r:this.parseMul()}; } return l; }
  parseMul(){ let l=this.parseUnary(); while(this.isOp('*')||this.isOp('/')||this.isOp('%')){ const op=this.next().v; l={k:'bin',op,l,r:this.parseUnary()}; } return l; }
  parseUnary(){
    if(this.isOp('-')){ this.next(); return {k:'neg', e:this.parseUnary()}; }
    if(this.isOp('!')){ this.next(); return {k:'not', e:this.parseUnary()}; }
    if(this.isOp('++')){ this.next(); const e=this.parseUnary(); return {k:'preinc', e, d:1}; }
    if(this.isOp('--')){ this.next(); const e=this.parseUnary(); return {k:'preinc', e, d:-1}; }
    return this.parsePostfix();
  }
  parsePostfix(){
    let e=this.parsePrimary();
    for(;;){
      if(this.isOp('[')){ this.next(); const idx=this.parseExpr(); this.expectOp(']'); e={k:'index', arr:e, idx}; }
      else if(this.isOp('++')){ this.next(); e={k:'postinc', e, d:1}; }
      else if(this.isOp('--')){ this.next(); e={k:'postinc', e, d:-1}; }
      else break;
    }
    return e;
  }
  parsePrimary(){
    const t=this.peek();
    if(t.t==='num'){ this.next(); return {k:'num', v:t.v, isInt:t.isInt}; }
    if(t.t==='str'){ this.next(); return {k:'str', v:t.v}; }
    if(t.t==='id'){ this.next(); return {k:'id', v:t.v}; }
    if(this.isOp('(')){ this.next(); const e=this.parseExpr(); this.expectOp(')'); return e; }
    throw new Error('Token inesperado: '+JSON.stringify(t));
  }
}

class ReturnSignal{}
class Interp{
  constructor(){ this.output=[]; this.trace=[]; this.steps=0; this.maxSteps=200000; this.declHistory={}; this.forCount=0; }
  run(src){
    const body = extractMainBody(src);
    const toks = tokenize(body);
    const ast = new Parser(toks).parseProgram();
    this.countFor(ast);
    const scope = {vars:{}, types:{}, parent:null};
    try{ this.execBlock(ast, scope); } catch(e){ if(!(e instanceof ReturnSignal)) throw e; }
    return {output:this.output.join(''), trace:this.trace, vars:scope.vars, init:this.declHistory, forCount:this.forCount};
  }
  countFor(node){
    if(!node) return;
    if(Array.isArray(node)){ node.forEach(n=>this.countFor(n)); return; }
    if(typeof node!=='object') return;
    if(node.k==='for') this.forCount++;
    for(const key in node){ if(key==='k') continue; this.countFor(node[key]); }
  }
  newScope(parent){ return {vars:{}, types:{}, parent}; }
  lookup(scope, name){ let s=scope; while(s){ if(name in s.vars) return s; s=s.parent; } return null; }
  getVar(scope, name){ const s=this.lookup(scope,name); if(!s) throw new Error('Variable no declarada: '+name); return s.vars[name]; }
  setVar(scope, name, val){ const s=this.lookup(scope,name); if(!s) throw new Error('Variable no declarada: '+name); s.vars[name]=val; }
  step(){ this.steps++; if(this.steps>this.maxSteps) throw new Error('Demasiadas iteraciones (posible bucle infinito)'); }
  execBlock(block, scope){ for(const st of block.body){ this.exec(st, scope); } }
  exec(st, scope){
    this.step();
    switch(st.k){
      case 'block': { const s2=this.newScope(scope); this.execBlock(st, s2); return; }
      case 'decl': {
        for(const d of st.decls){
          if(d.isArr){
            let arr=[];
            if(d.init){ arr = d.init.map(e=>this.evalNum(e,scope)); }
            else { const sz = d.size? Math.trunc(this.evalNum(d.size,scope).v):0; arr=new Array(sz).fill({v:0,isInt:st.isInt}); }
            scope.vars[d.name]=arr;
            if(!(d.name in this.declHistory)) this.declHistory[d.name]=arr.map(c=>({v:c.v,isInt:c.isInt}));
            if(d.init) this.trace.push({kind:'initArray', name:d.name, values:arr.map(c=>c.v)});
          } else {
            const val = d.init? this.evalNum(d.init,scope) : {v:0,isInt:st.isInt};
            scope.vars[d.name]={v:val.v,isInt:st.isInt};
            if(!(d.name in this.declHistory)) this.declHistory[d.name]={v:val.v,isInt:st.isInt};
            if(d.init) this.trace.push({kind:'var', name:d.name, value:val.v});
          }
        }
        return;
      }
      case 'if': {
        const c=this.evalNum(st.cond,scope).v;
        this.trace.push({kind:'exec'});
        if(c) this.exec(st.then,scope); else if(st.els) this.exec(st.els,scope);
        return;
      }
      case 'for': {
        const s2=this.newScope(scope);
        if(st.init) this.exec(st.init.k==='decl'?st.init:{k:'exprstmt',e:st.init}, s2);
        let guard=0;
        while(true){
          guard++; if(guard>1000000) throw new Error('Bucle demasiado largo');
          if(st.cond && !this.evalNum(st.cond,s2).v) break;
          const loopVarName = (st.init && st.init.k==='decl') ? st.init.decls[0].name : null;
          this.trace.push({kind:'loop', name:loopVarName, value: loopVarName? this.getVar(s2,loopVarName).v : null});
          this.exec(st.body, s2);
          if(st.upd) this.evalNum(st.upd,s2);
          if(!st.cond) { if(guard>100000) break; }
        }
        return;
      }
      case 'cout': {
        let line='';
        for(const p of st.parts){
          if(p.k==='id' && p.v==='endl'){ line+='\n'; continue; }
          const val=this.evalAny(p,scope);
          line+= (typeof val==='string')? val : formatNum(val);
        }
        this.output.push(line);
        this.trace.push({kind:'print', text:line});
        return;
      }
      case 'exprstmt': { this.evalAny(st.e, scope); return; }
      case 'return': throw new ReturnSignal();
      default: throw new Error('Sentencia no soportada');
    }
  }
  evalAny(e, scope){
    if(e.k==='str') return e.v;
    const r=this.evalNum(e,scope);
    return r;
  }
  evalNum(e, scope){
    switch(e.k){
      case 'num': return {v:e.v, isInt:e.isInt};
      case 'str': return e.v;
      case 'id': {
        if(e.v==='endl') return '\n';
        return this.getVar(scope,e.v);
      }
      case 'index': {
        const arr=this.getVar(scope, e.arr.v);
        const idx=Math.trunc(this.evalNum(e.idx,scope).v);
        const cell=arr[idx];
        if(cell===undefined) throw new Error('Índice fuera de rango: '+e.arr.v+'['+idx+']');
        return cell;
      }
      case 'neg': { const v=this.evalNum(e.e,scope); return {v:-v.v, isInt:v.isInt}; }
      case 'not': { const v=this.evalNum(e.e,scope); return {v:v.v?0:1, isInt:true}; }
      case 'bin': {
        const l=this.evalNum(e.l,scope), r=this.evalNum(e.r,scope);
        const bothInt = l.isInt && r.isInt;
        if(['<','>','<=','>=','=='].includes(e.op) && e.l.k==='index' && e.r.k==='index'){
          this.trace.push({kind:'compare', name1:e.l.arr.v, idx1:Math.trunc(this.evalNum(e.l.idx,scope).v), name2:e.r.arr.v, idx2:Math.trunc(this.evalNum(e.r.idx,scope).v)});
        }
        switch(e.op){
          case '+': return {v:l.v+r.v, isInt:bothInt};
          case '-': return {v:l.v-r.v, isInt:bothInt};
          case '*': return {v:l.v*r.v, isInt:bothInt};
          case '/': { let v=l.v/r.v; if(bothInt) v=Math.trunc(v); return {v, isInt:bothInt}; }
          case '%': { const v=Math.trunc(l.v) - Math.trunc(Math.abs(l.v/r.v))*Math.sign(l.v/r.v)*Math.trunc(r.v); return {v: l.v % r.v, isInt:true}; }
          case '<': return {v:(l.v<r.v)?1:0, isInt:true};
          case '>': return {v:(l.v>r.v)?1:0, isInt:true};
          case '<=': return {v:(l.v<=r.v)?1:0, isInt:true};
          case '>=': return {v:(l.v>=r.v)?1:0, isInt:true};
          case '==': return {v:(l.v===r.v)?1:0, isInt:true};
          case '!=': return {v:(l.v!==r.v)?1:0, isInt:true};
          case '&&': return {v:(l.v&&r.v)?1:0, isInt:true};
          case '||': return {v:(l.v||r.v)?1:0, isInt:true};
        }
        break;
      }
      case 'assign': {
        const r=this.evalNum(e.right,scope);
        if(e.left.k==='id'){ this.setVar(scope,e.left.v,{v:r.v,isInt:this.getVar(scope,e.left.v).isInt}); this.trace.push({kind:'var', name:e.left.v, value:r.v}); return this.getVar(scope,e.left.v); }
        if(e.left.k==='index'){
          const arr=this.getVar(scope,e.left.arr.v);
          const idx=Math.trunc(this.evalNum(e.left.idx,scope).v);
          arr[idx]={v:r.v, isInt: arr[idx]? arr[idx].isInt : r.isInt};
          this.trace.push({kind:'setCell', name:e.left.arr.v, idx, value:r.v});
          return arr[idx];
        }
        throw new Error('Asignación inválida');
      }
      case 'preinc': {
        const cur=this.evalNum(e.e,scope); const nv={v:cur.v+e.d, isInt:cur.isInt};
        this.assignTo(e.e, nv, scope); return nv;
      }
      case 'postinc': {
        const cur=this.evalNum(e.e,scope); const nv={v:cur.v+e.d, isInt:cur.isInt};
        this.assignTo(e.e, nv, scope); return cur;
      }
    }
    throw new Error('Expresión no soportada: '+e.k);
  }
  assignTo(e, val, scope){
    if(e.k==='id'){ this.setVar(scope,e.v,val); return; }
    if(e.k==='index'){ const arr=this.getVar(scope,e.arr.v); const idx=Math.trunc(this.evalNum(e.idx,scope).v); arr[idx]=val; return; }
    throw new Error('No se puede asignar');
  }
}
function formatNum(x){
  if(x===undefined||x===null) return '';
  if(typeof x==='string') return x;
  const v=x.v;
  if(x.isInt) return String(Math.trunc(v));
  if(Number.isInteger(v)) return String(v);
  let s = v.toPrecision(6);
  if(s.includes('.')) s=s.replace(/0+$/,'').replace(/\.$/,'');
  return s;
}

