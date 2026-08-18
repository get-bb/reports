#!/bin/bash
# Dumps DB/log evidence for the child-completion drop. Args: <data dir> <parent thread id> <child thread id>
D=$1; P=$2; C=$3
echo "# child thread $C (parent $P) finished its turn:"
sqlite3 "$D/bb.db" "select sequence, type, substr(data,1,90) from events where thread_id='$C' and type in ('turn/completed','client/turn/requested') order by sequence"
echo
echo "# parent thread events from the pending question onward. No client/turn/requested with initiator=system (child-completed notice) ever arrived:"
sqlite3 "$D/bb.db" "select sequence, type, substr(data,1,120) from events where thread_id='$P' and sequence>=17 order by sequence"
echo
echo "# server log lines mentioning parent/child/notification (count):"
grep -ci "parent\|child\|notification" "$D/logs/server.1.log"
echo "# queued_thread_messages rows for parent:"
sqlite3 "$D/bb.db" "select count(*) from queued_thread_messages where thread_id='$P'"
echo "# pending_interactions rows for parent:"
sqlite3 "$D/bb.db" "select id, status from pending_interactions where thread_id='$P'"
