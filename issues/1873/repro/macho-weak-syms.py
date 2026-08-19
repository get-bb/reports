#!/usr/bin/env python3
"""Minimal Mach-O inspector: prints header flags and weak-defined/undefined
symbols matching a pattern. Used to show that pty.node (node-pty 1.1.0) and
watcher.node (@parcel/watcher 2.5.6) both export the SAME weak template
instantiation Napi::details::CallbackData<...>::Wrapper, which dyld coalesces
across images on macOS."""
import struct, sys, re

MH_MAGIC_64 = 0xfeedfacf
FAT_MAGIC = 0xcafebabe
LC_SYMTAB = 0x2
MH_WEAK_DEFINES = 0x8000
MH_BINDS_TO_WEAK = 0x10000
N_EXT = 0x01
N_TYPE = 0x0e
N_UNDF = 0x0
N_SECT = 0xe
N_WEAK_REF = 0x0040
N_WEAK_DEF = 0x0080
N_STAB = 0xe0  # debug (STABS) entries, e.g. N_FUN=0x24; they alias real symbols at the same address

def parse(data, pattern):
    magic, = struct.unpack_from('<I', data, 0)
    if magic != MH_MAGIC_64:
        raise SystemExit(f"unsupported magic {magic:#x}")
    (magic, cputype, cpusubtype, filetype, ncmds, sizeofcmds, flags, _) = struct.unpack_from('<IiiIIIII', data, 0)
    print(f"  cputype={cputype:#x} filetype={filetype} flags={flags:#x}"
          f" MH_WEAK_DEFINES={bool(flags & MH_WEAK_DEFINES)} MH_BINDS_TO_WEAK={bool(flags & MH_BINDS_TO_WEAK)}")
    off = 32
    for _ in range(ncmds):
        cmd, cmdsize = struct.unpack_from('<II', data, off)
        if cmd == LC_SYMTAB:
            symoff, nsyms, stroff, strsize = struct.unpack_from('<IIII', data, off + 8)
            for i in range(nsyms):
                n_strx, n_type, n_sect, n_desc, n_value = struct.unpack_from('<IBBHQ', data, symoff + i * 16)
                end = data.index(b'\0', stroff + n_strx)
                name = data[stroff + n_strx:end].decode(errors='replace')
                if n_type & N_STAB:
                    # Skip STABS debug entries (N_FUN etc.). They repeat the function
                    # name at the same address with ext=False and would otherwise look
                    # like a second, non-weak copy of the symbol.
                    continue
                if re.search(pattern, name):
                    kind = 'UNDEF' if (n_type & N_TYPE) == N_UNDF else 'DEF'
                    print(f"  {kind:5} ext={bool(n_type & N_EXT)} weak_def={bool(n_desc & N_WEAK_DEF)} weak_ref={bool(n_desc & N_WEAK_REF)} addr={n_value:#x} {name}")
        off += cmdsize

for path in sys.argv[2:]:
    print(path)
    parse(open(path, 'rb').read(), sys.argv[1])

# --- weak-bind / chained-fixup import inspection -------------------------------
LC_DYLD_INFO_ONLY = 0x80000022
LC_DYLD_CHAINED_FIXUPS = 0x80000034
LC_DYLD_EXPORTS_TRIE = 0x80000033

def read_uleb(data, off):
    result = 0; shift = 0
    while True:
        b = data[off]; off += 1
        result |= (b & 0x7f) << shift; shift += 7
        if not (b & 0x80): break
    return result, off

