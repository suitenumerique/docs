All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- ✨(backend) add limit on distinct reactions per comment #1978
- ✨(backend) create a dedicated endpoint to update document content 
- ⚡️(backend) stream s3 file content with a dedicated endpoint

### Changed

- ♻️(backend) rename documents content endpoint in `formatted-content` (BC)
- 🚸(frontend) show Crisp from the help menu #2222
- ♿️(frontend) structure correctly 5xx error alerts #2128
- ♿️(frontend) make doc search result labels uniquely identifiable #2212
- ⬆️(backend) upgrade docspec to v3.0.x and adapt converter API #2220
- ✨(backend) make forward auth request uri header configurable #2241
- ♿️(frontend) fix sidebar resize handle for screen readers #2122

### Fixed

- 🚸(frontend) redirect on current url tab after 401 #2197
- 🐛(frontend) abort check media status unmount #2194
- ✨(backend) order pinned documents by last updated at #2028
- 🐛(frontend) fix app shallow reload #2231
- 🐛(frontend) fix interlinking modal clipping #2213
- 🛂(frontend) fix cannot manage member on small screen #2226
- 🐛(backend) load jwks url when OIDC_RS_PRIVATE_KEY_STR is set
- 🐛(backend) Prevent moving document to its own descendant or self #2208
- 🐛(backend) return 400 when restoring a non-deleted document #2225

### Removed

- 🔥(backend) remove deprecated descendants endpoint #2243
- 🔥(backend) remove content in document responses

## [v4.8.6] - 2026-04-08

### Added

- 🚸(frontend) allow opening "@page" links with
  ctrl/command/middle-mouse click #2170
- ✅ E2E - Any instance friendly #2142

### Changed

- ♻️(backend) do not paginate threads list response #2186
- 💄(frontend) Use StyledLink for sub doc tree #2188

### Fixed

- 🐛(frontend) Fix drop cursor creating columns #2185
- 🐛 Fixed side effects between comments and versioning #2183
- 🐛(frontend) Firefox child doc visual #2188

## [v4.8.5] - 2026-04-03

### Added

- 🔧(backend) settings CONVERSION_UPLOAD_ENABLED to control usage of docspec
- 🥚(frontend) add easter egg on doc emoji creation #2155

### Changed

- ♿(frontend) use aria-haspopup menu on DropButton triggers #2126
- ♿️(frontend) add contextual browser tab titles for docs routes #2120
- ♿️(frontend) fix empty heading before section titles in HTML export #2125

### Fixed

- ⚡️(frontend) add jitter to WS reconnection #2162
- 🐛(frontend) fix tree pagination #2145
- 🐛(nginx) add page reconciliation on nginx #2154
- 🐛(backend) fix race condition in reconciliation requests CSV import #2153

## [v4.8.4] - 2026-03-25

### Added

- 🚸(frontend) hint min char search users #2064

### Changed

- 💄(frontend) improve comments highlights #1961
- ♿️(frontend) improve BoxButton a11y and native button semantics #2103
- ♿️(frontend) improve language picker accessibility #2069
- ♿️(frontend) add aria-hidden to decorative icons in dropdown menu #2093
- 🐛(backend) move lock table closer to the insert operation targeted
- ♿️(frontend) replace ARIA grid pattern with list in docs grid #2131

### Fixed

- 🐛(y-provider) destroy Y.Doc instances after each convert request #2129
- 🐛(backend) remove deleted sub documents in favorite_list endpoint #2083

### Fixed

- 🐛(backend) create_for_owner: add accesses before saving doc content #2124

## [v4.8.3] - 2026-03-23

### Changed

- ♿️(frontend) improve version history list accessibility #2033
- ♿(frontend) focus skip link on headings and skip grid dropzone #1983
- ♿️(frontend) add sr-only format to export download button #2088
- ♿️(frontend) announce formatting shortcuts for screen readers #2070
- ✨(frontend) add markdown copy icon for Copy as Markdown option #2096
- ♻️(backend) skip saving in database a document when payload is empty #2062
- ♻️(frontend) refacto Version modal to fit with the design system #2091
- ⚡️(frontend) add debounce WebSocket reconnect #2104

### Fixed

- ♿️(frontend) fix more options menu feedback for screen readers #2071
- ♿️(frontend) fix more options menu feedback for screen readers #2071
- 💫(frontend) fix the help button to the bottom in tree #2073
- ♿️(frontend) fix aria-labels for table of contents #2065
- 🐛(backend) allow using search endpoint without refresh token enabled #2097
- 🐛(frontend) fix close panel when click on subdoc #2094
- 🐛(frontend) fix leftpanel button in doc version #9238
- 🐛(y-provider) fix loop when no cookies #2101

## [v4.8.2] - 2026-03-19

### Added

- ✨(backend) add resource server api #1923
- ✨(frontend) activate Find search #1834
- ✨ handle searching on subdocuments #1834
- ✨(backend) add search feature flags #1897

### Changed

- ♿️(frontend) ensure doc title is h1 for accessibility #2006
- ♿️(frontend) add nb accesses in share button aria-label #2017
- ✨(backend) improve fallback logic on search endpoint #1834

### Fixed

- 🐛(frontend) fix image resizing when caption #2045
- 🙈(docker) add \*\*/.next to .dockerignore #2034
- ♿️(frontend) fix share modal heading hierarchy #2007
- ♿️(frontend) fix Copy link toast accessibility for screen readers #2029
- ♿️(frontend) fix modal aria-label and name #2014
- ♿️(frontend) fix language dropdown ARIA for screen readers #2020
- ♿️(frontend) fix waffle aria-label spacing for new-window links #2030
- 🐛(backend) stop using add_sibling method to create sandbox document #2084
- 🐛(backend) duplicate a document as last-sibling #2084

### Removed

- 🔥(api) remove `documents/<document_id>/descendants/` endpoint #1834
- 🔥(api) remove pagination on `documents/search/` endpoint #1834

## [v4.8.1] - 2026-03-17

### Added

- 🔧(backend) add DB_PSYCOPG_POOL_ENABLED settings #2035

