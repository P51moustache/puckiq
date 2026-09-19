from pathlib import Path
p=Path(__file__).parent/'make-penpot.py';s=p.read_text()
s=s.replace("fontId='sourcesanspro',fontFamily='sourcesanspro',fontVariantId='bold' if bold else 'regular'", "fontId='gfont-teko' if size>=26 else 'gfont-dm-sans',fontFamily='Teko' if size>=26 else 'DM Sans',fontVariantId='700' if bold else 'regular'")
s=s.replace('Archive import and prototype validation pending. Font fallback in this archive: Source Sans Pro; product typography remains Teko + DM Sans.','Penpot import verified; prototype traversal and native-app validation are separate. Product typography: Teko + DM Sans. The two home-team variants demonstrate identity persistence; statistics and inputs are preset examples.')
s=s.replace('53 proposed states; 11 usability scripts.','53 proposed state definitions, each in two home-team variants; 11 usability scripts.')
s=s.replace('PuckIQ · Arena Club UX Audit & Prototype','PuckIQ · UX Map & Clickable Prototype')
a=s.index("p=page('05 Clickable Prototype')");b=s.index('#06',a)
s=s[:a]+'''p=page('05 Clickable Prototype')
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
''' + s[b:]
# Register native raster media used as design evidence and poster art.
idx=s.index('# 00')
s=s[:idx]+'''media={}
def image_shape(p,f,name,filename,x,y,w,h):
 global count
 if filename not in media:
  import struct
  data=(B/'assets'/filename).read_bytes(); iw,ih=struct.unpack('>II',data[16:24]);mid=uid('media-'+filename);oid=uid('object-'+filename)
  media[filename]=dict(id=mid,oid=oid,data=data,width=iw,height=ih)
 count+=1;m=media[filename]
 r=base(uid(str(count)),name,'image',f['x']+x,f['y']+y,w,h,f['id'],f['id'])
 r['metadata']=dict(id=m['id'],width=m['width'],height=m['height'],mtype='image/png');add(p,r)
''' + s[idx:]
# Add current visual evidence to inventory, labelled historical.
idx=s.index('# Ledger one card')
s=s[:idx]+'''for ri,(filename,name) in enumerate([('reference-home.png','Home / offseason'),('reference-following.png','Following'),('reference-players.png','Players'),('reference-league.png','League')]):
 f=frame(p,'Reference '+name,ri*800,-1700,760,1580);y=header(p,f,'Historical visual evidence',name,'Repository capture from September 2026; not a fresh runtime verification. Editable audit notes surround this raster reference.')
 import struct
 iw,ih=struct.unpack('>II',(B/'assets'/filename).read_bytes()[16:24]);image_shape(p,f,name,filename,170,y,420,420*ih/iw)
''' + s[idx:]
# Fix all board extents and lay out variable height cards in separate columns.
idx=s.index('# Serialize')
s=s[:idx]+'''# Geometric QA: fit all content and prevent board overlap within each column.
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
''' + s[idx:]
idx=s.index("out=B/'PuckIQ-UX-Audit.penpot'")
s=s[:idx]+'''for filename,m in media.items():
 entries[f'files/{FID}/media/{m["id"]}.json']=dict(id=m['id'],name=filename,width=m['width'],height=m['height'],mtype='image/png',mediaId=m['oid'],isLocal=True)
 entries[f'objects/{m["oid"]}.json']=dict(id=m['oid'],size=len(m['data']),contentType='image/png',bucket='file-media-object')
''' + s[idx:]
s=s.replace("for path,v in entries.items():z.writestr(path,json.dumps(v,ensure_ascii=False))", "for path,v in entries.items():z.writestr(path,json.dumps(v,ensure_ascii=False))\n for m in media.values():z.writestr(f'objects/{m[\"oid\"]}.png',m['data'])")
p.write_text(s)
