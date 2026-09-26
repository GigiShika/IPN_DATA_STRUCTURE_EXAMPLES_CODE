function unwrap(x){
  if(x==null) return x;
  if(Array.isArray(x)) return x.map(unwrap);
  if(typeof x==='object' && 'v' in x) return x.v;
  return x;
}
function unwrapMap(o){ const r={}; for(const k in o) r[k]=unwrap(o[k]); return r; }
function seq(arr){ return {type:'seq', expected:arr}; }
function text(s){ return {type:'text', expected:s}; }
function fail(msg){ return {type:'fail', message:msg}; }
function extractNums(s){ const m=(s||'').match(/-?\d+(?:\.\d+)?/g); return m? m.map(Number): []; }
function lastNumberPerLine(s){ return (s||'').split('\n').map(l=>{ const m=l.match(/-?\d+(?:\.\d+)?/g); return m? Number(m[m.length-1]) : null; }).filter(x=>x!==null); }
const CUSTOM_EXTRACTORS = { 5: lastNumberPerLine };
function approxEq(a,b){ const tol = (Number.isInteger(a)&&Number.isInteger(b))? 0.001 : 0.05; return Math.abs(a-b)<=tol; }
function compareSeq(actual, expected){
  if(actual.length!==expected.length) return {ok:false, reason:'count', actual, expected};
  for(let i=0;i<expected.length;i++){ if(!approxEq(actual[i],expected[i])) return {ok:false, reason:'value', idx:i, exp:expected[i], got:actual[i]}; }
  return {ok:true};
}

const CHECKERS = {
1:(ctx)=>{ const {env}=ctx; if(!('a' in env)||!('b' in env)) return fail('Declara las variables a y b.'); return seq([env.a, env.b]); },
2:(ctx)=>{ const {env}=ctx; for(const v of ['a','b','c']) if(!(v in env)) return fail('Declara las variables a, b y c.'); return seq([env.a+env.b+env.c]); },
3:(ctx)=>{ const {init,env}=ctx; if(!('a' in init)||!('b' in init)) return fail('Declara e inicializa a y b.'); if(env.a!==init.b||env.b!==init.a) return fail('Los valores no quedaron intercambiados correctamente.'); return seq([env.a, env.b]); },
4:(ctx)=>{ const {env}=ctx; for(const v of ['a','b','c','d','e']) if(!(v in env)) return fail('Declara las 5 variables a, b, c, d, e.'); return seq([(env.a+env.b+env.c+env.d+env.e)/5]); },
5:(ctx)=>{ const {env}=ctx; if(!('numero' in env)) return fail('Declara la variable numero.'); const exp=[]; for(let i=1;i<=10;i++) exp.push(env.numero*i); return seq(exp); },
6:(ctx)=>{ const {env}=ctx; if(!('numero' in env)) return fail('Declara la variable numero.'); const exp=[]; for(let i=1;i<=env.numero;i++) exp.push(i); return seq(exp); },
7:()=> seq(Array.from({length:10},(_,i)=>10-i)),
8:()=> seq(Array.from({length:10},(_,i)=>(i+1)*2)),
9:()=> seq(Array.from({length:10},(_,i)=>i*2+1)),
10:()=> seq([5050]),
11:(ctx)=>{ const A=ctx.init.A; if(!A) return fail('Declara e inicializa A[5] con valores.'); return seq(A); },
12:()=> seq(Array.from({length:10},(_,i)=>i+1)),
13:()=> seq(Array.from({length:10},(_,i)=>(i+1)*2)),
14:()=> seq(Array.from({length:10},(_,i)=>i*2+1)),
15:(ctx)=>{ const A=ctx.init.A; if(!A) return fail('Declara e inicializa A[5] con valores.'); return seq(A); },
16:()=> seq([55]),
17:()=> seq(Array.from({length:10},(_,i)=>(i+1)*2)),
18:()=> seq(Array.from({length:10},(_,i)=>(i+1)*(i+1))),
19:(ctx)=>{ const A=ctx.init.A,B=ctx.init.B; if(!A||!B) return fail('Declara e inicializa A[5] y B[5] con valores.'); if(A.length!==B.length) return fail('A y B deben tener el mismo tamaño.'); return seq(A.map((v,i)=>v+B[i])); },
20:(ctx)=>{ const A=ctx.init.A; if(!A) return fail('Declara e inicializa A[10] con valores.'); const sum=A.reduce((a,b)=>a+b,0); return seq([sum, sum/A.length, A.filter(x=>x%2===0).length]); },
21:(ctx)=>{ const A=ctx.init.A; if(!A) return fail('Declara e inicializa A[10] con valores.'); return seq([Math.max(...A), Math.min(...A)]); },
22:(ctx)=>{ const A=ctx.init.A; if(!A) return fail('Declara e inicializa A[15] con valores.'); return seq([A.filter(x=>x>0).length, A.filter(x=>x<0).length]); },
23:(ctx)=>{ const A=ctx.init.A; if(!A) return fail('Declara e inicializa A[10] con valores.'); return seq([...A].reverse()); },
24:(ctx)=>{ const A=ctx.init.A; if(!A) return fail('Declara e inicializa A[20] con valores.'); return seq([...A.filter(x=>x%2===0), ...A.filter(x=>x%2!==0)]); },
25:(ctx)=>{ const A=ctx.init.A; if(!A) return fail('Declara e inicializa A[5] con valores.'); const n=A.length; return seq([A[n-1], ...A.slice(0,n-1)]); },
26:(ctx)=>{ const A=ctx.init.A; if(!A) return fail('Declara e inicializa A[5] con valores.'); return seq([...A.slice(1), A[0]]); },
27:(ctx)=>{ const A=ctx.init.A,B=ctx.init.B; if(!A||!B) return fail('Declara e inicializa A y B con valores.'); const eq=A.length===B.length && A.every((v,i)=>v===B[i]); return text(eq?'Vectores iguales':'Vectores diferentes'); },
28:(ctx)=>{ const A=ctx.init.A; if(!A) return fail('Declara e inicializa A[5] con valores.'); return seq(A.filter((_,i)=>i!==2)); },
29:(ctx)=>{ const A=ctx.init.A; if(!A) return fail('Declara e inicializa A[10] con valores.'); return seq([...A].sort((a,b)=>a-b)); },
30:(ctx)=>{ const A=ctx.init.A; if(!A) return fail('Declara e inicializa A[20] con valores.'); const sum=A.reduce((a,b)=>a+b,0); return seq([sum, sum/A.length, Math.max(...A), Math.min(...A), A.filter(x=>x%2===0).length, A.filter(x=>x%2!==0).length, A.filter(x=>x>0).length, A.filter(x=>x<0).length]); },
};
const REQUIRES_FOR = new Set([5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30]);

