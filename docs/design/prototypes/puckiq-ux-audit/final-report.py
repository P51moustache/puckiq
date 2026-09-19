from pathlib import Path
import json,csv
b=Path(__file__).parent;d=json.loads((b/'audit.json').read_text());e=d['evidence']
url='https://design.penpot.app/#/workspace?team-id=c514c1fb-1cda-8125-8008-a13ef69bae1f&file-id=d8ac01df-6646-81d2-8008-a14503e28fce&page-id=85d394a9-7232-5dcd-b0ba-0c2a2709c84c'
view='https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a14503e28fce&page-id=20cecc8d-0359-5055-861f-cf534493f05d&section=interactions&frame-id=847edb16-7283-5f69-9b51-65585f9cb541&index=105'
md=f'''# PuckIQ — Arena Club UX audit and prototype

[Open the Penpot file]({url}) · [Start the prototype]({view})

Created in Penpot following the requested platform switch. Seven pages separate current evidence, proposed behavior, clickable scenarios and implementation handoff. No Figma artifact was created.

Evidence captured {e['timestamp']}; commit `{e['commit']}`; branch `{e['branch']}`. The current dirty checkout was inspected read-only. Full source fingerprints and captured git status are in evidence.json. App code, git state, credentials, native projects and production data were not changed.

## Coverage matrix

| Item | Mapped / created | Verification | Remaining work |
|---|---:|---|---|
| Route files | 9 + 2 layouts | Source inspected | Native/platform walkthrough |
| Current surface groups | 28 / 28 | Source inspected, mapped | Faithful visual coverage of every conditional surface |
| Shared state patterns | 19 | Named screen inheritance | Rendered combinations and native gestures |
| JSX interaction sites | 281 | Extracted callbacks, source IDs, outcomes or exclusions | Full per-control/per-state semantics; normalize native dialogs and generated controls |
| Route-reachable sites | 158 | Conservative import graph | Import reachability does not prove each export renders |
| Other sites | 123 | Legacy/infrastructure exclusion recorded | Reconcile any dynamic runtime entry points |
| Findings | 20 | Source-grounded | Reproduce in current bundle |
| Proposed states | 53 definitions / 106 team variants | Native Penpot links; sampled traversal | Preset inputs, model drafts and store selection are not fully interactive |
| Usability tasks | 11 | Scripts supplied | Participant sessions not performed |
| App controls runtime-verified | 0 | One read-only iOS paywall observation only | Android, accessibility, native sheets, text scaling, narrow layouts |

The audit is broad, but **not a certification that every rendered control and state has been fully validated**. Raw JSX counts include callback bindings, exits and repeated entity templates. Read individual status and exclusion fields before treating an item as active functionality.

## Prototype verification

- The native seven-page archive imported successfully. Text shaping was corrected and visually checked with Teko and DM Sans.
- 1,206 reaction bindings resolve to valid destinations or previous-screen actions. Bounds checks passed. These include separate text/hit-area reactions, so the count is not unique buttons.
- Walked first launch, Edmonton selection, forecast context, save/result, remove/undo, player search/watchlist/return, Boston home switch, team comparison/back stack, AI provenance, model draft cancel/keep/save, simulated sign-in, purchase cancellation, restore/no entitlement, unavailable alerts, offseason subscription access, failed restore/retry and failed save/retry.
- The walkthrough caught misleading account and selected-plan labels; final labels identify scenario context and the example monthly plan.
- All consequential outcomes are simulated. Search uses one example query/result; model weights are a preset draft; only Boston and Edmonton demonstrate home identity. App account, store and storage state are not continuously simulated.
- Penpot viewer caveat: switching flows occasionally hid body text until the viewer was reloaded at the destination frame. Direct launch and normal onboarding button transitions were visually verified. Use the supplied launch link if a flow switch renders blank.
- Failure starting points are in the viewer's flow menu. Page 03 contains further shared-state specifications. Future permission-denial support is backend-blocked.
- Reviewed 414px boards. Responsive 320–375px implementation, Dynamic Type, VoiceOver/TalkBack and reduced-motion settings remain untested. No participant usability testing occurred.

## Prioritized findings

'''
for f in d['findings']:
 md+=f"### {f['id']} · {f['priority']} · {f['title']}\n\n{f['evidence']}\n\nSource: {f['source']}. Surfaces: {', '.join(f['screens'])}.\n\nRecommendation: {f['recommendation']}\n\nAcceptance: {f['acceptance']}\n\n"
md+='''## Implementation order

1. Fix search lifecycle and arbitrary-player watchlist journeys, including write failure feedback.
2. Separate AI provenance from personal models; protect saved forecast/result truth and deletion recovery.
3. Normalize return origins, draft guards, authentication feedback and fetch/store recovery.
4. Reconcile Pro gates and claims, supply Support, then align secondary screens with Arena Club.
5. Validate native platforms and accessibility before enabling backend-dependent alerts or expanding account sync.

## Product decisions

- Which features are truly Pro-only?
- Should My Team become discoverable or be retired?
- Should local data remain device-wide, or move to account-scoped storage through an explicit migration?
- What is the verified Support destination?
- What source-age policy and backend-readiness checks govern forecasts and alerts?

## Usability task scripts

Use 5–8 representative fans, including fantasy and non-fantasy users. Ask them to think aloud. Record first click, completion, backtracks and interpretation of data freshness. Do not explain where a control is. Start each task using its named flow.

'''
for j in d['journeys']:md+=f"- **{j['id']} {j['name']}** — {j['task']} Success: {j['success']}\n"
md+='\n## Current surfaces\n\n'
for s in d['screens']:md+=f"### {s['id']} {s['name']}\n\nEntry: {s['entry']}\n\nControls: {s['controls']}\n\nCurrent: {s['behavior']}\n\nExit: {s['exit']}\n\nSource: {s['source']}. Status: {s['status']}\n\n"
md+='\n## State inheritance\n\n'
for p in d['patterns']:md+=f"- **{p['id']} {p['name']}** — {', '.join(p['inherits'])}. {p['detail']}\n"
(b/'AUDIT.md').write_text(md)
d['penpot']={'file':url,'prototype':view,'status':'created; critical paths traversed; broader runtime coverage incomplete'}
(b/'audit.json').write_text(json.dumps(d,indent=2))
with (b/'control-inventory.csv').open('w') as out:
 writer=csv.DictWriter(out,fieldnames=['id','file','line','screens','tag','label','classification','mappedOutcome','patterns','sharedExit','reachability','status','exclusion']);writer.writeheader()
 for c in d['controls']:writer.writerow({k:('; '.join(c.get(k,[])) if isinstance(c.get(k),list) else c.get(k,'')) for k in writer.fieldnames})
(b/'deliverable-links.json').write_text(json.dumps(d['penpot'],indent=2));print('Updated report, control CSV and verified file link.')
