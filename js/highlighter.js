/* Resaltador de sintaxis C++ minimalista y autocontenido (sin dependencias externas). */
function highlightCpp(code){
  const KEYWORDS=new Set(['if','else','for','while','return','using','namespace','include','main']);
  const TYPES=new Set(['int','float','double','char','bool','void','long','short','string']);
  const BUILTINS=new Set(['cout','cin','endl','std']);
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const re=/(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*")|(#\s*\w+[^\n]*)|(\b\d+\.?\d*\b)|([A-Za-z_]\w*)|(<<|>>|<=|>=|==|!=|&&|\|\||[{}()\[\];,.<>+\-*/%=!&|:])|(\s+)|(.)/g;
  let out=''; let m;
  while((m=re.exec(code))){
    const [,cmt1,cmt2,str,pre,num,word,punct,ws,other]=m;
    if(cmt1||cmt2) out+='<span class="tok-comment">'+esc(cmt1||cmt2)+'</span>';
    else if(str) out+='<span class="tok-string">'+esc(str)+'</span>';
    else if(pre) out+='<span class="tok-pre">'+esc(pre)+'</span>';
    else if(num) out+='<span class="tok-num">'+esc(num)+'</span>';
    else if(word){
      const cls=KEYWORDS.has(word)?'tok-kw':TYPES.has(word)?'tok-type':BUILTINS.has(word)?'tok-builtin':'';
      out+= cls? '<span class="'+cls+'">'+esc(word)+'</span>' : esc(word);
    }
    else if(punct) out+='<span class="tok-punct">'+esc(punct)+'</span>';
    else out+=esc(ws||other||'');
  }
  return out+'\n';
}
