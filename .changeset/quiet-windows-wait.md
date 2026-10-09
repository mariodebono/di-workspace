---
"@mariodebono/di-electron": minor
---

Add BeforeAppQuit and BeforeMainWindowClose guards that allow applications to cancel normal quitting, closing or hiding while work is in progress. Guards support synchronous and asynchronous boolean decisions, run before the corresponding lifecycle hooks, and coalesce repeated requests while permission is pending. Existing lifecycle hooks retain their notification semantics.