### Changed

- ⬇️(backend) downgrade django-treebeard to version < 5.0.0 #2036

## [v4.8.0] - 2026-03-13

### Added

- ✨(backend) add a is_first_connection flag to the User model #1938
- ✨(frontend) add onboarding modal with help menu button #1868

### Changed

- ♿(frontend) localize LaGaufre label fallback in Docs #1979
- ✨(backend) add a migration cleaning on-boarding document accesses #1971
- ⬆️(frontend) upgrade Next.js to v16 #1980
- ♿️(frontend) fix aria-label and landmark on document banner state #1986
- 🌐(i18n) add "new window" translation key for waffle aria-label #1984

### Fixed

- 🐛(backend) create a link_trace record for on-boarding documents #1971
- 🐛(backend) manage race condition when creating sandbox document #1971
- 🐛(frontend) fix flickering left panel #1989
- ♿️(frontend) improve doc tree keyboard navigation #1981
- 🔧(helm) allow specific env var for the backend and celery deploy

## [v4.7.0] - 2026-03-09

### Added

- ✨(helm) allow all keys in configMap as env var #1872

### Changed

- 📝(docs) improve README and add documentation hub #1870
- ♿️(frontend) restore focus to triggers after closing menus and modals #1863
- 🚸(frontend) change position elements toolbar #1957
- ♿️(frontend) add focus on open to modals #1948

### Fixed

- 🐛(backend) enforce emoji validation for reactions #1965
- 🐛(frontend) analytic feature flags problem #1953
- 🐛(frontend) fix home collapsing panel #1954
- 🐛(frontend) fix disabled color on icon Dropdown #1950
- 🐛(frontend) fix zIndex table of content #1949
- 🐛(frontend) fix bug when language not supported by BN #1957
- 🐛 (backend) prevent privileged users from requesting access #1898

## [v4.6.0] - 2026-03-03

### Added

- ✨(frontend) integrate new Blocknote AI feature #1847
- 👷(docker) add arm64 platform support for image builds #1901
- ✨(tracking) add UTM parameters to shared document links #1896
- ✨(frontend) add floating bar with leftpanel collapse button #1876
- ✨(frontend) Can print a doc #1832
- ✨(backend) manage reconciliation requests for user accounts #1878
- 👷(CI) add GHCR workflow for forked repo testing #1851
- ✨(frontend) Move doc modal #1886
- ⚡️(backend) remove content from Document serializer when asked #1910
- ✨(backend) allow the duplication of subpages #1893
- ✨(backend) Onboarding docs for new users #1891
- 🩺(trivy) add trivyignore file and add minimatch CVE #1915
- 🚩 Add feature flags for the AI feature #1922
- 🍱(frontend) add icons ui-kit #1943

### Changed

- ♿️(frontend) prevent dates from being focusable #1855
- ♿️(frontend) Focus main container after navigation #1864
- 💄(frontend) align colors and logo with ui-kit v2 #1869
- 🚸(backend) sort user search results by proximity with the active user #1802
- 🚸(oidc) ignore case when fallback on email #1880
- ⚡️(CI) optimize Docker Hub workflow #1919

### Fixed

- 🐛(frontend) fix broadcast store sync #1846
- 🐛(helm) use celery resources instead of backend resources #1887
- 🐛(helm) reverse liveness and readiness for backend deployment #1887
- 🐛(y-provider) use CONVERSION_FILE_MAX_SIZE settings #1913
- 🐛(frontend) fix callout block spacing for old browsers #1914

## [v4.5.0] - 2026-01-28

### Added

- ✨(frontend) integrate configurable Waffle #1795
- ✨ Import of documents #1609
- 🚨(CI) gives warning if theme not updated #1811
- ✨(frontend) Add stat for Crisp #1824
- ✨(auth) add silent login #1690
- 🔧(project) add DJANGO_EMAIL_URL_APP environment variable #1825

### Changed

- ♿(frontend) improve accessibility:
  - ♿️(frontend) fix subdoc opening and emoji pick focus #1745
- ✨(backend) add field for button label in email template #1817

### Fixed

- ✅(e2e) fix e2e test for other browsers #1799
- 🐛(export) fix export column NaN #1819
- 🐛(frontend) add fallback for unsupported Blocknote languages #1810
- 🐛(frontend) fix emojipicker closing in tree #1808
- 🐛(frontend) display children in favorite #1782
- 🐛(frontend) preserve typed text after @ on escape #1833

### Removed

- 🔥(project) remove all code related to template #1780
- 🔥(api) remove `documents/<document_id>/descendants/` endpoint #1834
- 🔥(api) remove pagination on `documents/search/` endpoint #1834

### Security

- 🔒️(trivy) fix vulnerability about jaraco.context #1806

## [v4.4.0] - 2026-01-13

### Added

- ✨(backend) add documents/all endpoint with descendants #1553
- ✅(export) add PDF regression tests #1762
- 📝(docs) Add language configuration documentation #1757
- 🔒(helm) Set default security context #1750
- ✨(backend) use langfuse to monitor AI actions #1776

### Changed

- ♿(frontend) improve accessibility:
  - ♿(frontend) make html export accessible to screen reader users #1743
  - ♿(frontend) add missing label and fix Axes errors to improve a11y #1693

### Fixed

- ✅(backend) reduce flakiness on backend test #1769
- 🐛(frontend) fix clickable main content regression #1773
- 🐛(backend) fix TRASHBIN_CUTOFF_DAYS type error #1778
- 💄(frontend) fix icon position in callout block #1779

### Security

- 🔒️(backend) validate more strictly url used by cors-proxy endpoint #1768
- 🔒️(frontend) fix props vulnerability in Interlinking #1792

## [v4.3.0] - 2026-01-05

### Added

- ✨(helm) redirecting system #1697
- 📱(frontend) add comments for smaller device #1737
- ✨(project) add custom js support via config #1759

### Changed

- 🥅(frontend) intercept 401 error on GET threads #1754
- 🦺(frontend) check content type pdf on PdfBlock #1756
- ✈️(frontend) pause Posthog when offline #1755

