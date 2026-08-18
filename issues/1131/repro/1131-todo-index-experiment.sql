-- Issue #1131 fix experiment: a partial expression index for the todo-snapshot
-- lookup. Run with: sqlite3 <bb.db> < 1131-todo-index-experiment.sql
.timer on
CREATE INDEX IF NOT EXISTS events_todo_snapshot_idx
  ON events(thread_id, sequence)
  WHERE item_kind = 'toolCall'
    AND type IN ('item/started', 'item/completed')
    AND json_extract(data, '$.item.tool') IN ('TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet');
.print --- plan with literals (as the query would have to be written for SQLite to prove the partial-index predicate):
EXPLAIN QUERY PLAN
SELECT id, data FROM events
WHERE thread_id = 'thr_v67duphyr7'
  AND type IN ('item/started', 'item/completed')
  AND item_kind = 'toolCall'
  AND json_extract(data, '$.item.tool') IN ('TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet');
.print --- plan with the current bound parameters for type/item_kind (partial index NOT usable):
EXPLAIN QUERY PLAN
SELECT id, data FROM events
WHERE thread_id = 'thr_v67duphyr7'
  AND type IN (?1, ?2)
  AND item_kind = ?3
  AND json_extract(data, '$.item.tool') IN ('TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet');
.print --- rows in the partial index (whole database):
SELECT count(*) FROM events INDEXED BY events_todo_snapshot_idx
WHERE item_kind = 'toolCall'
  AND type IN ('item/started', 'item/completed')
  AND json_extract(data, '$.item.tool') IN ('TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet');
.print --- plan when pinned with INDEXED BY (what a fix would emit, cf. #1204):
EXPLAIN QUERY PLAN
SELECT id, data FROM events INDEXED BY events_todo_snapshot_idx
WHERE thread_id = 'thr_v67duphyr7'
  AND type IN ('item/started', 'item/completed')
  AND item_kind = 'toolCall'
  AND json_extract(data, '$.item.tool') IN ('TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet')
ORDER BY sequence;
SELECT count(*) FROM events INDEXED BY events_todo_snapshot_idx
WHERE thread_id = 'thr_v67duphyr7'
  AND type IN ('item/started', 'item/completed')
  AND item_kind = 'toolCall'
  AND json_extract(data, '$.item.tool') IN ('TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet');
