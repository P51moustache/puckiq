import json,uuid,zipfile,datetime,textwrap,pathlib
B=pathlib.Path(__file__).parent
D=json.loads((B/'audit.json').read_text());
for screen in D['proposed']:
 if screen['id']=='P27':screen['rows']=[['Account','Simulated account context'],['Subscription','Status shown in each scenario']];screen['actions'][0]['label']='Sign in / account demo'
 if screen['id']=='P31':screen['actions'][0]['label']='Continue with example monthly plan'
 if screen['id']=='P28':screen['actions'][0]['label']='Continue with Apple (iOS)'
 if screen['id']=='P40':screen['body']='Future delivery flow only; backend support is blocked. If supported alerts are later denied permission, the app must remain usable.'
 Z='00000000-0000-0000-0000-000000000000'
def uid(s):return str(uuid.uuid5(uuid.NAMESPACE_URL,'puckiq-audit/'+s))
FID=uid('file'); entries={}; pages=[]; shapes={}; count=0
INK='#17251F'; PAPER='#F4F0E6'; GOLD='#E9B841'; MUTED='#526159'; GREEN='#28674D'
def fill(c):return [{'fillColor':c,'fillOpacity':1}]
def base(id,name,t,x,y,w,h,parent=Z,frame=Z,c=None):
 r=dict(id=id,name=name,type=t,x=x,y=y,width=w,height=h,parentId=parent,frameId=frame,selrect=dict(x=x,y=y,width=w,height=h,x1=x,y1=y,x2=x+w,y2=y+h),points=[dict(x=x,y=y),dict(x=x+w,y=y),dict(x=x+w,y=y+h),dict(x=x,y=y+h)],transform=dict(a=1,b=0,c=0,d=1,e=0,f=0),transformInverse=dict(a=1,b=0,c=0,d=1,e=0,f=0),rotation=0,opacity=1,blendMode='normal',fills=fill(c) if c else [],strokes=[])
 if t=='frame':r.update(shapes=[],showContent=False)
 return r
def page(name):
 p=dict(id=uid(name),name=name,index=len(pages),background='#C7CFC9',flows={});pages.append(p);shapes[p['id']]={Z:base(Z,'Root Frame','frame',0,0,1,1)};return p
def add(p,s):
 shapes[p['id']][s['id']]=s
 if s['id']!=Z:shapes[p['id']][s['parentId']]['shapes'].append(s['id'])
 return s
def frame(p,name,x,y,w=760,h=980,id=None):return add(p,base(id or uid(p['name']+name),name,'frame',x,y,w,h,c=PAPER))
def rect(p,f,name,x,y,w,h,c=INK):
 global count;count+=1
 return add(p,base(uid(str(count)),name,'rect',f['x']+x,f['y']+y,w,h,f['id'],f['id'],c))
def text(p,f,s,x,y,w,size=18,c=INK,bold=False):
 global count;count+=1
 # Deliberate line wrapping makes the archive independent of asynchronous font measurement.
 lines=[]
 for line in str(s).split('\n'):lines.extend(textwrap.wrap(line,width=max(12,int(w/(size*.53))),break_long_words=True) or [''])
 lh=size*1.35;h=len(lines)*lh+6
 r=base(uid(str(count)),str(s)[:90],'text',f['x']+x,f['y']+y,w,h,f['id'],f['id'])
 attrs=dict(fontId='gfont-teko' if size>=26 else 'gfont-dm-sans',fontFamily='Teko' if size>=26 else 'DM Sans',fontVariantId='700' if bold else 'regular',fontSize=str(size),fontWeight='700' if bold else '400',fontStyle='normal',lineHeight='1.35',letterSpacing='0',textTransform='none',textDecoration='none',textAlign='left',fills=fill(c))
 r['content']=dict(type='root',verticalAlign='top',children=[dict(type='paragraph-set',children=[dict(type='paragraph',**attrs,children=[dict(text=l,**attrs)]) for l in lines])]);r['growType']='fixed'
 # Let Penpot calculate glyph positions from native text content.
 add(p,r);return h