### Fixed

- 🐛(frontend) fix tables deletion #1739
- 🐛(frontend) fix children not display when first resize #1753

## [v4.2.0] - 2025-12-17

### Added

- ✨(backend) allow to create a new user in a marketing system #1707
- ✨(backend) add async indexation of documents on save (or access save) #1276
- ✨(backend) add debounce mechanism to limit indexation jobs #1276
- ✨(api) add API route to search for indexed documents in Find #1276
- 🥅(frontend) add boundary error page #1728

### Changed

- 🛂(backend) stop throttling collaboration servers #1730
- 🚸(backend) use unaccented full name for user search #1637
- 🌐(backend) internationalize demo #1644
- ♿(frontend) improve accessibility:
  - ♿️Improve keyboard accessibility for the document tree #1681

### Fixed

- 🐛(frontend) paste content with comments from another document #1732
- 🐛(frontend) Select text + Go back one page crash the app #1733
- 🐛(frontend) fix versioning conflict #1742

## [v4.1.0] - 2025-12-09

### Added

- ⚡️(frontend) export html #1669

### Changed

- ♿(frontend) improve accessibility:
  - ♿(frontend) add skip to content button for keyboard accessibility #1624
  - ♿(frontend) fix toggle panel button a11y labels #1634
- 🔒️(frontend) remove dangerouslySetInnerHTML from codebase #1712
- ⚡️(frontend) improve Comments feature #1687

### Fixed

- 🐛(nginx) fix / location to handle new static pages #1682
- 🐛(frontend) rerendering during resize window #1715

## [v4.0.0] - 2025-12-01

### Added

- ✨ Add comments feature to the editor #1330
- ✨(backend) Comments on text editor #1330
- ✨(frontend) link to create new doc #1574

### Changed

- ⚡️(sw) stop to cache external resources likes videos #1655
- 💥(frontend) upgrade to ui-kit v2 #1605
- ⚡️(frontend) improve perf on upload and table of contents #1662
- ♿(frontend) improve accessibility:
  - ♿(frontend) improve share modal button accessibility #1626
  - ♿(frontend) improve screen reader support in DocShare modal #1628

### Fixed

- 🐛(frontend) fix toolbar not activated when reader #1640
- 🐛(frontend) preserve left panel width on window resize #1588
- 🐛(frontend) prevent duplicate as first character in title #1595

## [v3.10.0] - 2025-11-18

### Added

- ✨(export) enable ODT export for documents #1524
- ✨(frontend) improve mobile UX by showing subdocs count #1540

### Changed

- ♻️(frontend) preserve @ character when esc is pressed after typing it #1512
- ♻️(frontend) make summary button fixed to remain visible during scroll #1581
- ♻️(frontend) pdf embed use full width #1526

### Fixed

- ♿(frontend) improve accessibility:
  - ♿(frontend) improve ARIA in doc grid and editor for a11y #1519
  - ♿(frontend) improve accessibility and styling of summary table #1528
  - ♿(frontend) add focus trap and enter key support to remove doc modal #1531
- 🐛(frontend) fix alignment of side menu #1597
- 🐛(frontend) fix fallback translations with Trans #1620
- 🐛(export) fix image overflow by limiting width to 600px during export #1525
- 🐛(export) fix table cell alignment issue in exported documents #1582
- 🐛(export) preserve image aspect ratio in PDF export #1622
- 🐛(export) Export fails when paste with style #1552

### Security

- mitigate role escalation in the ask_for_access viewset #1580

### Removed

- 🔥(backend) remove api managing templates

## [v3.9.0] - 2025-11-10

### Added

- ✨(frontend) create skeleton component for DocEditor #1491
- ✨(frontend) add an EmojiPicker in the document tree and title #1381
- ✨(frontend) ajustable left panel #1456

### Changed

- ♻️(frontend) adapt custom blocks to new implementation #1375
- ♻️(backend) increase user short_name field length #1510
- 🚸(frontend) separate viewers from editors #1509

### Fixed

- 🐛(frontend) fix duplicate document entries in grid #1479
- 🐛(backend) fix trashbin list #1520
- ♿(frontend) improve accessibility:
  - ♿(frontend) remove empty alt on logo due to Axe a11y error #1516
- 🐛(backend) fix s3 version_id validation #1543
- 🐛(frontend) retry check media status after page reload #1555
- 🐛(frontend) fix Interlinking memory leak #1560
- 🐛(frontend) button new doc UI fix #1557
- 🐛(frontend) interlinking UI fix #1557

## [v3.8.2] - 2025-10-17

### Fixed

- 🐛(service-worker) fix sw registration and page reload logic #1500

## [v3.8.1] - 2025-10-17

### Fixed

- ⚡️(backend) improve trashbin endpoint performance #1495
- 🐛(backend) manage invitation partial update without email #1494
- ♿(frontend) improve accessibility:
  - ♿ add missing aria-label to add sub-doc button for accessibility #1480
  - ♿ add missing aria-label to more options button on sub-docs #1481

### Removed

- 🔥(backend) remove treebeard form for the document admin #1470

## [v3.8.0] - 2025-10-14

### Added

- ✨(frontend) add pdf block to the editor #1293
- ✨List and restore deleted docs #1450

### Changed

- ♻️(frontend) Refactor Auth component for improved redirection logic #1461
- ♻️(frontend) replace Arial font-family with token font #1411
- ♿(frontend) improve accessibility:
  - ♿(frontend) enable enter key to open documents #1354
  - ♿(frontend) improve modal a11y: structure, labels, title #1349
  - ♿improve NVDA navigation in DocShareModal #1396
  - ♿ improve accessibility by adding landmark roles to layout #1394
  - ♿ add document visible in list and openable via enter key #1365
  - ♿ add pdf outline property to enable bookmarks display #1368
  - ♿ hide decorative icons from assistive tech with aria-hidden #1404
  - ♿ fix rgaa 1.9.1: convert to figure/figcaption structure #1426
  - ♿ remove redundant aria-label to avoid over-accessibility #1420
  - ♿ remove redundant aria-label on hidden icons and update tests #1432
  - ♿ improve semantic structure and aria roles of leftpanel #1431
  - ♿ add default background to left panel for better accessibility #1423
  - ♿ restyle checked checkboxes: removing strikethrough #1439
  - ♿ add h1 for SR on 40X pages and remove alt texts #1438
  - ♿ update labels and shared document icon accessibility #1442
