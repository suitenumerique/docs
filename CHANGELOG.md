# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## Added

- 💄(frontend) add error pages #643
- ✨(frontend) synchronize language-choice #401

## Changed

- 🛂(frontend) Restore version visibility #629
- 📝(doc) minor README.md formatting and wording enhancements
- ♻️Stop setting a default title on doc creation #634
- ♻️(frontend) misc ui improvements #644

## Fixed

- ♻️(frontend) improve table pdf rendering
- 🐛(email) invitation emails in receivers language

## [2.2.0] - 2025-02-10

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

## [2.1.0] - 2025-01-29

## Added

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

## [2.0.1] - 2025-01-17

## Fixed

-🐛(frontend) share modal is shown when you don't have the abilities #557
-🐛(frontend) title copy break app #564

## [2.0.0] - 2025-01-13

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

## [1.10.0] - 2024-12-17

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

## [1.9.0] - 2024-12-11

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

## [1.8.2] - 2024-11-28

## Changed

- ♻️(SW) change strategy html caching #460

## [1.8.1] - 2024-11-27

## Fixed

- 🐛(frontend) link not clickable and flickering firefox #457

## [1.8.0] - 2024-11-25

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

## [1.7.0] - 2024-10-24

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

## [1.6.0] - 2024-10-17

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

## [1.5.1] - 2024-10-10

## Fixed

- 🐛(db) fix users duplicate #316

## [1.5.0] - 2024-10-09

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

## [1.4.0] - 2024-09-17

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

## [1.3.0] - 2024-09-05

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

## [1.2.1] - 2024-08-23

## Changed

- ♻️ Change ordering docs datagrid #195
- 🔥(helm) use scaleway email #194

## [1.2.0] - 2024-08-22

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

## [1.1.0] - 2024-07-15

## Added

- 🤡(demo) generate dummy documents on dev users #120
- ✨(frontend) create side modal component #134
- ✨(frontend) Doc grid actions (update / delete) #136
- ✨(frontend) Doc editor header information #137

## Changed

- ♻️(frontend) replace docs panel with docs grid #120
- ♻️(frontend) create a doc from a modal #132
- ♻️(frontend) manage members from the share modal #140

## [1.0.0] - 2024-07-02

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
- ✏️(frontend) change all occurences of pad to doc (#99)

## Fixed

- 🐛(frontend) Fix the break line when generate PDF (#84)

## Delete

- 💚(CI) Remove trigger workflow on push tags on CI (#68)
- 🔥(frontend) Remove coming soon page (#121)

## [0.1.0] - 2024-05-24

## Added

- ✨(frontend) Coming Soon page (#67)
- 🚀 Impress, project to manage your documents easily and collaboratively.

[unreleased]: https://github.com/numerique-gouv/impress/compare/v2.2.0...main
[v2.2.0]: https://github.com/numerique-gouv/impress/releases/v2.2.0
[v2.1.0]: https://github.com/numerique-gouv/impress/releases/v2.1.0
[v2.0.1]: https://github.com/numerique-gouv/impress/releases/v2.0.1
[v2.0.0]: https://github.com/numerique-gouv/impress/releases/v2.0.0
[v1.10.0]: https://github.com/numerique-gouv/impress/releases/v1.10.0
[v1.9.0]: https://github.com/numerique-gouv/impress/releases/v1.9.0
[v1.8.2]: https://github.com/numerique-gouv/impress/releases/v1.8.2
[v1.8.1]: https://github.com/numerique-gouv/impress/releases/v1.8.1
[v1.8.0]: https://github.com/numerique-gouv/impress/releases/v1.8.0
[v1.7.0]: https://github.com/numerique-gouv/impress/releases/v1.7.0
[v1.6.0]: https://github.com/numerique-gouv/impress/releases/v1.6.0
[1.5.1]: https://github.com/numerique-gouv/impress/releases/v1.5.1
[1.5.0]: https://github.com/numerique-gouv/impress/releases/v1.5.0
[1.4.0]: https://github.com/numerique-gouv/impress/releases/v1.4.0
[1.3.0]: https://github.com/numerique-gouv/impress/releases/v1.3.0
[1.2.1]: https://github.com/numerique-gouv/impress/releases/v1.2.1
[1.2.0]: https://github.com/numerique-gouv/impress/releases/v1.2.0
[1.1.0]: https://github.com/numerique-gouv/impress/releases/v1.1.0
[1.0.0]: https://github.com/numerique-gouv/impress/releases/v1.0.0
[0.1.0]: https://github.com/numerique-gouv/impress/releases/v0.1.0