def header(p,f,k,title,sub=''):
 rect(p,f,'Top rule',0,0,f['width'],10,GOLD)
 text(p,f,k.upper(),32,30,f['width']-64,13,MUTED,True)
 y=64+text(p,f,title,32,62,f['width']-64,34,INK,True)
 if sub:y+=text(p,f,sub,32,y+4,f['width']-64,17,MUTED)+20
 return y+14

def para(p,f,label,value,y,size=16):
 y+=text(p,f,label.upper(),32,y,f['width']-64,12,MUTED,True)+5
 return y+text(p,f,value,32,y,f['width']-64,size)+20

def link(shape,dest):shape['interactions']=[dict(eventType='click',actionType='prev-screen') if dest=='BACK' else dict(eventType='click',actionType='navigate',destination=dest,preserveScroll=False)]

def button(p,f,label,y,dest,primary=False):
 h=max(48,22*len(textwrap.wrap(label,34))+22)
 r=rect(p,f,label,24,y,f['width']-48,h,INK if primary else '#E4E5DA');r.update(r1=8,r2=8,r3=8,r4=8)
 tcount=count;text(p,f,label,38,y+12,f['width']-76,16,PAPER if primary else INK,True)
 link(r,dest);link(shapes[p['id']][uid(str(tcount+1))],dest)
 return y+h+10
media={}
def image_shape(p,f,name,filename,x,y,w,h):
 global count
 if filename not in media:
  import struct
  data=(B/'assets'/filename).read_bytes(); iw,ih=struct.unpack('>II',data[16:24]);mid=uid('media-'+filename);oid=uid('object-'+filename)
  media[filename]=dict(id=mid,oid=oid,data=data,width=iw,height=ih)
 count+=1;m=media[filename]
 r=base(uid(str(count)),name,'image',f['x']+x,f['y']+y,w,h,f['id'],f['id'])
 r['metadata']=dict(id=m['id'],width=m['width'],height=m['height'],mtype='image/png');add(p,r)