- 🍱(frontend) Fonts GDPR compliants #1453
- ♻️(service-worker) improve SW registration and update handling #1473

### Fixed

- 🐛(backend) duplicate sub docs as root for reader users #1385
- ⚗️(service-worker) remove index from cache first strategy #1395
- 🐛(frontend) fix 404 page when reload 403 page #1402
- 🐛(frontend) fix legacy role computation #1376
- 🛂(frontend) block editing title when not allowed #1412
- 🐛(frontend) scroll back to top when navigate to a document #1406
- 🐛(frontend) fix export pdf emoji problem #1453
- 🐛(frontend) fix attachment download filename #1447
- 🐛(frontend) exclude h4-h6 headings from table of contents #1441
- 🔒(frontend) prevent readers from changing callout emoji #1449
- 🐛(frontend) fix overlapping placeholders in multi-column layout #1455
- 🐛(backend) filter invitation with case insensitive email #1457
- 🐛(frontend) reduce no access image size from 450 to 300 #1463
- 🐛(frontend) preserve interlink style on drag-and-drop in editor #1460
- ✨(frontend) load docs logo from public folder via url #1462
- 🔧(keycloak) Fix https required issue in dev mode #1286

## Removed

- 🔥(frontend) remove custom DividerBlock ##1375

## [v3.7.0] - 2025-09-12

### Added

- ✨(api) add API route to fetch document content #1206
- ✨(frontend) doc emojis improvements #1381
  - add an EmojiPicker in the document tree and document title
  - remove emoji buttons in menus

### Changed

- 🔒️(backend) configure throttle on every viewsets #1343
- ⬆️ Bump eslint to V9 #1071
- ♿(frontend) improve accessibility:
  - ♿fix major accessibility issues reported by wave and axe #1344
  - ✨unify tab focus style for better visual consistency #1341
  - ✨improve modal a11y: structure, labels, and title #1349
  - ✨improve accessibility of cdoc content with correct aria tags #1271
  - ✨unify tab focus style for better visual consistency #1341
  - ♿hide decorative icons, label menus, avoid accessible name… #1362
- ♻️(tilt) use helm dev-backend chart
- 🩹(frontend) on main pages do not display leading emoji as page icon #1381
- 🩹(frontend) handle properly emojis in interlinking #1381

### Removed

- 🔥(frontend) remove multi column drop cursor #1370

### Fixed

- 🐛(frontend) fix callout emoji list #1366

## [v3.6.0] - 2025-09-04

### Added

- 👷(CI) add bundle size check job #1268
- ✨(frontend) use title first emoji as doc icon in tree #1289

### Changed

- ♻️(docs-app) Switch from Jest tests to Vitest #1269
- ♿(frontend) improve accessibility:
  - 🌐(frontend) set html lang attribute dynamically #1248
  - ♿(frontend) inject language attribute to pdf export #1235
  - ♿(frontend) improve accessibility of search modal #1275
  - ♿(frontend) add correct attributes to icons #1255
  - 🎨(frontend) improve nav structure #1262
  - ♿️(frontend) keyboard interaction with menu #1244
  - ♿(frontend) improve header accessibility #1270
  - ♿(frontend) improve accessibility for decorative images in editor #1282
  - #1338
  - #1281
- ♻️(backend) fallback to email identifier when no name #1298
- 🐛(backend) allow ASCII characters in user sub field #1295
- ⚡️(frontend) improve fallback width calculation #1333

### Fixed

- 🐛(makefile) Windows compatibility fix for Docker volume mounting #1263
- 🐛(minio) fix user permission error with Minio and Windows #1263
- 🐛(frontend) fix export when quote block and inline code #1319
- 🐛(frontend) fix base64 font #1324
- 🐛(backend) allow creator to delete subpages #1297
- 🐛(frontend) fix dnd conflict with tree and Blocknote #1328
- 🐛(frontend) fix display bug on homepage #1332
- 🐛link role update #1287

## [v3.5.0] - 2025-07-31

### Added

- ✨(helm) Service Account support for K8s Resources in Helm Charts #780
- ✨(backend) allow masking documents from the list view #1172
- ✨(frontend) subdocs can manage link reach #1190
- ✨(frontend) add duplicate action to doc tree #1175
- ✨(frontend) Interlinking doc #904
- ✨(frontend) add multi columns support for editor #1219

### Changed

- ♻️(frontend) search on all docs if no children #1184
- ♻️(frontend) redirect to doc after duplicate #1175
- 🔧(project) change env.d system by using local files #1200
- ⚡️(frontend) improve tree stability #1207
- ⚡️(frontend) improve accessibility #1232
- 🛂(frontend) block drag n drop when not desktop #1239

### Fixed

- 🐛(service-worker) Fix useOffline Maximum update depth exceeded #1196
- 🐛(frontend) fix empty left panel after deleting root doc #1197
- 🐛(helm) charts generate invalid YAML for collaboration API / WS #890
- 🐛(frontend) 401 redirection overridden #1214
- 🐛(frontend) include root parent in search #1243

## [v3.4.2] - 2025-07-18

### Changed

- ⚡️(docker) Optimize Dockerfile to use apk with --no-cache #743

### Fixed

- 🐛(backend) improve prompt to not use code blocks delimiter #1188

## [v3.4.1] - 2025-07-15

### Fixed

- 🌐(frontend) keep simple tag during export #1154
- 🐛(back) manage can-edit endpoint without created room
  in the ws #1152
- 🐛(frontend) fix action buttons not clickable #1162
- 🐛(frontend) fix crash share modal on grid options #1174
- 🐛(frontend) fix unfold subdocs not clickable at the bottom #1179

## [v3.4.0] - 2025-07-09

