import json,sys,os
for f in sys.argv[1:]:
    p='/home/sawyer/.bb/pi-bridge-sessions/%s.jsonl'%f
    print('== %s (%d bytes)'%(p, os.path.getsize(p)))
    for line in open(p):
        e=json.loads(line)
        t=e.get('type'); m=e.get('message',{})
        if t=='session': print('  session id=%s parentSession=%s'%(e.get('id'),e.get('parentSession')))
        elif t=='message':
            c=m.get('content')
            if isinstance(c,list): c=''.join(x.get('text','') for x in c if isinstance(x,dict))
            print('  %s id=%s role=%s parent=%s text=%r'%(t,e.get('id'),m.get('role'),e.get('parentId'),str(c)[:40]))
        else: print('  %s id=%s parent=%s'%(t,e.get('id'),e.get('parentId')))
