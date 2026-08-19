import struct,sys,re
data=open(sys.argv[1],'rb').read()
pat=sys.argv[2]
(magic, cputype, cpusubtype, filetype, ncmds, sizeofcmds, flags, _) = struct.unpack_from('<IiiIIIII', data, 0)
off=32
segs=[]
syms=[]
for _ in range(ncmds):
    cmd,cmdsize=struct.unpack_from('<II',data,off)
    if cmd==0x19: # LC_SEGMENT_64
        segname=data[off+8:off+24].rstrip(b'\0').decode()
        vmaddr,vmsize,fileoff,filesize=struct.unpack_from('<QQQQ',data,off+24)
        nsects,=struct.unpack_from('<I',data,off+64)
        secs=[]
        so=off+72
        for i in range(nsects):
            sname=data[so:so+16].rstrip(b'\0').decode(); sg=data[so+16:so+32].rstrip(b'\0').decode()
            addr,size=struct.unpack_from('<QQ',data,so+32)
            secs.append((sname,addr,size)); so+=80
        segs.append((segname,vmaddr,vmsize,fileoff,secs))
    if cmd==0x2:
        symoff,nsyms,stroff,strsize=struct.unpack_from('<IIII',data,off+8)
        for i in range(nsyms):
            n_strx,n_type,n_sect,n_desc,n_value=struct.unpack_from('<IBBHQ',data,symoff+i*16)
            end=data.index(b'\0',stroff+n_strx); name=data[stroff+n_strx:end].decode(errors='replace')
            syms.append((n_value,name,n_type,n_desc,n_sect))
            if re.search(pat,name):
                print(f"type={n_type:#x} sect={n_sect} desc={n_desc:#x} value={n_value:#x} {name[:70]}...")
    if cmd==0x80000022:
        (rebase_off, rebase_size, bind_off, bind_size, weak_bind_off, weak_bind_size,lazy_bind_off, lazy_bind_size, export_off, export_size) = struct.unpack_from('<10I', data, off + 8)
        print("weak_bind ops:")
        p=weak_bind_off;end=p+weak_bind_size
        def uleb(p):
            r=0;s=0
            while True:
                b=data[p];p+=1;r|=(b&0x7f)<<s;s+=7
                if not b&0x80: return r,p
        seg=None;segoff=0
        while p<end:
            b=data[p];op=b&0xf0;imm=b&0xf;p+=1
            if op==0x00: print(" DONE")
            elif op==0x40:
                e=data.index(b'\0',p);print(" SYM",data[p:e].decode()[:50],"flags",hex(imm));p=e+1
            elif op==0x50: print(" TYPE",imm)
            elif op==0x60: v,p=uleb(p);print(" ADDEND",v)
            elif op==0x70: v,p=uleb(p);seg=imm;segoff=v;print(" SEG",imm,"off",hex(v),"-> vmaddr",hex(segs[imm][1]+v), "in", [s for s in segs[imm][4] if s[1]<=segs[imm][1]+v<s[1]+s[2]])
            elif op==0x80: v,p=uleb(p);segoff+=v;print(" ADD_ADDR",hex(v))
            elif op==0x90: print(" DO_BIND at",hex(segs[seg][1]+segoff));segoff+=8
            elif op==0xA0: v,p=uleb(p);print(" DO_BIND_ADD_ADDR_ULEB at",hex(segs[seg][1]+segoff));segoff+=8+v
            elif op==0xB0: print(" DO_BIND_ADD_ADDR_IMM_SCALED at",hex(segs[seg][1]+segoff));segoff+=8+imm*8
            elif op==0xC0: c,p=uleb(p);sk,p=uleb(p);print(" DO_BIND_ULEB_TIMES_SKIPPING",c,sk)
            else: print(" op",hex(op))
    off+=cmdsize
for s in segs: print(s[0],hex(s[1]),[ (x[0],hex(x[1]),hex(x[2])) for x in s[4]])
# dump the GOT contents (file bytes) for __got section
for s in segs:
    for x in s[4]:
        if x[0]=='__got':
            fo = s[3] + (x[1]-s[1])
            n = x[2]//8
            print("__got entries:")
            for i in range(n):
                v,=struct.unpack_from('<Q',data,fo+i*8)
                # find symbol at value v
                names=[nm for (val,nm,t,d,sc) in syms if val==v and (t&0xe)==0xe]
                print(f"  {hex(x[1]+i*8)}: {hex(v)} {names[:2]}")