### Added

- ✨(frontend) multi-pages #701
- ✨(frontend) Duplicate a doc #1078
- ✨Ask for access #1081
- ✨(frontend) add customization for translations #857
- ✨(backend) add ancestors links definitions to document abilities #846
- ✨(backend) include ancestors accesses on document accesses list view #846
- ✨(backend) add ancestors links reach and role to document API #846
- 📝(project) add troubleshoot doc #1066
- 📝(project) add system-requirement doc #1066
- 🔧(frontend) configure x-frame-options to DENY in nginx conf #1084
- ✨(backend) allow to disable checking unsafe mimetype on
  attachment upload #1099
- ✨(doc) add documentation to install with compose #855
- ✨ Give priority to users connected to collaboration server
  (aka no websocket feature) #1093

### Changed

- ♻️(backend) stop requiring owner for non-root documents #846
- ♻️(backend) simplify roles by ranking them and return only the max role #846
- 📌(yjs) stop pinning node to minor version on yjs docker image #1005
- 🧑‍💻(docker) add .next to .dockerignore #1055
- 🧑‍💻(docker) handle frontend development images with docker compose #1033
- 🧑‍💻(docker) add y-provider config to development environment #1057
- ⚡️(frontend) optimize document fetch error handling #1089

### Fixed

- 🐛(backend) fix link definition select options linked to ancestors #846
- 🐛(frontend) table of content disappearing #982
- 🐛(frontend) fix multiple EmojiPicker #1012
- 🐛(frontend) fix meta title #1017
- 🔧(git) set LF line endings for all text files #1032
- 📝(docs) minor fixes to docs/env.md
- ✨support `_FILE` environment variables for secrets #912

### Removed

- 🔥(frontend) remove Beta from logo #1095

## [v3.3.0] - 2025-05-06

### Added

- ✨(backend) add endpoint checking media status #984
- ✨(backend) allow setting session cookie age via env var #977
- ✨(backend) allow theme customization using a configuration file #948
- ✨(frontend) Add a custom callout block to the editor #892
- 🚩(frontend) version MIT only #911
- ✨(backend) integrate malware_detection from django-lasuite #936
- 🏗️(frontend) Footer configurable #959
- 🩺(CI) add lint spell mistakes #954
- ✨(frontend) create generic theme #792
- 🛂(frontend) block edition to not connected users #945
- 🚸(frontend) Let loader during upload analyze #984
- 🚩(frontend) feature flag on blocking edition #997

### Changed

- 📝(frontend) Update documentation #949
- ✅(frontend) Improve tests coverage #949
- ⬆️(docker) upgrade backend image to python 3.13 #973
- ⬆️(docker) upgrade node images to alpine 3.21 #973

### Fixed

- 🐛(y-provider) increase JSON size limits for transcription conversion #989

### Removed

- 🔥(back) remove footer endpoint #948

## [v3.2.1] - 2025-05-06

## Fixed

- 🐛(frontend) fix list copy paste #943
- 📝(doc) update contributing policy (commit signatures are now mandatory) #895

## [v3.2.0] - 2025-05-05

## Added

- 🚸(backend) make document search on title accent-insensitive #874
- 🚩 add homepage feature flag #861
- 📝(doc) update contributing policy (commit signatures are now mandatory) #895
- ✨(settings) Allow configuring PKCE for the SSO #886
- 🌐(i18n) activate chinese and spanish languages #884
- 🔧(backend) allow overwriting the data directory #893
- ➕(backend) add `django-lasuite` dependency #839
- ✨(frontend) advanced table features #908

## Changed

- ⚡️(frontend) reduce unblocking time for config #867
- ♻️(frontend) bind UI with ability access #900
- ♻️(frontend) use built-in Quote block #908

## Fixed

- 🐛(nginx) fix 404 when accessing a doc #866
- 🔒️(drf) disable browsable HTML API renderer #919
- 🔒(frontend) enhance file download security #889
- 🐛(backend) race condition create doc #633
- 🐛(frontend) fix breaklines in custom blocks #908

## [v3.1.0] - 2025-04-07

## Added

- 🚩(backend) add feature flag for the footer #841
- 🔧(backend) add view to manage footer json #841
- ✨(frontend) add custom css style #771
- 🚩(frontend) conditionally render AI button only when feature is enabled #814

## Changed

- 🚨(frontend) block button when creating doc #749

## Fixed

- 🐛(back) validate document content in serializer #822
- 🐛(frontend) fix selection click past end of content #840

## [v3.0.0] - 2025-03-28

## Added

- 📄(legal) Require contributors to sign a DCO #779

## Changed

- ♻️(frontend) Integrate UI kit #783
- 🏗️(y-provider) manage auth in y-provider app #804

## Fixed

- 🐛(backend) compute ancestor_links in get_abilities if needed #725
- 🔒️(back) restrict access to document accesses #801

## [v2.6.0] - 2025-03-21

## Added

- 📝(doc) add publiccode.yml #770

## Changed

- 🚸(frontend) ctrl+k modal not when editor is focused #712

## Fixed

- 🐛(back) allow only images to be used with the cors-proxy #781
- 🐛(backend) stop returning inactive users on the list endpoint #636
- 🔒️(backend) require at least 5 characters to search for users #636
- 🔒️(back) throttle user list endpoint #636
- 🔒️(back) remove pagination and limit to 5 for user list endpoint #636

## [v2.5.0] - 2025-03-18

## Added

- 📝(doc) Added GNU Make link to README #750
- ✨(frontend) add pinning on doc detail #711
- 🚩(frontend) feature flag analytic on copy as html #649
- ✨(frontend) Custom block divider with export #698
- 🌐(i18n) activate dutch language #742
- ✨(frontend) add Beautify action to AI transform #478
- ✨(frontend) add Emojify action to AI transform #478

## Changed

- 🧑‍💻(frontend) change literal section open source #702
- ♻️(frontend) replace cors proxy for export #695
- 🚨(gitlint) Allow uppercase in commit messages #756
- ♻️(frontend) Improve AI translations #478

## Fixed

