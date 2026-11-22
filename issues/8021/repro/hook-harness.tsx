import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { SearchMessageLocationProvider, useScrollToSearchedMessage } from "./components/thread/timeline/useScrollToSearchedMessage";
import { attachSonnerToast } from "./components/ui/app-toast-runtime";
import { threadTimelineQueryKey } from "./hooks/queries/query-keys";

const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
const queryKey = threadTimelineQueryKey("thread-1");
const oldRow = { id: "cached-message", messageSeq: 1, sourceSeqStart: 1, sourceSeqEnd: 1 };
const newRow = { id: "linked-message", messageSeq: 2, sourceSeqStart: 2, sourceSeqEnd: 2 };
client.setQueryData(queryKey, [oldRow]);
let completeRefresh: (() => void) | null = null;
attachSonnerToast(toast);

function Reproduction() {
  const query = useQuery({ queryKey, queryFn: () => new Promise<typeof oldRow[]>((resolve) => { completeRefresh = () => resolve([oldRow, newRow]); }) });
  const pending = useScrollToSearchedMessage(query.data ?? [], "thread-1", { reportsMissingTarget: true });
  return <main>
    <h1>Issue 8021: real navigation-hook reproduction</h1>
    <p>Isolated harness; not a full bb app screenshot. Hook and toast code are unchanged trusted main.</p>
    <p>Target: message 2. Initial cache: message 1.</p>
    <p>Refresh: <strong>{query.isFetching ? "in flight" : "complete"}</strong> · Rows: <strong>{query.data?.length}</strong> · Reveal pending: <strong>{String(pending)}</strong></p>
    <button onClick={() => completeRefresh?.()}>Complete timeline refresh</button>
    <p>The border below is the timeline. Visibility uses the same pending flag as ThreadTimelineRows.</p>
    <section><div id="timeline" style={pending ? { visibility: "hidden" } : undefined}>
      {query.data?.map((row) => <p key={row.id} data-timeline-row-id={row.id}>{row.messageSeq === 1 ? "Previously cached message" : "New linked reply"}</p>)}
    </div></section>
    <Toaster duration={60000} />
  </main>;
}

document.head.insertAdjacentHTML("beforeend", "<style>body{font:16px/1.6 system-ui;background:#fafaf8;color:#222}main{max-width:850px;margin:30px auto;padding:24px}h1{font-size:24px}button{padding:12px;border:1px solid;border-radius:6px;background:white}section{border:1px solid #777;min-height:180px;padding:20px;margin:14px 0}</style>");
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/threads/thread-1#msg=2"]}><SearchMessageLocationProvider threadId="thread-1"><Reproduction /></SearchMessageLocationProvider></MemoryRouter></QueryClientProvider>);
