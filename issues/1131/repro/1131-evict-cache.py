#!/usr/bin/env python3
"""Evict the OS page cache for a SQLite database (db, -wal, -shm). No root needed."""
import os
import sys

for suffix in ("", "-wal", "-shm"):
    path = sys.argv[1] + suffix
    if not os.path.exists(path):
        continue
    fd = os.open(path, os.O_RDONLY)
    os.posix_fadvise(fd, 0, 0, os.POSIX_FADV_DONTNEED)
    os.close(fd)
    print("evicted", path, os.path.getsize(path))