class ExecutionService{
  run(ex, userCode){
    let res;
    try{ res = new Interp().run(userCode); }
    catch(e){ return new RunResult({ok:false, error:e.message, trace:[]}); }
    if(REQUIRES_FOR.has(ex.id) && res.forCount<1){
      return new RunResult({ok:true, match:false, output:res.output, trace:res.trace, message:'Este ejercicio se resuelve con un ciclo for. Agrégalo a tu solución.'});
    }
    const ctx = {init:unwrapMap(res.init), env:unwrapMap(res.vars)};
    const checker = CHECKERS[ex.id];
    const verdict = checker(ctx);
    if(verdict.type==='fail'){
      return new RunResult({ok:true, match:false, output:res.output, trace:res.trace, message:verdict.message});
    }
    if(verdict.type==='text'){
      const got=(res.output||'').trim();
      const match = got===verdict.expected;
      return new RunResult({ok:true, match, output:res.output, trace:res.trace,
        message: match? null : ('Se esperaba imprimir: "'+verdict.expected+'" y obtuviste "'+got+'".') });
    }
    const extractor = CUSTOM_EXTRACTORS[ex.id] || extractNums;
    const actual = extractor(res.output);
    const cmp = compareSeq(actual, verdict.expected);
    if(cmp.ok) return new RunResult({ok:true, match:true, output:res.output, trace:res.trace});
    let message;
    if(cmp.reason==='count') message='Tu programa imprimió '+cmp.actual.length+' número(s) y se esperaban '+cmp.expected.length+'.';
    else message='En la posición '+(cmp.idx+1)+' de tus números impresos se esperaba '+cmp.exp+' y obtuviste '+cmp.got+'.';
    return new RunResult({ok:true, match:false, output:res.output, trace:res.trace, message});
  }
}
