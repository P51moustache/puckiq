const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const root='/Users/zach/Projects/active/learning-project';
const out=__dirname;
const ts=require(path.join(root,'node_modules/typescript'));
const files=cp.execFileSync('rg',['--files','app','components','hooks','services','utils','constants','types'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(f=>/\.(tsx?|jsx?)$/.test(f)&&!/(?:__tests__|\.test\.|\.spec\.)/.test(f)).sort();
const sources=new Map(files.map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]));
const asts=new Map([...sources].map(([f,s])=>[f,ts.createSourceFile(f,s,ts.ScriptTarget.Latest,true,f.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS)]));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const imports={},all=[];
function resolve(f,s){if(!s.startsWith('.'))return null;const base=path.posix.normalize(path.posix.join(path.posix.dirname(f),s));return [base,...['.ts','.tsx','.js','.jsx','/index.ts','/index.tsx'].map(e=>base+e)].find(p=>sources.has(p));}
for(const [file,ast] of asts){imports[file]=[];for(const n of ast.statements)if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier){const p=resolve(file,n.moduleSpecifier.text);if(p)imports[file].push(p);}}
const roots=files.filter(f=>f.startsWith('app/'));
const reachable=new Set();function visit(f){if(reachable.has(f))return;reachable.add(f);for(const dep of imports[f]||[])visit(dep);}roots.forEach(visit);
for(const [file,ast] of asts){if(!/^(app|components)\//.test(file))continue;
const source=sources.get(file),seq={};
const functions=new Map();function defs(n){if(ts.isVariableDeclaration(n)&&n.initializer&&ts.isIdentifier(n.name))functions.set(n.name.text,n.initializer.getText(ast));if(ts.isFunctionDeclaration(n)&&n.name)functions.set(n.name.text,n.getText(ast));ts.forEachChild(n,defs);}defs(ast);
function walk(n){if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
 const tag=n.tagName.getText(ast),attrs=Object.fromEntries(n.attributes.properties.filter(ts.isJsxAttribute).map(a=>[a.name.getText(ast),a.initializer?ts.isStringLiteral(a.initializer)?a.initializer.text:ts.isJsxExpression(a.initializer)?a.initializer.expression?.getText(ast)||'true':a.initializer.getText(ast):'true']));
 const events=Object.fromEntries(Object.entries(attrs).filter(([k])=>/^on[A-Z]/.test(k)));
 const interactive=/^(Pressable|TouchableOpacity|TouchableWithoutFeedback|TouchableHighlight|TextInput|Switch|Slider|Link|RefreshControl|Modal)$/.test(tag)||Object.keys(events).length>0;
 if(interactive){let p=n,owner='module';while(p){if(ts.isFunctionDeclaration(p)&&p.name){owner=p.name.text;break;}if(ts.isVariableDeclaration(p)&&ts.isIdentifier(p.name)){owner=p.name.text;break;}p=p.parent;}
 const loc=ast.getLineAndCharacterOfPosition(n.getStart(ast));const parent=ts.isJsxOpeningElement(n)?n.parent:n;const snippet=parent.getText(ast);const texts=[];function getText(t){if(ts.isJsxText(t)&&t.text.trim())texts.push(t.text.trim().replace(/\s+/g,' '));ts.forEachChild(t,getText);}getText(parent);
 const key=file+':'+owner;seq[key]=(seq[key]||0)+1;const id='C-'+file.replace(/^(app|components)\//,'').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9]+/g,'-')+'-'+owner+'-'+String(seq[key]).padStart(3,'0');
 const handlers=Object.fromEntries(Object.entries(events).map(([k,v])=>[k,functions.get(v)||v]));
 all.push({id,file,line:loc.line+1,owner,tag,label:attrs.accessibilityLabel||attrs.label||attrs.title||texts.join(' / ').slice(0,280)||attrs.placeholder||attrs.testID||'[no explicit label]',events,handlers,disabled:attrs.disabled||'',value:attrs.value||'',role:attrs.accessibilityRole||'',presentation:attrs.presentationStyle||'',props:attrs,reachability:reachable.has(file)?'route import graph — rendering conditions need inspection':'no route import path — excluded from current navigation',verification:'code-extracted; semantic review pending',intendedPurpose:'See label; intent beyond source is unverified',actualOutcome:Object.entries(events).map(([k,v])=>`${k}: ${v}`).join('; ')||'NO DIRECT EVENT HANDLER — inspect spread/parent before classifying',prerequisites:'Inherited screen prerequisites; per-control conditions in props and enclosing source require review',asyncStates:'Handler excerpt retained; loading/success/failure/cancel/retry not fully reviewed',backDismiss:events.onRequestClose||events.onDismiss||'Inherited surface exit; runtime unverified',platform:'iOS/Android runtime unverified',snippet});
 }
}ts.forEachChild(n,walk);}walk(ast);
}
const snapshot={timestamp:new Date().toISOString(),commit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),branch:cp.execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim(),gitStatus:cp.execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8'}),files:[...sources].map(([file,text])=>({file,sha256:hash(text)})),notes:'Source inspection only. No app execution, production transactions or real user-data mutations. No secrets captured. Hashes describe per-file reads, not an atomic checkout snapshot.'};
fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(snapshot,null,2));
fs.writeFileSync(path.join(out,'controls.json'),JSON.stringify(all,null,2));
fs.writeFileSync(path.join(out,'import-graph.json'),JSON.stringify({roots,imports,reachable:[...reachable]},null,2));
const counts={files:files.length,routes:roots.filter(f=>!f.endsWith('_layout.tsx')).length,interactionSites:all.length,routeGraphSites:all.filter(x=>reachable.has(x.file)).length,noRouteGraphSites:all.filter(x=>!reachable.has(x.file)).length};
fs.writeFileSync(path.join(out,'counts.json'),JSON.stringify(counts,null,2));console.log(JSON.stringify(counts));
console.log(JSON.stringify(all.reduce((m,c)=>(m[c.file]=(m[c.file]||0)+1,m),{}),null,2));
