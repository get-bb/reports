export const definePluginApp = setup => ({setup});
export const experimental_useSidebarThreads = () => ({threads:window.fixtureThreads});
export const experimental_useSidebarThreadActions = () => ({open:id=>window.openedThread=id});
