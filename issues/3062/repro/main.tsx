import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import t3 from '../t3sidebar/app';
import bb from '../bb-sidebar/app';
import gtd from '../bb-plugins/plugins/gtd-sidebar/app';
import inbox from '../bb-plugin-thread-inbox/app';
import { collectPluginAppRegistrations } from 'bb-source/packages/plugin-sdk/src/internal/plugin-app-collector.ts';
import { setPluginSlotRegistrations, removePluginSlotRegistrations, getPluginSlotSnapshot } from 'bb-source/apps/app/src/lib/plugin-slots.ts';
import { PluginThreadHeaderActions } from 'bb-source/apps/app/src/components/plugin/PluginThreadHeaderActions.tsx';
import { resolvePreferredReplacement } from 'bb-source/apps/app/src/lib/plugin-replacement-preference.ts';
const definitions = {'bb-sidebar':bb,'gtd-sidebar':gtd,'t3sidebar':t3,'thread-inbox':inbox};
const root = createRoot(document.getElementById('header'));
window.configure = (ids=['t3sidebar'], childCount=24, selectedThread='parent', reloads=1) => {
 window.fixtureThreads=[{id:'parent',title:'Parent fixture',parentThreadId:null,createdAt:0,isArchived:false},...Array.from({length:childCount},(_,i)=>({id:`child-${i}`,title:`Child ${i+1}`,parentThreadId:'parent',createdAt:i+1,isArchived:false,hasPendingInteraction:false,indicator:'none',indicatorLabel:'Idle',originKind:'thread',providerId:'codex',latestAttentionAt:0,activity:{workflows:0,backgroundAgents:0,backgroundCommands:0},updatedAt:0}))];
 flushSync(()=>{
 for(const id of Object.keys(definitions)) removePluginSlotRegistrations(id);
 for(let i=0;i<reloads;i++) for(const id of ids) setPluginSlotRegistrations(id,collectPluginAppRegistrations(definitions[id]));
 root.render(<PluginThreadHeaderActions threadId={selectedThread} projectId="fixture"/>);
 });
 document.getElementById('description').textContent=`Enabled: ${ids.join(', ')}. Selected sidebar: T3 Sidebar. Open thread: ${selectedThread}. Children: ${childCount}. Header instances: 1.`;
 window.selectedSidebar=resolvePreferredReplacement(getPluginSlotSnapshot().threadLists,'t3sidebar/inbox');
 return getPluginSlotSnapshot().threadHeaderActions.map(s=>`${s.pluginId}/${s.id}`);
};
window.configure();
