/*
  End-user community preview configuration.

  PREVIEW MODE is intentionally enabled in this package so the owner can see the
  full Discord entry experience before live credentials are connected.

  When the live Discord + Supabase backend is connected, set previewMode to false
  and replace the preview handlers in app.js with the authenticated session data.
*/
window.DERBY_COMMUNITY = {
  previewMode: true,
  serverName: "Discord community",
  publicPickDisclosure: "Your Discord display name, avatar and Derby pick will be visible on the public Derby page.",
  sampleEntries: [
    { id: "demo-01", name: "ChartNerd", racerId: "tatiana" },
    { id: "demo-02", name: "MoonStacker", racerId: "tom" },
    { id: "demo-03", name: "CandleWatcher", racerId: "bike" },
    { id: "demo-04", name: "SatsAndCoffee", racerId: "rodster" },
    { id: "demo-05", name: "DipHunter", racerId: "whitesw0n" },
    { id: "demo-06", name: "OrangePill", racerId: "tatiana" },
    { id: "demo-07", name: "BlockRunner", racerId: "tom" },
    { id: "demo-08", name: "HashRider", racerId: "bike" },
    { id: "demo-09", name: "LowFinder", racerId: "rodster" },
    { id: "demo-10", name: "WickSniper", racerId: "tatiana" }
  ]
};