- 🐛(frontend) SVG export #706
- 🐛(frontend) remove scroll listener table content #688
- 🔒️(back) restrict access to favorite_list endpoint #690
- 🐛(backend) refactor to fix filtering on children
  and descendants views #695
- 🐛(action) fix notify-argocd workflow #713
- 🚨(helm) fix helmfile lint #736
- 🚚(frontend) redirect to 401 page when 401 error #759

## [v2.4.0] - 2025-03-06

## Added

- ✨(frontend) synchronize language-choice #401

## Changed

- Use sentry tags instead of extra scope

## Fixed

- 🐛(frontend) fix collaboration error #684

## [v2.3.0] - 2025-03-03

## Added

- ✨(backend) limit link reach/role select options depending on ancestors #645
- ✨(backend) add new "descendants" action to document API endpoint #645
- ✨(backend) new "tree" action on document detail endpoint #645
- ✨(backend) allow forcing page size within limits #645
- 💄(frontend) add error pages #643
- 🔒️ Manage unsafe attachments #663
- ✨(frontend) Custom block quote with export #646
- ✨(frontend) add open source section homepage #666
- ✨(frontend) synchronize language-choice #401

## Changed

- 🛂(frontend) Restore version visibility #629
- 📝(doc) minor README.md formatting and wording enhancements
- ♻️Stop setting a default title on doc creation #634
- ♻️(frontend) misc ui improvements #644

## Fixed

- 🐛(backend) allow any type of extensions for media download #671
- ♻️(frontend) improve table pdf rendering
- 🐛(email) invitation emails in receivers language

## [v2.2.0] - 2025-02-10

## Added

- 📝(doc) Add security.md and codeofconduct.md #604
- ✨(frontend) add home page #608
- ✨(frontend) cursor display on activity #609
- ✨(frontend) Add export page break #623

## Changed

- 🔧(backend) make AI feature reach configurable #628

## Fixed

- 🌐(CI) Fix email partially translated #616
- 🐛(frontend) fix cursor breakline #609
- 🐛(frontend) fix style pdf export #609

## [v2.1.0] - 2025-01-29

## Added

- ✨(backend) add duplicate action to the document API endpoint
- ⚗️(backend) add util to extract text from base64 yjs document
- ✨(backend) add soft delete and restore API endpoints to documents #516
- ✨(backend) allow organizing documents in a tree structure #516
- ✨(backend) add "excerpt" field to document list serializer #516
- ✨(backend) add github actions to manage Crowdin workflow #559 & #563
- 📈Integrate Posthog #540
- 🏷️(backend) add content-type to uploaded files #552
- ✨(frontend) export pdf docx front side #537

## Changed

- 💄(frontend) add abilities on doc row #581
- 💄(frontend) improve DocsGridItem responsive padding #582
- 🔧(backend) Bump maximum page size to 200 #516
- 📝(doc) Improve Read me #558

## Fixed

- 🐛Fix invitations #575

## Removed

- 🔥(backend) remove "content" field from list serializer # 516

## [v2.0.1] - 2025-01-17

## Fixed

-🐛(frontend) share modal is shown when you don't have the abilities #557
-🐛(frontend) title copy break app #564

## [v2.0.0] - 2025-01-13

## Added

- 🔧(backend) add option to configure list of essential OIDC claims #525 & #531
- 🔧(helm) add option to disable default tls setting by @dominikkaminski #519
- 💄(frontend) Add left panel #420
- 💄(frontend) add filtering to left panel #475
- ✨(frontend) new share modal ui #489
- ✨(frontend) add favorite feature #515
- 📝(documentation) Documentation about self-hosted installation #530
- ✨(helm) helm versioning #530

## Changed

- 🏗️(yjs-server) organize yjs server #528
- ♻️(frontend) better separation collaboration process #528
- 💄(frontend) updating the header and leftpanel for responsive #421
- 💄(frontend) update DocsGrid component #431
- 💄(frontend) update DocsGridOptions component #432
- 💄(frontend) update DocHeader ui #448
- 💄(frontend) update doc versioning ui #463
- 💄(frontend) update doc summary ui #473
- 📝(doc) update readme.md to match V2 changes #558 & #572

## Fixed

- 🐛(backend) fix create document via s2s if sub unknown but email found #543
- 🐛(frontend) hide search and create doc button if not authenticated #555
- 🐛(backend) race condition creation issue #556

## [v1.10.0] - 2024-12-17

## Added

- ✨(backend) add server-to-server API endpoint to create documents #467
- ✨(email) white brand email #412
- ✨(y-provider) create a markdown converter endpoint #488

## Changed

- ⚡️(docker) improve y-provider image #422

## Fixed

- ⚡️(e2e) reduce flakiness on e2e tests #511

## Fixed

- 🐛(frontend) update doc editor height #481
- 💄(frontend) add doc search #485

## [v1.9.0] - 2024-12-11

## Added

- ✨(backend) annotate number of accesses on documents in list view #429
- ✨(backend) allow users to mark/unmark documents as favorite #429

## Changed

- 🔒️(collaboration) increase collaboration access security #472
- 🔨(frontend) encapsulated title to its own component #474
- ⚡️(backend) optimize number of queries on document list view #429
- ♻️(frontend) stop to use provider with version #480
- 🚚(collaboration) change the websocket key name #480

## Fixed

- 🐛(frontend) fix initial content with collaboration #484
- 🐛(frontend) Fix hidden menu on Firefox #468
- 🐛(backend) fix sanitize problem IA #490

## [v1.8.2] - 2024-11-28

## Changed

- ♻️(SW) change strategy html caching #460

## [v1.8.1] - 2024-11-27

## Fixed

- 🐛(frontend) link not clickable and flickering firefox #457

## [v1.8.0] - 2024-11-25

## Added

- 🌐(backend) add German translation #259
- 🌐(frontend) add German translation #255
- ✨(frontend) add a broadcast store #387
- ✨(backend) whitelist pod's IP address #443
- ✨(backend) config endpoint #425
- ✨(frontend) config endpoint #424
- ✨(frontend) add sentry #424
- ✨(frontend) add crisp chatbot #450