def binds(data, pattern):
    magic, cputype, cpusubtype, filetype, ncmds, sizeofcmds, flags, _ = struct.unpack_from('<IiiIIIII', data, 0)
    off = 32
    for _ in range(ncmds):
        cmd, cmdsize = struct.unpack_from('<II', data, off)
        if cmd == LC_DYLD_INFO_ONLY:
            (rebase_off, rebase_size, bind_off, bind_size, weak_bind_off, weak_bind_size,
             lazy_bind_off, lazy_bind_size, export_off, export_size) = struct.unpack_from('<10I', data, off + 8)
            for label, start, size in (("bind", bind_off, bind_size), ("weak_bind", weak_bind_off, weak_bind_size), ("lazy_bind", lazy_bind_off, lazy_bind_size)):
                p = start; end = start + size
                while p < end:
                    opcode = data[p] & 0xF0; imm = data[p] & 0x0F; p += 1
                    if opcode == 0x40:  # SET_SYMBOL_TRAILING_FLAGS_IMM
                        e = data.index(b'\0', p); name = data[p:e].decode(); p = e + 1
                        if re.search(pattern, name):
                            print(f"  {label}: {name} (flags={imm:#x})")
                    elif opcode in (0x10, 0x20, 0x30, 0x00, 0x50, 0x60, 0x90, 0xA0): pass
                    elif opcode == 0x70: pass
                    elif opcode == 0x80: pass
                    elif opcode == 0xB0:
                        _, p = read_uleb(data, p); _, p = read_uleb(data, p)
                    else:
                        pass
                    if opcode in (0x30,):  # SET_DYLIB_SPECIAL_IMM
                        pass
                    if opcode in (0x20,):  # SET_DYLIB_ORDINAL_ULEB
                        _, p = read_uleb(data, p)
                    if opcode in (0x60,):  # SET_ADDEND_SLEB
                        _, p = read_uleb(data, p)
                    if opcode in (0x70, 0x80, 0x90) and opcode != 0x90:
                        pass
                    if opcode == 0x70:  # SET_SEGMENT_AND_OFFSET_ULEB
                        _, p = read_uleb(data, p)
                    if opcode == 0x80:  # ADD_ADDR_ULEB
                        _, p = read_uleb(data, p)
                    if opcode == 0xA0:  # DO_BIND_ADD_ADDR_ULEB
                        _, p = read_uleb(data, p)
        elif cmd == LC_DYLD_CHAINED_FIXUPS:
            dataoff, datasize = struct.unpack_from('<II', data, off + 8)
            (fixups_version, starts_offset, imports_offset, symbols_offset, imports_count,
             imports_format, symbols_format) = struct.unpack_from('<7I', data, dataoff)
            for i in range(imports_count):
                if imports_format == 1:  # DYLD_CHAINED_IMPORT
                    v, = struct.unpack_from('<I', data, dataoff + imports_offset + i * 4)
                    lib_ordinal = v & 0xff; weak_import = (v >> 8) & 1; name_offset = v >> 9
                elif imports_format == 2:  # DYLD_CHAINED_IMPORT_ADDEND
                    v, addend = struct.unpack_from('<Ii', data, dataoff + imports_offset + i * 8)
                    lib_ordinal = v & 0xff; weak_import = (v >> 8) & 1; name_offset = v >> 9
                else:  # DYLD_CHAINED_IMPORT_ADDEND64
                    v, addend = struct.unpack_from('<Qq', data, dataoff + imports_offset + i * 16)
                    lib_ordinal = v & 0xffff; weak_import = (v >> 16) & 1; name_offset = v >> 32
                s = dataoff + symbols_offset + name_offset
                e = data.index(b'\0', s); name = data[s:e].decode()
                if re.search(pattern, name):
                    # lib_ordinal 0xfe (-2) = BIND_SPECIAL_DYLIB_FLAT_LOOKUP, 0xfd (-3) = WEAK_LOOKUP, 0xff (-1) = MAIN_EXECUTABLE
                    print(f"  chained-import: {name} lib_ordinal={lib_ordinal:#x} weak_import={weak_import}")
        off += cmdsize

if len(sys.argv) > 2:
    print("--- dyld bind / import entries ---")
    for path in sys.argv[2:]:
        print(path)
        binds(open(path, 'rb').read(), sys.argv[1])
