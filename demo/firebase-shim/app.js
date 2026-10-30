const apps = [];
export function initializeApp(options = {}, name = "[DEFAULT]") {
  const app = { name, options, automaticDataCollectionEnabled: false };
  apps.push(app);
  return app;
}
export function getApps() { return apps.slice(); }
export function getApp() { return apps[0] || initializeApp(); }