## Changed

- 🚸(backend) improve users similarity search and sort results #391
- ♻️(frontend) simplify stores #402
- ✨(frontend) update $css Box props type to add styled components RuleSet #423
- ✅(CI) trivy continue on error #453

## Fixed

- 🔧(backend) fix logging for docker and make it configurable by envar #427
- 🦺(backend) add comma to sub regex #408
- 🐛(editor) collaborative user tag hidden when read only #385
- 🐛(frontend) users have view access when revoked #387
- 🐛(frontend) fix placeholder editable when double clicks #454

## [v1.7.0] - 2024-10-24

## Added

- 📝Contributing.md #352
- 🌐(frontend) add localization to editor #368
- ✨Public and restricted doc editable #357
- ✨(frontend) Add full name if available #380
- ✨(backend) Add view accesses ability #376

## Changed

- ♻️(frontend) list accesses if user has abilities #376
- ♻️(frontend) avoid documents indexing in search engine #372
- 👔(backend) doc restricted by default #388

## Fixed

- 🐛(backend) require right to manage document accesses to see invitations #369
- 🐛(i18n) same frontend and backend language using shared cookies #365
- 🐛(frontend) add default toolbar buttons #355
- 🐛(frontend) throttle error correctly display #378

## Removed

- 🔥(helm) remove infra related codes #366

## [v1.6.0] - 2024-10-17

## Added

- ✨AI to doc editor #250
- ✨(backend) allow uploading more types of attachments #309
- ✨(frontend) add buttons to copy document to clipboard as HTML/Markdown #318

## Changed

- ♻️(frontend) more multi theme friendly #325
- ♻️ Bootstrap frontend #257
- ♻️ Add username in email #314

## Fixed

- 🛂(backend) do not duplicate user when disabled
- 🐛(frontend) invalidate queries after removing user #336
- 🐛(backend) Fix dysfunctional permissions on document create #329
- 🐛(backend) fix nginx docker container #340
- 🐛(frontend) fix copy paste firefox #353

## [v1.5.1] - 2024-10-10

## Fixed

- 🐛(db) fix users duplicate #316

## [v1.5.0] - 2024-10-09

## Added

- ✨(backend) add name fields to the user synchronized with OIDC #301
- ✨(ci) add security scan #291
- ♻️(frontend) Add versions #277
- ✨(frontend) one-click document creation #275
- ✨(frontend) edit title inline #275
- 📱(frontend) mobile responsive #304
- 🌐(frontend) Update translation #308

## Changed

- 💄(frontend) error alert closeable on editor #284
- ♻️(backend) Change email content #283
- 🛂(frontend) viewers and editors can access share modal #302
- ♻️(frontend) remove footer on doc editor #313

## Fixed

- 🛂(frontend) match email if no existing user matches the sub
- 🐛(backend) gitlab oicd userinfo endpoint #232
- 🛂(frontend) redirect to the OIDC when private doc and unauthentified #292
- ♻️(backend) getting list of document versions available for a user #258
- 🔧(backend) fix configuration to avoid different ssl warning #297
- 🐛(frontend) fix editor break line not working #302

## [v1.4.0] - 2024-09-17

## Added

- ✨Add link public/authenticated/restricted access with read/editor roles #234
- ✨(frontend) add copy link button #235
- 🛂(frontend) access public docs without being logged #235

## Changed

- ♻️(backend) Allow null titles on documents for easier creation #234
- 🛂(backend) stop to list public doc to everyone #234
- 🚚(frontend) change visibility in share modal #235
- ⚡️(frontend) Improve summary #244

## Fixed

- 🐛(backend) Fix forcing ID when creating a document via API endpoint #234
- 🐛 Rebuild frontend dev container from makefile #248

## [v1.3.0] - 2024-09-05

## Added

- ✨Add image attachments with access control
- ✨(frontend) Upload image to a document #211
- ✨(frontend) Summary #223
- ✨(frontend) update meta title for docs page #231

## Changed

- 💄(frontend) code background darkened on editor #214
- 🔥(frontend) hide markdown button if not text #213

## Fixed

- 🐛 Fix emoticon in pdf export #225
- 🐛 Fix collaboration on document #226
- 🐛 (docker) Fix compatibility with mac #230

## Removed

- 🔥(frontend) remove saving modal #213

## [v1.2.1] - 2024-08-23

## Changed

- ♻️ Change ordering docs datagrid #195
- 🔥(helm) use scaleway email #194

## [v1.2.0] - 2024-08-22

## Added

- 🎨(frontend) better conversion editor to pdf #151
- ✨Export docx (word) #161
- 🌐Internationalize invitation email #167
- ✨(frontend) White branding #164
- ✨Email invitation when add user to doc #171
- ✨Invitation management #174

## Fixed

- 🐛(y-webrtc) fix prob connection #147
- ⚡️(frontend) improve select share stability #159
- 🐛(backend) enable SSL when sending email #165

## Changed

- 🎨(frontend) stop limit layout height to screen size #158
- ⚡️(CI) only e2e chrome mandatory #177

## Removed

- 🔥(helm) remove htaccess #181

## [v1.1.0] - 2024-07-15

## Added

- 🤡(demo) generate dummy documents on dev users #120
- ✨(frontend) create side modal component #134
- ✨(frontend) Doc grid actions (update / delete) #136
- ✨(frontend) Doc editor header information #137

## Changed

- ♻️(frontend) replace docs panel with docs grid #120
- ♻️(frontend) create a doc from a modal #132
- ♻️(frontend) manage members from the share modal #140

## [v1.0.0] - 2024-07-02

## Added

