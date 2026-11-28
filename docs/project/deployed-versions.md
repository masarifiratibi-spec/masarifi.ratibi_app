# Deployment observations

Source branch consolidation does not publish an application or deploy a server.

| Surface | Last recorded observation | What is not established |
|---|---|---|
| API production | Prior main-promotion audit: health ok, version `97e66588b2b516ae8c67e285f8439be591439dd6`, started `2026-11-27T23:54:05.417Z` | Not a fresh observation from this consolidation; source branch name not inferred |
| Worker | Check its own pinned runtime manifest and running artifact | Do not copy the API SHA into this row |
| Admin | Existing service-specific release receipts in ops | Fresh running source/digest not yet read in this task |
| Android | Historical guide records 1.0.1 (166) accepted on internal track | Current public store availability and installed client versions not queried |
| iOS | Historical guide records 1.0.0 (27) TestFlight receipt; user reports a Store/downloaded version | Current App Store build/status not independently queried in this task |
| Unified candidate | Temporary consolidation branch | Not published, signed, uploaded or deployed by this task |

Before a later release, refresh only the intended service/store row from read-only evidence. Record artifact digest/build number and last compatible rollback artifact. Source-code presence and CI success do not prove customer availability.
