import html, re
R='/tmp/bb-reports/issues/1712/repro/'
def esc(p): return html.escape(open(R+p).read())
def esc_s(s): return html.escape(s)
def strip_ansi(s):
    return re.sub(r'\x1b\[[0-9;]*m','',s)
def clean_log(p, tail=None):
    lines=[l for l in strip_ansi(open(R+p).read()).splitlines() if not l.startswith('{') and l.strip()]
    if tail: lines=lines[-tail:]
    return esc_s('\n'.join(lines))
main_ev=esc('thread-events-main.txt'); ctrl_ev=esc('thread-events-control.txt'); fix_ev=esc('thread-events-with-fix.txt')
snippet=esc('bridge-mid-thread-plan.test-snippet.ts')
fixdiff=esc('proposed-fix.diff')
test_base=clean_log('test-on-base.log'); test_fix=clean_log('test-with-fix.log'); test_full=clean_log('test-full-with-fix.log', 8)
plan_send=esc('plan-send.json'); plan_create=esc('plan-create.json')
B='https://github.com/get-bb/bb/blob/16ceb3a540f81c1189efaffb27a39b1d9443abf5/'
T='https://github.com/get-bb/bb/blob/desktop-v0.37.0/'
def L(path, a, b=None, text=None):
    frag=f'#L{a}' + (f'-L{b}' if b else '')
    return f'<a href="{B}{path}{frag}">{text or (path.split("/")[-1]+frag)}</a>'
def LT(path, a, b=None, text=None):
    frag=f'#L{a}' + (f'-L{b}' if b else '')
    return f'<a href="{T}{path}{frag}">{text or (path.split("/")[-1]+frag)}</a>'

tpl = open('/tmp/bb-reports/issues/1712/report-template.html').read()
out = tpl
for k,v in {
 '@@MAIN_EV@@':main_ev,'@@CTRL_EV@@':ctrl_ev,'@@FIX_EV@@':fix_ev,'@@SNIPPET@@':snippet,'@@FIXDIFF@@':fixdiff,
 '@@TEST_BASE@@':test_base,'@@TEST_FIX@@':test_fix,'@@TEST_FULL@@':test_full,'@@PLAN_SEND@@':plan_send,'@@PLAN_CREATE@@':plan_create,
 '@@L_THREADCMD@@':L('apps/server/src/services/threads/thread-commands.ts',263,274),
 '@@L_REGISTRY@@':L('packages/agent-runtime/src/provider-registry.ts',37,60),
 '@@L_BPA247@@':L('packages/agent-runtime/src/bridge-protocol-adapter.ts',247),
 '@@L_BPA11@@':L('packages/agent-runtime/src/bridge-protocol-adapter.ts',11,14),
 '@@L_RUNTIME@@':L('packages/agent-runtime/src/runtime.ts',1052,1063),
 '@@L_EXECOPTS@@':L('packages/agent-runtime/src/execution-options.ts',103,144),
 '@@L_SESSPARAMS@@':L('plugins/provider-claude-code/src/session-params.ts',280,332),
 '@@L_APPLYLIVE@@':L('plugins/provider-claude-code/src/bridge/bridge.ts',564,595),
 '@@L_WITHTURN@@':L('plugins/provider-claude-code/src/bridge/bridge.ts',811,826),
 '@@L_RUNTURN@@':L('plugins/provider-claude-code/src/bridge/bridge.ts',2257,2299),
 '@@L_RESTORE@@':L('plugins/provider-claude-code/src/bridge/bridge.ts',1713,1731),
 '@@L_SETPERM@@':L('plugins/provider-claude-code/src/bridge/sdk-session.ts',173,184),
 '@@L_037ADAPTER@@':LT('packages/agent-runtime/src/claude-code/adapter.ts',1052),
 '@@L_037BRIDGE@@':LT('packages/agent-runtime/src/claude-code/bridge/bridge.ts',1786,1856),
}.items():
    assert k in out, k
    out = out.replace(k, v)
assert not re.findall(r'@@[A-Z_0-9]+@@', out)
open('/tmp/bb-reports/issues/1712.html','w').write(out)
print(len(out))
