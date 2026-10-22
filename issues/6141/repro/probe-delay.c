#define _GNU_SOURCE
#include <dlfcn.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

static void record_event(const char *event) {
  const char *trace = getenv("BB_PROBE_TRACE");
  if (!trace) return;
  int output = open(trace, O_WRONLY | O_CREAT | O_APPEND, 0600);
  if (output < 0) return;
  dprintf(output, "%s pid=%d\n", event, getpid());
  close(output);
}

__attribute__((constructor)) static void started(void) {
  record_event("started");
}

int fsync(int descriptor) {
  static int (*original_fsync)(int);
  if (!original_fsync) original_fsync = dlsym(RTLD_NEXT, "fsync");
  const char *gate = getenv("BB_PROBE_DELAY_GATE");
  char descriptor_path[64];
  char target[4096];
  snprintf(descriptor_path, sizeof(descriptor_path), "/proc/self/fd/%d", descriptor);
  ssize_t length = readlink(descriptor_path, target, sizeof(target) - 1);
  if (length > 0) {
    target[length] = 0;
    if (gate && access(gate, F_OK) == 0 && strstr(target, ".claude.json.tmp.")) {
      record_event("delayed-fsync-enter");
      struct timespec delay = {.tv_sec = 12};
      while (nanosleep(&delay, &delay) < 0) {}
      record_event("delayed-fsync-return");
    }
  }
  return original_fsync(descriptor);
}