# 00
p=page('00 Read Me & Legend');f=frame(p,'Start here',0,0,920,1250)
y=header(p,f,'PuckIQ / Audit 12 September 2026','Before puck drop. Every path.','Arena Club • Source inspection and proposed mobile UX')
for label,value in [('Read this first','Current-state evidence is separate from proposed behavior. Proposed purchases, sign-in, alerts and saved data are simulated; no production actions are connected.'),('Evidence',f"Commit {D['evidence']['commit']}\nBranch {D['evidence']['branch']}\nDirty working tree inspected read-only. SHA-256 manifest and full ledger accompany this file."),('Coverage','9 routes + 2 layouts; 28 grouped surfaces; 19 shared state patterns. 281 extracted JSX interaction sites (158 route-reachable, 123 legacy/infrastructure), not 281 unique visible controls. 20 findings; 53 proposed state definitions, each in two home-team variants; 11 usability scripts.'),('Legend','S = current surface, C = extracted source control template, E = shared edge-state pattern, F = finding, P = proposed prototype state, J = usability task. Code inspected ≠ runtime verified. Shared patterns inherit the named surfaces.'),('How to review','Read inventory → follow current flow → inspect states and findings → open page 05 and launch a named flow. Failure states have their own starting flows, separate from product buttons.'),('Limits','One read-only iOS paywall screenshot observed. Zero app controls runtime-tested. Android, native sheets, gestures, accessibility and participant testing remain unverified. Penpot import verified; prototype traversal and native-app validation are separate. Product typography: Teko + DM Sans. The two home-team variants demonstrate identity persistence; statistics and inputs are preset examples.'),('Design law','Arena Club: team-driven palettes, paper surfaces, tactile controls, stable home identity, independent data semantics. Current design/vision.md supersedes the older Stat Sheet wording in AGENTS.md.')]:y=para(p,f,label,value,y)
# 01 current surfaces and exhaustive source ledger
p=page('01 Screen & Control Inventory')
for i,s in enumerate(D['screens']):
 f=frame(p,s['id']+' '+s['name'],(i%4)*800,(i//4)*1200,760,1160);y=header(p,f,s['id']+' / current',s['name'])
 for label,key in [('Entry / prerequisites','entry'),('Control templates','controls'),('Actual behavior','behavior'),('Back / exit','exit'),('Source','source'),('Evidence status','status')]:y=para(p,f,label,s.get(key,''),y,15)
for ri,(filename,name) in enumerate([('reference-home.png','Home / offseason'),('reference-following.png','Following'),('reference-players.png','Players'),('reference-league.png','League')]):
 f=frame(p,'Reference '+name,ri*800,-1700,760,1580);y=header(p,f,'Historical visual evidence',name,'Repository capture from September 2026; not a fresh runtime verification. Editable audit notes surround this raster reference.')
 import struct
 iw,ih=struct.unpack('>II',(B/'assets'/filename).read_bytes()[16:24]);image_shape(p,f,name,filename,170,y,420,420*ih/iw)
# Ledger one card per source site; full raw callbacks included, large enough to read at 100%.
for i,c in enumerate(D['controls']):
 row=i//5;f=frame(p,c['id'],3400+(i%5)*860,row*1560,820,1520);y=header(p,f,'Extracted site / '+c['classification'],c['id'],c['file']+':'+str(c['line']))
 vals=[('Surface / reachability',', '.join(c['screens'])+' • '+c['reachability']),('Element / label',c['tag']+' • '+str(c.get('label',''))),('Event bindings',json.dumps(c['events'],ensure_ascii=False)),('Resolved outcome',str(c.get('mappedOutcome',c.get('actualOutcome','')))),('Disabled / value',str(c.get('disabled',''))+' / '+str(c.get('value',''))),('Shared state inheritance',', '.join(c['patterns'])),('Exit / recovery inherited',c.get('sharedExit','')),('Coverage status / exclusion',c['status']+' '+c['exclusion'])]
 for label,value in vals:y=para(p,f,label,value or 'Not explicit in extracted JSX; manual/runtime validation required.',y,14)
 if y>1490:f['height']=y+30;f['selrect']['height']=y+30
# 02 map cards with explicit linked destinations
p=page('02 Current-State Flow Map'); m={s['id']:uid('map-'+s['id']) for s in D['screens']}
for i,s in enumerate(D['screens']):
 f=frame(p,s['id']+' '+s['name'],(i%4)*560,(i//4)*1160,520,1100,m[s['id']]);y=header(p,f,'Current / '+s['id'],s['name'],'Source-derived navigation. Use these linked boards to trace the implemented graph.')
 for e in [e for e in D['currentEdges'] if e['from']==s['id']]:
  if e['to'] in m:y=button(p,f,e['label']+' → '+e['to'],y,m[e['to']])
  else:y=para(p,f,e['label'],e['to']+' — '+s['exit'],y)
 y=para(p,f,'Global navigation','Home → S02; Following → S08; Players → S10; League → S13. Shared header Settings → S22 and home picker → S09 where rendered.',y,14)
 for lab,k in [('Home','S02'),('Following','S08'),('Players','S10'),('League','S13')]:y=button(p,f,lab,y,m[k])
flowid=uid('current-flow');p['flows'][flowid]=dict(id=flowid,name='Current navigation evidence',startingFrame=m['S01'])
# 03
p=page('03 States & Edge Cases')
for i,e in enumerate(D['patterns']):
 f=frame(p,e['id']+' '+e['name'],(i%4)*800,(i//4)*900,760,850);y=header(p,f,e['id']+' / inherited state',e['name']);y=para(p,f,'Applies to',', '.join(e['inherits']),y);y=para(p,f,'Behavior / gaps / recovery',e['detail'],y);para(p,f,'Verification','Source-derived shared-state coverage. Native interactions and visual permutations require runtime validation on iOS and Android.',y)
#04 spec per proposed state
p=page('04 Proposed UX')
for i,s in enumerate(D['proposed']):
 f=frame(p,s['id']+' spec',(i%5)*720,(i//5)*1000,680,940);y=header(p,f,s['id']+' / proposed',s['title'],s['body']);y=para(p,f,'Replaces or extends',', '.join(s.get('source',[])),y)
 y=para(p,f,'Intended controls','\n'.join(a['label']+' → '+a['to']+((' • '+str(a['effect'])) if a.get('effect') else '') for a in s['actions']),y)
 if s.get('rows'):y=para(p,f,'Displayed information','\n'.join(a+' — '+b for a,b in s['rows']),y)
 para(p,f,'Implementation boundary','Preset design state. No live data or real auth/store/storage. Maintain local data truth and originating navigation. Validate text scaling, screen-reader order and native Back before release.',y)
#05 interactive prototype
p=page('05 Clickable Prototype')
variants=['BOS','EDM'];pms={v:{s['id']:uid('prototype-'+v+'-'+s['id']) for s in D['proposed']} for v in variants}
for vi,v in enumerate(variants):
 pm=pms[v];accent=GOLD if v=='BOS' else '#EA682E';team='Boston' if v=='BOS' else 'Edmonton'
 for i,s in enumerate(D['proposed']):
  f=frame(p,s['id']+' · '+team+' · '+s['title'],(i%9)*480+vi*4500,(i//9)*1600,414,1160,pm[s['id']]);rect(p,f,'Home-team color',0,0,414,8,accent)
  text(p,f,'PUCKIQ  /  '+team.upper(),24,25,280,15,INK,True);text(p,f,'EXAMPLE',310,28,90,11,MUTED)
  y=66
  if s.get('back'):y=button(p,f,'‹ Back',y,pm.get(s['back'],s['back']))
  y+=text(p,f,s['title'],24,y+6,366,34,INK,True)+20
  y+=text(p,f,s['body'].replace('{home}',team),24,y,366,17,MUTED)+24
  if s.get('game'):
   rect(p,f,'Game poster',24,y,366,220,INK);text(p,f,'BOS / MTL',42,y+16,310,40,PAPER,True)
   text(p,f,'58% / 42%',42,y+72,230,36,accent,True)
   text(p,f,'Illustrative forecast',42,y+129,310,13,PAPER)
   text(p,f,'Goalies unconfirmed',42,y+153,310,13,PAPER)
   image_shape(p,f,'Original fictional skater','skater.png',253,y+54,115,166)
   y+=240
  if s.get('search'):
   rect(p,f,'Example search field',24,y,366,56,'#E4E5DA');text(p,f,'Search: Sample skater',40,y+16,332,16);y+=78
  if s.get('editor'):
   y+=text(p,f,'EXAMPLE DRAFT · PRESET WEIGHTS',24,y,366,12,MUTED,True)+12
   for label,val in [('Standings','30'),('Home ice','10'),('Recent form','20')]:
    y+=text(p,f,label+'   '+val,24,y,366,16)+8;rect(p,f,label+' weight track',24,y,366,6,'#CFD3C7');rect(p,f,label+' weight value',24,y,150,6,accent);y+=25
   y+=text(p,f,'Weight editing is specified on page 04. This walkthrough uses a preset draft.',24,y,366,13,MUTED)+16
  for key,val in s.get('rows',[]):
   y+=text(p,f,key,24,y,366,12,MUTED,True)+3;y+=text(p,f,val.replace('{home}',team),24,y,366,17)+14
  actions=[a for a in s['actions'] if not (s['id']=='P18' and a['label']=='Choose Edmonton')]
  for j,action in enumerate(actions):
   targetHome=action.get('effect','').split(':')[-1] if action.get('effect','').startswith('home:') else v
   dest=pms[targetHome].get(action['to'],action['to'])
   y=button(p,f,action['label'],y,dest,j==0)
  if s.get('nav'):
   y=max(y+20,760);rect(p,f,'Footer line',24,y,366,1,'#C5CABF');y+=14
   for j,(lab,to) in enumerate([('Home','P03'),('Following','P13'),('Players','P09'),('League','P16')]):
    r=rect(p,f,lab+' tab',16+j*99,y,94,48,'#E4E5DA');link(r,pm[to]);n=count;text(p,f,lab,23+j*99,y+15,86,13,INK,True);link(shapes[p['id']][uid(str(n+1))],pm[to])
   y+=60;y=button(p,f,'Settings · account & subscription',y,pm['P27'])
  text(p,f,s['id']+' · Proposed / simulated',24,y+10,366,11,MUTED)
for j in D['journeys']:
 id=uid('flow-'+j['id']);p['flows'][id]=dict(id=id,name=j['id']+' '+j['name'],startingFrame=pms['BOS'][j['path'][0]])
for state in ['P34','P38','P41','P43','P44','P47','P51','P52','P53']:
 id=uid('flow-'+state);p['flows'][id]=dict(id=id,name='Recovery '+state,startingFrame=pms['BOS'][state])
#06
p=page('06 Findings & Implementation Handoff')
for i,finding in enumerate(D['findings']):
 f=frame(p,finding['id']+' '+finding['title'],(i%4)*840,(i//4)*1180,800,1120);y=header(p,f,finding['id']+' / '+finding['priority'],finding['title'])
 for label,key in [('Observed in source','evidence'),('Source reference','source'),('Proposed change','recommendation'),('Acceptance criteria','acceptance')]:y=para(p,f,label,finding[key],y)
for i,j in enumerate(D['journeys']):
 f=frame(p,j['id']+' usability task',3500+(i%3)*780,(i//3)*920,740,860);y=header(p,f,j['id']+' / test script',j['name']);y=para(p,f,'Prompt to participant',j['task'],y);y=para(p,f,'Successful outcome',j['success'],y);y=para(p,f,'Proposed route',' → '.join(j['path']),y);para(p,f,'Moderator guidance','Start at the matching page-05 flow. Do not explain controls. Record first click, completion, backtracks and perceived data truth. Use recovery flows to test failures. No participant testing performed.',y)
f=frame(p,'Coverage matrix & implementation decisions',6000,0,1000,1800)
y=header(p,f,'Audit handoff / 12 September 2026','Coverage, evidence & next steps','Design walkthrough verified separately from the real app.')
for label,value in [
 ('Mapped current surfaces','28 / 28 grouped surfaces on page 02. 19 shared state patterns name all inheriting surfaces. 9 route files plus 2 layouts inspected.'),
 ('Extracted control coverage','281 JSX sites recorded with stable IDs, source and callback/state outcome or explicit exclusion. 158 route-reachable sites; 123 legacy/infrastructure sites. Counts include callback bindings and repeated templates, not unique rendered buttons. Full per-control/per-state semantics and native-dialog buttons remain unvalidated.'),
 ('Proposed experience','53 state definitions × Boston/Edmonton variants = 106 clickable boards. 11 task-flow starting points plus 9 recovery starting points. Preset search, model draft and store prices; no live inputs, purchases, notifications or credentials.'),
 ('Prototype checks passed','First launch and both home-team choices; forecast/source/save/result; player search/watchlist/return; team identity switching; comparison and back stack; AI provenance and model draft cancel/save; simulated sign-in and purchase cancellation; offseason restore entry; restore failure/retry; failed save/retry; destructive confirmation/undo. Native Penpot links resolve; generated content stays within board bounds.'),
 ('Verification limits','Real app: one read-only iOS paywall observation, zero controls runtime-tested. No Android, VoiceOver/TalkBack, Dynamic Type, native-gesture or participant testing. 414px-wide prototype boards reviewed; narrower responsive layouts require implementation validation. State patterns are evidence/specifications, not every rendered combination.'),
 ('Implementation order','1 Search lifecycle + arbitrary-player watching. 2 Forecast provenance + saved-data integrity. 3 Return origins, drafts and async recovery. 4 Pro policy, account feedback and support destination. 5 Arena Club consistency and accessibility. Enable backend-dependent alerts only after delivery readiness is verified.'),
 ('Product decisions','Define actual Pro feature gates; decide whether My Team is discoverable or retired; decide device-wide versus account-scoped saved data; supply a Support destination; define source freshness and alert readiness policies.'),
 ('Usability sessions','Run J01–J11 with 5–8 representative fans. Record first click, task completion, backtracks, data-trust interpretation and recovery. Proposed visual polish is not evidence of usability. No participant sessions have occurred.')]:y=para(p,f,label,value,y,17)
# Geometric QA: fit all content and prevent board overlap within each column.
for pg in pages:
 objects=shapes[pg['id']];boards=[o for o in objects.values() if o['type']=='frame' and o['id']!=Z]
 columns={}
 for board in boards:
  children=[objects[c] for c in board['shapes']]
  board['height']=max(280,max((c['y']+c['height']-board['y']+36 for c in children),default=280))
  columns.setdefault(board['x'],[]).append(board)
 for x,col in columns.items():
  nextY=0
  for board in sorted(col,key=lambda o:o['y']):
   dy=nextY-board['y'];board['y']=nextY
   for c in [objects[i] for i in board['shapes']]:
    c['y']+=dy;c['selrect'].update(y=c['y'],y1=c['y'],y2=c['y']+c['height'])
    for point in c['points']:point['y']+=dy
   board['selrect'].update(y=nextY,y1=nextY,y2=nextY+board['height'],height=board['height'])
   board['points']=[dict(x=x,y=nextY),dict(x=x+board['width'],y=nextY),dict(x=x+board['width'],y=nextY+board['height']),dict(x=x,y=nextY+board['height'])]
   nextY+=board['height']+120
# Serialize
now=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z');features=['components/v2']
entries['manifest.json']=dict(version=1,type='penpot/export-files',generatedBy='puckiq-audit-generator',files=[dict(id=FID,name='PuckIQ · Arena Club — UX Review',features=features)],relations=[])
entries[f'files/{FID}.json']=dict(id=FID,name='PuckIQ · Arena Club — UX Review',revn=0,version=67,createdAt=now,modifiedAt=now,features=features,options=dict(componentsV2=True))
for p in pages:
 entries[f'files/{FID}/pages/{p["id"]}.json']=p
 for sid,s in shapes[p['id']].items():entries[f'files/{FID}/pages/{p["id"]}/{sid}.json']=s
for filename,m in media.items():
 entries[f'files/{FID}/media/{m["id"]}.json']=dict(id=m['id'],name=filename,width=m['width'],height=m['height'],mtype='image/png',mediaId=m['oid'],isLocal=True)
 entries[f'objects/{m["oid"]}.json']=dict(id=m['oid'],size=len(m['data']),contentType='image/png',bucket='file-media-object')
out=B/'PuckIQ-UX-Audit.penpot'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for path,v in entries.items():z.writestr(path,json.dumps(v,ensure_ascii=False))
 for m in media.values():z.writestr(f'objects/{m["oid"]}.png',m['data'])
report=dict(file=str(out),pages=len(pages),boards=sum(s['type']=='frame' and s['id']!=Z for v in shapes.values() for s in v.values()),shapes=sum(map(len,shapes.values())),interactions=sum(len(s.get('interactions',[])) for v in shapes.values() for s in v.values()),importValidated=False)
(B/'penpot-build.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
