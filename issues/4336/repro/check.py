import os
import pathlib
import subprocess
import sys
import tempfile

source = pathlib.Path(sys.argv[1]) / 'apps/server/src/assets/install-machine.sh'
text = source.read_text()
start = text.index('\nsystemd_scope=--user\n')
end = text.index('\nif [ -n "$join_pid" ]; then\n  kill', start)
segment = text[start:end]
setup = '''
set -eu
platform=linux
reconnect=no
join_pid=
host_daemon_port=49999
id() { printf '1000\\n'; }
systemctl() { printf '%s\\n' "$*" >> "$CASE_DIR/calls"; return "$BUS_RESULT"; }
daemon_status_matches() { return 0; }
warning_step() { printf '%s\\n' "$*"; }
fail_step() { printf '%s\\n' "$*"; }
detail() { printf '%s\\n' "$*"; }
'''
failed = False
for name, bus, skip in [('unavailable-default', '1', None), ('reachable-default', '0', None), ('unavailable-explicit-skip', '1', '1')]:
    with tempfile.TemporaryDirectory(prefix='installer-case-') as directory:
        env = {'PATH': '/usr/bin:/bin', 'CASE_DIR': directory, 'BUS_RESULT': bus}
        if skip is not None:
            env['BB_INSTALL_SKIP_SERVICE'] = skip
        result = subprocess.run(['sh', '-c', setup + segment + '\nprintf "PERSISTENT_SERVICE_PATH\\n"\n'], env=env, text=True, capture_output=True)
        print(f'{name}: exit={result.returncode}')
        print(result.stdout, end='')
        print('calls=' + pathlib.Path(directory, 'calls').read_text().strip())
        if name == 'unavailable-default':
            passed = result.returncode != 0 or 'PERSISTENT_SERVICE_PATH' in result.stdout
            print('persistent-service-or-error assertion: ' + ('PASS' if passed else 'FAIL'))
            failed |= not passed
        elif name == 'reachable-default':
            assert result.returncode == 0 and 'PERSISTENT_SERVICE_PATH' in result.stdout
        else:
            assert result.returncode == 0 and 'Service installation skipped' in result.stdout
sys.exit(1 if failed else 0)