- 🛂(frontend) Manage the document's right (#75)
- ✨(frontend) Update document (#68)
- ✨(frontend) Remove document (#68)
- 🐳(docker) dockerize dev frontend (#63)
- 👔(backend) list users with email filtering (#79)
- ✨(frontend) add user to a document (#52)
- ✨(frontend) invite user to a document (#52)
- 🛂(frontend) manage members (update role / list / remove) (#81)
- ✨(frontend) offline mode (#88)
- 🌐(frontend) translate cgu (#83)
- ✨(service-worker) offline doc management (#94)
- ⚗️(frontend) Add beta tag on logo (#121)

## Changed

- ♻️(frontend) Change site from Impress to Docs (#76)
- ✨(frontend) Generate PDF from a modal (#68)
- 🔧(helm) sticky session by request_uri for signaling server (#78)
- ♻️(frontend) change logo (#84)
- ♻️(frontend) pdf has title doc (#84)
- ⚡️(e2e) unique login between tests (#80)
- ⚡️(CI) improve e2e job (#86)
- ♻️(frontend) improve the error and message info ui (#93)
- ✏️(frontend) change all occurrences of pad to doc (#99)

## Fixed

- 🐛(frontend) Fix the break line when generate PDF (#84)

## Delete

- 💚(CI) Remove trigger workflow on push tags on CI (#68)
- 🔥(frontend) Remove coming soon page (#121)

## [v0.1.0] - 2024-05-24

## Added

- ✨(frontend) Coming Soon page (#67)
- 🚀 Impress, project to manage your documents easily and collaboratively.

[unreleased]: https://github.com/suitenumerique/docs/compare/v4.8.6...main
[v4.8.6]: https://github.com/suitenumerique/docs/releases/v4.8.6
[v4.8.5]: https://github.com/suitenumerique/docs/releases/v4.8.5
[v4.8.4]: https://github.com/suitenumerique/docs/releases/v4.8.4
[v4.8.3]: https://github.com/suitenumerique/docs/releases/v4.8.3
[v4.8.2]: https://github.com/suitenumerique/docs/releases/v4.8.2
[v4.8.1]: https://github.com/suitenumerique/docs/releases/v4.8.1
[v4.8.0]: https://github.com/suitenumerique/docs/releases/v4.8.0
[v4.7.0]: https://github.com/suitenumerique/docs/releases/v4.7.0
[v4.6.0]: https://github.com/suitenumerique/docs/releases/v4.6.0
[v4.5.0]: https://github.com/suitenumerique/docs/releases/v4.5.0
[v4.4.0]: https://github.com/suitenumerique/docs/releases/v4.4.0
[v4.3.0]: https://github.com/suitenumerique/docs/releases/v4.3.0
[v4.2.0]: https://github.com/suitenumerique/docs/releases/v4.2.0
[v4.1.0]: https://github.com/suitenumerique/docs/releases/v4.1.0
[v4.0.0]: https://github.com/suitenumerique/docs/releases/v4.0.0
[v3.10.0]: https://github.com/suitenumerique/docs/releases/v3.10.0
[v3.9.0]: https://github.com/suitenumerique/docs/releases/v3.9.0
[v3.8.2]: https://github.com/suitenumerique/docs/releases/v3.8.2
[v3.8.1]: https://github.com/suitenumerique/docs/releases/v3.8.1
[v3.8.0]: https://github.com/suitenumerique/docs/releases/v3.8.0
[v3.7.0]: https://github.com/suitenumerique/docs/releases/v3.7.0
[v3.6.0]: https://github.com/suitenumerique/docs/releases/v3.6.0
[v3.5.0]: https://github.com/suitenumerique/docs/releases/v3.5.0
[v3.4.2]: https://github.com/suitenumerique/docs/releases/v3.4.2
[v3.4.1]: https://github.com/suitenumerique/docs/releases/v3.4.1
[v3.4.0]: https://github.com/suitenumerique/docs/releases/v3.4.0
[v3.3.0]: https://github.com/suitenumerique/docs/releases/v3.3.0
[v3.2.1]: https://github.com/suitenumerique/docs/releases/v3.2.1
[v3.2.0]: https://github.com/suitenumerique/docs/releases/v3.2.0
[v3.1.0]: https://github.com/suitenumerique/docs/releases/v3.1.0
[v3.0.0]: https://github.com/suitenumerique/docs/releases/v3.0.0
[v2.6.0]: https://github.com/suitenumerique/docs/releases/v2.6.0
[v2.5.0]: https://github.com/suitenumerique/docs/releases/v2.5.0
[v2.4.0]: https://github.com/suitenumerique/docs/releases/v2.4.0
[v2.3.0]: https://github.com/suitenumerique/docs/releases/v2.3.0
[v2.2.0]: https://github.com/suitenumerique/docs/releases/v2.2.0
[v2.1.0]: https://github.com/suitenumerique/docs/releases/v2.1.0
[v2.0.1]: https://github.com/suitenumerique/docs/releases/v2.0.1
[v2.0.0]: https://github.com/suitenumerique/docs/releases/v2.0.0
[v1.10.0]: https://github.com/suitenumerique/docs/releases/v1.10.0
[v1.9.0]: https://github.com/suitenumerique/docs/releases/v1.9.0
[v1.8.2]: https://github.com/suitenumerique/docs/releases/v1.8.2
[v1.8.1]: https://github.com/suitenumerique/docs/releases/v1.8.1
[v1.8.0]: https://github.com/suitenumerique/docs/releases/v1.8.0
[v1.7.0]: https://github.com/suitenumerique/docs/releases/v1.7.0
[v1.6.0]: https://github.com/suitenumerique/docs/releases/v1.6.0
[v1.5.1]: https://github.com/suitenumerique/docs/releases/v1.5.1
[v1.5.0]: https://github.com/suitenumerique/docs/releases/v1.5.0
[v1.4.0]: https://github.com/suitenumerique/docs/releases/v1.4.0
[v1.3.0]: https://github.com/suitenumerique/docs/releases/v1.3.0
[v1.2.1]: https://github.com/suitenumerique/docs/releases/v1.2.1
[v1.2.0]: https://github.com/suitenumerique/docs/releases/v1.2.0
[v1.1.0]: https://github.com/suitenumerique/docs/releases/v1.1.0
[v1.0.0]: https://github.com/suitenumerique/docs/releases/v1.0.0
[v0.1.0]: https://github.com/suitenumerique/docs/releases/v0.1.0
