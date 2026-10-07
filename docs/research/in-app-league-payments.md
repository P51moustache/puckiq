# In-app league groups, dues and hosted leagues: research and recommendation

*Researched 2026-09-26 for PuckIQ 3.x. This is not legal advice. Every "must" below is what the sources say or what big operators do. A gaming/payments lawyer has to confirm it before any money moves.*

---

## Bottom line: not yet on money, yes on groups

**Not yet** for moving money or hosting paid leagues. **Yes, now** for free private groups with dues *tracking*. Holding or routing members' dues would likely make PuckIQ a money transmitter, which needs state licences that cost six figures, unless a licensed partner holds the money. Stripe explicitly bans "fantasy sports leagues with a monetary or material prize" and "peer-to-peer money transmission". PayPal and Venmo ban entry-fee-and-prize payments unless you are an approved merchant. Once PuckIQ collects dues for contests it also hosts, it becomes a fantasy *operator*. Operators need registration or licensing in about 25 states, geolocation, age checks and 1099s, and cannot serve roughly 10–12 states at all. Apple then requires licensing, geo-restriction, an organisation (not individual) developer account and in practice an 18+ rating. Even Sleeper, with about $200M raised and licensed paid contests in about 31 states, spent about nine years hosting leagues before it held dues (SleeperSafe, August 2026). The part that is cheap, legal and strategic is getting the *whole league* into PuckIQ: a group, a dues ledger and a "hold the pot with LeagueSafe" link. Any later phase depends on that network, and it can ship in 2–3 weeks with no money risk.

---

## Phased roadmap (lowest risk first)

| Phase | What users get | Money touched by PuckIQ? | Legal / App Store bar | Build (solo + AI) | Cash cost | Verdict |
|---|---|---|---|---|---|---|
| **A. Free private groups + dues tracking** | League group, invite link, "who has paid", reminders, payout plan, settle-up summary | **No** | Normal app rules; UGC rules (Guideline 1.2) if you add chat | **2–3 weeks** | ~$0 (existing Supabase + push) | **Do now** |
| **B. Partner-held dues** | "Hold the pot" through LeagueSafe (or similar), with status shown in PuckIQ | **No** (partner holds it) | Partner's terms; lawyer sanity check; keep it a link-out | **2–5 days** (link-out) / 3–6 weeks + deal time (embedded) | ~$0–low; LLC recommended | **Next, if A gets traction** |
| **C. On-platform free leagues** | Draft, rosters, waivers, trades, scoring, matchups hosted in PuckIQ | **No** | NHL data terms risk; content/UGC rules | **MVP 10–16 weeks; parity 6–12 months** | Hosting tens of $/mo; licensed data feed ~$5k–$30k/yr (rough) | **Maybe for 2027–28 season, gated on A** |
| **D. Paid leagues (PuckIQ collects dues and/or takes a fee)** | Pay dues in-app, automatic payouts | **Yes** | State operator licensing, geo-fencing, KYC/age, licensed payments partner, 1099s, possibly money-transmitter licences; Apple 5.3.4 + org account | **3–6 months build + 6–12+ months licensing** | **$50k–$250k+ first year** (rough) | **No, for a solo founder** |

### Phase A: free private groups + dues tracking (no money held)
- **Users get:** create a group for "my Yahoo/ESPN/Fantrax league", invite by link, set dues (amount, deadline), tick off who has paid, auto-reminders, a payout plan ("1st $300 / 2nd $120"), and an end-of-season "who owes whom" summary. Add PuckIQ hooks such as a weekly group digest and "your league's best pickups", so the group is also a growth loop for the coach.
- **Legal:** No money moves, so no money-transmitter, operator or UIGEA question. Sleeper shipped exactly this ("tool is only for tracking. All money exchanges should be handled elsewhere", July 2025). Keep it payment-method neutral: "mark paid" instead of prefilled Venmo or PayPal requests. Venmo and PayPal ban entry-fee-and-prize payments, and users have had funds frozen (Chris Moneymaker, $12k, 2022).
- **App Store:** No 5.3 trigger, because PuckIQ offers no real-money gaming. If you add group chat or comments, Guideline 1.2 applies: filter, report, block and a contact method. Apple clarified in February 2026 that chat features fall under 1.2.
- **Effort:** 2–3 weeks. Supabase tables for groups, members, invites and dues entries; RLS; invite deep link; push reminders; one Group screen.
- **Risks:** Low. The main risk is low adoption, because it only works if several league-mates install PuckIQ.

### Phase B: partner-held dues (escrow via a third party)
- **Users get:** A "Hold the pot with LeagueSafe" button. The commissioner pastes their LeagueSafe join link (`leaguesafe.com/join/<id>`) and PuckIQ shows it to members. Payment status stays manual, or pulls from the partner if a deal gives you data.
- **Who could hold the money:**
  - **LeagueSafe** (SportsHub): 18+, US and Canada, free by e-check, card 4.5% + $0.10, payouts $3–$5, payouts released by league vote. It has no public API that I could find; the only platform integration is MyFantasyLeague. Partnerships go through partners@leaguesafe.com.
  - **Fantrax Treasurer:** free, 100% paid out, "FDIC insured banks". This comes from search snippets only because the page is JS-rendered, so verify it.
  - **LeagueSwype:** small, founded 2016, about $120k raised; fees and payment partner are not published.
- **Legal:** PuckIQ never touches funds, which is the key line. Still have a lawyer confirm that linking and displaying status doesn't make you an "agent". Don't take referral fees per dollar of dues without advice, because that looks like a rake.
- **App Store:** A plain link-out to a third party is the lowest-risk version. An embedded payment flow inside PuckIQ could draw 5.3 scrutiny.
- **Effort:** Link-out is 2–5 days. An embedded integration is 3–6 weeks plus however long a partnership takes (unknown).
- **Risks:** The partner changes terms. Users blame PuckIQ for partner problems. LeagueSafe's own model has members "irrevocably" assign title to funds to LeagueSafe Management, LLC, and a chargeback freezes the whole league's funds. Users should understand this.

### Phase C: on-platform free leagues (PuckIQ hosts, no money)
- **Users get:** a full league inside PuckIQ, with the coach built in.
- **Minimum scope:**
  - League settings: points *or* H2H categories, roster slots, games-played caps
  - Invites
  - Live snake draft room with timers and autopick (Supabase Realtime)
  - Player pool and eligibility
  - Lineup locks at puck drop
  - Adds and drops with waivers (rolling priority first, FAAB later)
  - Trades with commissioner veto
  - Scoring engine with stat corrections
  - Schedule, standings and playoffs
  - Commissioner overrides
  - Notifications
  - Live scoring from game boxscores
- **Effort:** A points-league MVP is about 10–16 weeks. Parity with Yahoo/Fantrax hockey (categories and roto, keepers and dynasty, IR, GP limits, FAAB, league history, import from other platforms) is 6–12 months, and in-season support is heavy. For comparison, Sleeper's founders took about 2–3 years with VC funding (2014/15 to full leagues in 2017).
- **Timing:** Hockey drafts happen late September to early October, so the 2026–27 window is closing now. Realistic options are a pilot of free playoff pools in spring 2027 and full leagues for the 2027–28 draft season (August–September 2027).
- **Data:** see the "Hosting leagues" section below. The NHL's terms of service say NHL.com is for "non-commercial, informational, personal use". A hosted league makes that dependency mission-critical.
- **Risks:**
  - A scoring bug is a trust bug.
  - A league only switches if the commissioner moves everyone.
  - It competes with the Yahoo/ESPN/Fantrax leagues your coach imports from, which could muddy the "works with your league" pitch.

### Phase D: paid leagues (PuckIQ collects and pays out)
- **Users get:** pay dues in-app, automatic payouts, no commissioner holding cash. This is SleeperSafe or Yahoo Private Prize Leagues.
- **Required (at minimum):**
  - A legal entity and an **Apple organisation account** (5.1.1(ix)).
  - Counsel.
  - **State operator registration or licensing** or geo-exclusion (table below).
  - **Geolocation** at entry (5.3.4 "must be geo-restricted").
  - **Age and identity checks:** 18+, 19 in AL/NE, 21 in AZ, IA, LA, MA, VA and possibly IL.
  - **Segregated player funds.**
  - A **licensed payments partner** that accepts fantasy. Stripe won't. Aeropay and similar gaming processors serve licensed operators.
  - **1099s** for winners.
  - Responsible-gaming tooling.
  - A money-transmission analysis, or a partner who holds the funds.
- **Effort and cost:** 3–6 months of engineering plus 6–12+ months of licensing. Rough first-year cost is $50k–$250k+: legal work, licence fees (Connecticut alone lists $250,000 initial, per the Velawood tracker), geolocation and KYC vendors, and payments.
- **Risks:** criminal or regulatory exposure in the wrong state, chargebacks, collusion and fraud disputes, payment-account termination, App Review delays. **Not a solo-founder project.** If ever, do it through a partner that is the operator and holds the money.

---

## 1. Legality in the US

**UIGEA (31 U.S.C. §5362(1)(E)(ix))** excludes fantasy contests from "bet or wager" only if **all** of these hold:
- Prizes are "established and made known to the participants in advance" and their value is "not determined by the number of participants or the amount of any fees paid".
- Outcomes reflect skill and come from accumulated stats of individual athletes across **multiple real-world events**.
- Outcomes are not based on a single team's score or point spread, or on one athlete's single performance.

Caveats:
- **UIGEA legalises nothing.** It is a payments-enforcement law and says it doesn't alter any state law (§5361(b)). State law decides.
- **A pot built from dues fits awkwardly** with the "not determined by … fees paid" condition. Operators handle this by fixing the payout before the season: Yahoo marks prizes at registration, and LeagueSafe has the commissioner set payouts up front. **Flag for lawyer.**
- **Weekly H2H matchups are still "multiple events".** Each week spans several games. DFS-style single-game formats would not qualify.

**Tracking vs holding vs hosting vs taking a cut.** The law treats each step differently.
- **Tracking only (Phase A):** no entry fee is paid *to* PuckIQ. New York defines an entry fee as money "paid by an authorized player to an operator", so PuckIQ is neither an operator nor a transmitter.
- **Holding dues without running the contest (LeagueSafe's position):** LeagueSafe says it is "legal in all 50 states because they do not administer and run your private contests". It still limits users to 18+ in the US and Canada and makes them responsible for local law. The money-transmitter question is separate (section 2).
- **Hosting the contest *and* collecting fees:** this makes you an operator. Yahoo Private Prize Leagues show the operator posture: a 2% management fee, funds "held by Yahoo in … segregated accounts", 1099s and excluded states.
- **Taking a cut is the bright line.** Texas AG opinion KP-0057 (2016) says private season-long leagues likely fall under the social-gambling defense when no one gets "economic benefit other than personal winnings". Sites that take a cut are likely illegal. Ohio's fantasy law exempts a "pool not conducted for profit", meaning all money is paid out.
- **Case law:** *Humphrey v. Viacom* (D.N.J. 2007) held that season-long entry fees paid unconditionally for a fixed, guaranteed prize are not bets. That is helpful but old and limited to one state.

**Age limits:** 18 in most states; 19 in AL and NE; 21 in AZ and MA (Yahoo). Various sources add 21 in IA, LA and VA (Velawood, Sleeper) and IL (SportsHub). Plan for the strictest list.

**California:** the AG's July 2025 opinion (No. 23-1001) says DFS of all kinds is illegal. It "seemingly" does not reach season-long leagues. Treat California as elevated risk for anything PuckIQ operates for money.

**Canada, briefly:**
- The Criminal Code treats games of *mixed* chance and skill as gambling (s.206). Only provinces may run gaming (s.207).
- Ontario (AGCO/iGaming Ontario) treats pay-to-play fantasy as gaming that needs registration.
- Friends betting each other is fine: s.204(1)(b) exempts "a private bet between individuals not engaged in any way in the business of betting". A company in the middle is arguably "in the business".
- Yahoo excludes Ontario and Quebec; SportsHub excludes Ontario; Sleeper Picks excludes Alberta and Ontario. LeagueSafe accepts Canadians, card-in and cheque-out only.
- Since hockey skews Canadian, a paid product would lose part of the core audience.

### State table: paid season-long leagues run by a platform

The "Yahoo" and "SportsHub" columns show where two real season-long operators refuse to offer paid leagues. They are the best practical signal.

| Jurisdiction | Status for a platform running paid season-long leagues | Min age | Yahoo prize leagues | SportsHub SLFS | Notes |
|---|---|---|---|---|---|
| **Washington** | Illegal gambling (RCW 9.46.0237; WSGC: fantasy for money not authorised) | — | Excluded | Excluded | Felony exposure; even DFS giants stay out |
| **Montana** | Statute: "unlawful to wager on a fantasy sports league by telephone or by the internet" (MCA 23-5-802) | — | Excluded | Excluded | In-person leagues are legal; online is not |
| **Hawaii** | AG (2016): DFS is illegal gambling | — | Excluded | Allowed | Treat as off |
| **Idaho** | AG (2016) against DFS | — | Excluded | Allowed | Treat as off |
| **Nevada** | Gaming licence required | — | Excluded | Allowed | Treat as off |
| **Connecticut** | Licensed operators only (2021 law; $250k initial fee) | 18 | Excluded | Excluded | Off |
| **Michigan** | Licence required (MGCB) | 18 | Excluded | Excluded | Off unless licensed |
| **Iowa** | Licence required | 21 | Excluded | Excluded | Off unless licensed |
| **Louisiana** | Licence plus parish-by-parish approval | 21 | Excluded | Excluded | Off |
| **Maine** | Registration or licence | 18 | Excluded | Excluded | Off unless registered |
| **Delaware** | Licence ($50k/yr) | 18 | Allowed | Excluded | Licensing |
| **Vermont** | Registration ($5k/yr) | 18 | Allowed | Excluded | Licensing |
| **Missouri** | Licence required | 18 | **Excluded for season-long prize leagues** (not DFS) | Allowed | Reason unclear. **Ask counsel** |
| **Arizona** | Licence (2021 Event Wagering Act); tribal lands excluded | 21 | Tribal lands excluded | Tribal lands excluded | 21+ |
| **New York** | Any operator making a fantasy platform available must register (PML §1402) | 18 | Allowed | Allowed | IFS law upheld by NY Court of Appeals (*White v. Cuomo*, 2022) |
| **Massachusetts** | Regulated | 21 | Allowed | Allowed | 21+ |
| **Virginia** | Permit from Virginia Lottery (new 2026 chapter, Title 58.1 ch. 42) | 21 | Allowed | Allowed | 21+ |
| **Alabama / Nebraska** | AL licensed; NE unregulated | 19 | Allowed | Allowed | 19+ |
| **Ohio** | Licence for contests "to the general public"; **exempts pools where all money is paid out** | 18 | Allowed | Allowed | Taking a cut changes the answer |
| **Colorado** | Free registration under 7,500 players; licence above that | 18 | Allowed | Allowed | Small-operator path exists |
| **Texas** | No fantasy law; AG says a no-rake private league is likely OK and a site taking a cut is likely illegal | 18 | Allowed | Allowed | Rake is the problem |
| **California** | AG 2025: DFS illegal; season-long not addressed | 18 | Allowed | Allowed | Elevated risk |
| **Other regulated** (AR, IN, KS, MD, MS, NH, NJ, PA, TN, WV, WY, DC) | Registration or licence, or light regulation; fees from $0 to $85k | 18 (PA 21 in casinos) | Allowed | Allowed | Per-state filings |
| **Unregulated but allowed** (AK, FL, GA, IL, KY, MN, NM, NC, ND, OK, OR, RI, SC, SD, UT, WI; NE is in the 19+ row) | No fantasy statute | 18 (IL 21 per SportsHub) | Allowed | Allowed | General gambling law still applies |
| **Ontario** | iGaming Ontario / AGCO registration | 19 | Excluded | Excluded | Paid fantasy is regulated gaming |
| **Quebec** | Loto-Québec monopoly | 18 | Excluded | — | Off |

Sources: Yahoo Paid Fantasy ToS (updated 2026-04-13); SportsHub terms (2026-08-27); Velawood tracker (2026-02-12); the statutes and AG opinions listed at the end. Licence fees come from the Velawood tracker and are approximate. **The exact registration triggers for season-long private leagues differ by state. This table is a starting map, not an answer.**

---

## 2. Money movement

**Money transmitter risk.**
- FinCEN defines a money transmitter as anyone who accepts "funds … from one person and transmission to another location or person by any means" (31 CFR 1010.100(ff)(5)). Taking dues from 12 people and paying 3 winners fits that description on its face.
- **Two exemptions exist**, and neither clearly fits:
  - The "payment processor" exemption: acting for a seller of goods or services under an agreement with that seller.
  - Funds "integral to the sale of goods or the provision of services".
- FinCEN's 2014 escrow ruling (FIN-2014-R004) rejected an escrow-style payments platform's claim to the "integral" exemption.
- The "integral to a service" argument only works if PuckIQ *is* the contest service, and that makes it an operator (section 1).
- **Penalty:** operating without a required state licence or FinCEN registration is a federal crime (18 U.S.C. §1960, up to 5 years).
- **State licences:** 31 states have enacted the CSBS Money Transmission Modernization Act (CSBS, as of 2026-09-03). A 50-state build-out is commonly quoted at $150k–$400k+ plus surety bonds and net-worth minimums, and takes 12–24 months (secondary source).
- **Conclusion:** a solo founder should never hold member funds. Use tracking only, or a partner that holds the money.

**Payment providers:**

| Provider | Fantasy with prizes? | Peer-to-peer? | Notes |
|---|---|---|---|
| **Stripe / Stripe Connect** | **Prohibited**: "fantasy sports leagues with a monetary or material prize" and "payments of an entry or player fee that promise … a prize" | **Prohibited**: "Peer-to-peer money transmission" | Escrow and money transmitters are "restricted" and need sales approval. Page updated 2026-09-22 |
| **PayPal / Venmo** | Prohibited unless an **approved merchant**: "any activity with an entry fee and a prize, regardless of whether … chance or skill" | Personal payments for this are also barred | Real freezes of league pots (Moneymaker $12k, 2022). Venmo Groups (2023) splits expenses but doesn't change the policy |
| **Dwolla** | Terms bar "illegal gambling"; fantasy not named | ACH platform | Would still need use-case approval (**unverified**) |
| **Aeropay** | Built for gaming: DFS, sweepstakes, lotteries; customers include PrizePicks | Pay-by-bank deposits and withdrawals | Serves licensed operators. SleeperSafe's bank option runs on Aeropay |
| **LeagueSafe / Fantrax Treasurer / LeagueSwype** | Built for dues | They hold the funds | The only partner route that keeps PuckIQ out of the money |

**KYC, AML and fraud.**
- Operators verify age, identity and location. Yahoo can demand an "Affidavit of Eligibility", and Sleeper geolocates paid entries.
- Plan for a KYC vendor, typically priced per check, and a geolocation vendor such as GeoComply (pricing not public).
- Collusion and tanking disputes become money disputes.

**Chargebacks and refunds.**
- LeagueSafe allows refunds any time before the league deadline, and after that only with the commissioner. A chargeback lets it "freeze all Funds of that League", and members bear the loss.
- SleeperSafe gives no individual refunds after the deadline in public leagues. For returned bank transfers, its rules say "Aeropay retains 25%" of the returned amount.

**Taxes.**
- The operator that pays prizes issues 1099s. Yahoo: "Each winner may receive an IRS Form 1099". SportsHub requires an SSN for $600+ winners.
- LeagueSafe issues none and puts taxes on members.
- The One Big Beautiful Bill Act raises the 1099-MISC threshold to **$2,000 for payments in 2026**, indexed from 2027. It restores the 1099-K threshold to **$20,000 and 200 transactions**.
- From 2026, only 90% of gambling losses are deductible. CPA sources say fantasy winnings fall under this. **Confirm with a tax adviser.**
- Holding dues also means holding SSNs and W-9s: more PII and more security burden.

---

## 3. Apple App Store rules

Guidelines last revised 2026-06-08 per Apple Developer News.

| Rule | What it says | What it means for PuckIQ |
|---|---|---|
| **5.3.4** | Real-money gaming "must have necessary licensing and permissions in the locations where the app is used, must be geo-restricted to those locations, and must be free on the App Store" | Paid leagues need licences and geo-fencing. "Free" means a free download. PuckIQ goes free with IAP at the 3.0 cutover, so that part is fine |
| **5.3.3** | Apps "may not use in-app purchase to purchase credit or currency for use in conjunction with real money gaming" | Dues can't go through IAP, and Pro must not be bundled with or give credits toward entries |
| **5.3.1 / 5.3.2** | Contests "must be sponsored by the developer"; official rules shown in-app, stating Apple isn't involved | User-created paid leagues are awkward unless PuckIQ is the sponsor/operator. **Ask App Review before building D** |
| **5.1.1(ix)** | Gambling and financial-services apps "should be submitted by a legal entity … not by an individual developer" | Before B-embedded or D, make sure the developer account is an organisation (LLC) |
| **3.1.1** | Unlocking digital features must use IAP | A PuckIQ "commissioner fee" or paid league hosting is a digital service, so it goes through IAP at 15–30%. A cut of dues cannot go through IAP (5.3.3) |
| **3.2.1(vii)** | Person-to-person monetary gifts may skip IAP only if optional and 100% goes to the receiver | Dues are not gifts. Don't frame them as gifts |
| **1.2** | UGC and chat need filtering, reporting and blocking | Applies to Phase A if groups get chat |

**Does selling a subscription conflict with real-money features? No, as long as they stay separate.**
- Yahoo Fantasy is "Free · In-App Purchases": Fantasy Plus at $39.99 and $59.99, Ultra at $79.99. It runs paid prize leagues and DFS in the same app.
- Yahoo is rated **18+** with a "Gambling" descriptor, and so is Sleeper.
- **Expect the whole PuckIQ app to move to 18+ if it ever offers paid contests.** That is my reading of Apple's age-rating questionnaire, not a quoted rule.
- Tracking-only (Phase A) doesn't trigger 5.3. Sleeper's tracker and LeagueSwype's app are live on the store.

---

## 4. How others do it

| Company | What it does with money | Licensing posture | Fees | Complaints / notes |
|---|---|---|---|---|
| **LeagueSafe** (SportsHub) | Holds dues; members assign title to LeagueSafe Management, LLC; payouts by commissioner, majority or unanimous vote | "Not financial institutions"; "legal in all 50 states" because it doesn't run contests; 18+, US and Canada | Free by e-check; card 4.5% + $0.10; payouts $3–$5; commissioner can add fees up to 25% of the pot | Chargebacks freeze the league's funds; no 1099s. Scale: 600k+ users. 2023 football: 56k leagues, $31.5M dues, $55 average per user. **API: none public; MFL integration only** |
| **Sleeper** | **Dues Tracker** (July 2025, tracking only), then **SleeperSafe** (August 2026): dues held in a separate "League Dues Wallet"; the system proposes payouts with a 24–72h veto window | Licensed or registered paid-fantasy operator; Picks in ~31 states, 21 jurisdictions excluded; 18+ (19 AL/NE, 21 MA/VA) | "Zero fees" via Aeropay bank transfer; other methods vary | SleeperSafe state list isn't published (**unknown**). This is the closest model to the founder's idea, built on existing licensed infrastructure |
| **Yahoo** | **Private Prize Leagues:** Yahoo collects $10–$250 entries, pays winners, issues 1099s; segregated accounts. **Public Prize Leagues** exist for hockey | Operator; excludes 11 states + MO (prize leagues) + ON/QC; 18+ (19 AL/NE, 21 AZ/MA) | **2% management fee** | Free hosting plus Fantasy Plus/Ultra subscriptions via IAP |
| **ESPN** | No native dues collection found | n/a | Free hosting | Commissioners use LeagueSafe etc. (**no primary source found either way**) |
| **Fantrax** | **Treasurer:** collects and pays out dues, "100%" paid out, FDIC-insured banks (**per search snippets; page wouldn't load**) | Unknown | Treasurer free; Premium commissioner leagues about $99.95 (baseball) | Popular with deep hockey leagues for customisation |
| **CBS Sports** | Hosting fee, not dues | n/a | Hockey Commissioner $149.99/season ($99.99 prepay, $129.99 early bird) | Paid hosting is a proven model for serious leagues |
| **Underdog / PrizePicks** | House-style DFS and pick'em wallets | Licensed state by state; now moving to CFTC prediction markets as states crack down on pick'em; PrizePicks exiting Canada (2026) | Rake/margin | Shows how hostile regulation of anything house-banked has become |
| **Splitwise / Venmo Groups** | Track and settle group expenses (Venmo Groups up to 30 people, 2023) | n/a | — | Venmo/PayPal policy still bans entry-fee-and-prize payments. Phase A's ledger copies the tracking half safely |
| **LeagueSwype** | Dues wallet and payouts | Unknown | Not published | Tiny (about $120k raised); a possible partner but unproven |

---

## 5. Hosting leagues on-platform

**What it takes:** see Phase C scope. The hard parts are:
1. A real-time draft room.
2. Waiver processing jobs and edge cases.
3. A scoring engine that handles stat corrections and postponed games (the Olympic-break scheduling in 2026 is a recent example).
4. Commissioner overrides that don't corrupt history.
5. In-season support.

PuckIQ already has an NHL client, lineup logic and Supabase auth, which saves maybe 20–30% of the work.

**Data and licensing:**
- **Stats themselves are free to use.** *C.B.C. v. MLB Advanced Media* (8th Cir. 2007; cert. denied 2008) held that fantasy games may use player names and stats without a licence under the First Amendment.
- **How you get them is the issue.** NHL.com's terms of service (updated 2025-10-29) limit use to "non-commercial, informational, personal use" and ban "unauthorized … scraping" and data extraction. `api-web.nhle.com` is undocumented. This is a contract and terms risk PuckIQ already carries for the coach, but a hosted league, and especially a paid one, turns a data outage or dispute into a scoring and money dispute.
- **Licensed feeds:**
  - Sportradar has been the NHL's official data distributor since 2015 and signed a 10-year deal in 2021.
  - SportsDataIO's median contract is about $16.5k/yr across all its products (Vendr). Its self-serve tier ($99–$149/mo) is *not* licensed for commercial redistribution.
  - A third-party blog puts Sportradar single-sport basic stats at $5k–$12k/yr. **Treat all of these as rough; get quotes.**
- **Logos and headshots are trademarks and likenesses.** Keep using text and team colours, or license them.

**How long competitors took:** Sleeper was founded in 2014/15 and launched full leagues in 2017 after 2–3 years with a funded team. It has raised about $217M (Tracxn), and it took until 2025–26 to add dues features. Yahoo, ESPN and CBS have had leagues for 20+ years.

---

## 6. Market signal

- **Size:** FSGA 2025 counts about 57M fantasy players (53M US, 4.2M Canada). Hockey is about 7–12% of players, per secondary citations of FSGA; I couldn't open the primary page. That is roughly **4–7M fantasy hockey players**, skewed Canadian. **Uncertain.**
- **Money in leagues:**
  - LeagueSafe 2023 football data: $55 average per user; 66.5% of users in leagues of $25+; most common fee $50.
  - FSGA "next-gen" players: 64% pay league fees, median $100/yr (via secondary source).
  - About 37% of season-long players play for money (secondary; **uncertain**).
  - Dues are common, and collecting them is a known commissioner pain point, which is why Sleeper built a tracker in 2025 and then SleeperSafe in 2026.
- **Switching:** Evidence that hockey players want to leave Yahoo, ESPN or Fantrax is **anecdotal**. Forum posts mention moving to Fantrax for customisation and commissioner tools, and Yahoo's app is still widely liked. I found **no data showing money features drive switching or retention.** Sleeper's move is the strongest signal, and it came after they already had the league network.
- **The switching unit is the league, not the user.** A commissioner moves 10–12 people at once, usually over the summer. That favours Phase A: get whole leagues into PuckIQ first, then offer to host them.

---

## What I'd do first

1. **Ship Phase A, "League Groups", right after 3.0 is stable (2–3 weeks).**
   - Group tied to the user's existing league (name, platform, size), with an invite link.
   - Dues ledger: amount, deadline, paid checkmarks, Tuesday reminders; payout plan; season-end settle-up.
   - An optional **"Hold the pot with LeagueSafe"** URL field. This is a link-out; PuckIQ never touches money.
   - A group weekly digest built from existing coach features (hot pickups, whose lineup is thinnest, matchup edges). This is the growth loop.
   - Keep it free so it spreads. Pro stays the coach.
   - Copy: say "dues", "prize", "payout". Never say "bet" or "wager". No prefilled Venmo requests.
2. **Instrument it in PostHog:** groups created, invites sent and accepted, share of a league that joins, and 30- and 60-day retention of grouped vs solo users, plus conversion to Pro.
3. **Decision gate (around January 2027):** if a meaningful number of groups have at least half their league on PuckIQ, email partners@leaguesafe.com about a status API or co-marketing, and scope free **playoff pools** for spring 2027 as a Phase C pilot. If not, stop here. The feature still helps retention.
4. **Before anything beyond B:** form or confirm an LLC and an Apple organisation account, and book a gaming/payments lawyer (questions below).

### Questions a lawyer must answer before any money moves
1. If PuckIQ only links to or displays a third party's dues status (Phase B), could it be treated as an agent, operator or promoter? Can it take a referral fee from that partner?
2. Does holding and paying out dues for leagues PuckIQ does **not** host make it a money transmitter federally or in any state? Is LeagueSafe's structure (members assign title to funds) a model, and why?
3. If PuckIQ hosts free leagues and a partner holds the dues, is PuckIQ an "operator" under NY PML §1401–1402 and similar laws?
4. Does a pot made up of dues satisfy UIGEA's "not determined by the number of participants or the amount of any fees paid" condition if payouts are fixed before the season?
5. Which states require registration or licensing for **private, invite-only, season-long** leagues with **no rake**? Which exemptions (Ohio's not-for-profit pool, Colorado's small operator, Texas's social gambling) actually cover a platform?
6. Why do Yahoo (Missouri) and SportsHub (Delaware, Vermont) exclude states that the other allows? Which list should PuckIQ follow?
7. Does any fee at all (per-league, per-member or a percentage) turn a legal private pool into illegal gambling in states like Texas and Ohio? Does a paid IAP hosting fee count?
8. Canada: can PuckIQ serve Canadian users' paid leagues anywhere without provincial registration, given s.204(1)(b) and s.206–207?
9. Apple: would user-created paid leagues satisfy 5.3.1 ("sponsored by the developer")? Must the whole app be rated 18+?
10. Is using NHL public endpoints for a **hosted** (and later paid) league acceptable under NHL.com's terms, or is a licensed feed required first?
11. Tax: who issues 1099s in a partner model? What KYC and W-9 collection is needed, and at what thresholds after the OBBBA changes?
12. Does a Pro "coach" subscription create unfair-advantage or disclosure issues in contests PuckIQ itself operates? Some state rules restrict scripts and tools; this needs checking.

---

## Sources

All accessed 2026-09-26 unless noted. Dates in brackets are page or publication dates where shown.

**Federal and state law, regulators**
- UIGEA definitions, 31 U.S.C. §5362: https://www.law.cornell.edu/uscode/text/31/5362
- UIGEA no-effect-on-state-law clause, 31 U.S.C. §5361: https://www.law.cornell.edu/uscode/text/31/5361
- FinCEN money transmitter definition, 31 CFR 1010.100(ff)(5): https://www.law.cornell.edu/cfr/text/31/1010.100
- FinCEN escrow ruling FIN-2014-R004: https://www.fincen.gov/sites/default/files/administrative_ruling/FIN-2014-R004.pdf
- 18 U.S.C. §1960 (unlicensed money transmitting): https://www.law.cornell.edu/uscode/text/18/1960
- CSBS Money Transmission Modernization Act [31 states as of 2026-09-03]: https://www.csbs.org/csbs-money-transmission-modernization-act-mtma
- MTL cost estimates (secondary): https://complyone.tech/blog/how-much-does-a-money-transmitter-license-cost
- NY PML §1401 definitions: https://www.nysenate.gov/legislation/laws/PML/1401
- NY PML §1402 registration: https://www.nysenate.gov/legislation/laws/PML/1402
- Ohio R.C. 3774.01 [eff. 2018-03-23]: https://codes.ohio.gov/ohio-revised-code/section-3774.01
- Virginia Title 58.1 ch. 42 (Fantasy Contests): https://law.lis.virginia.gov/vacodefull/title58.1/chapter42/
- Montana MCA 23-5-802: https://mca.legmt.gov/bills/mca/title_0230/chapter_0050/part_0080/section_0020/0230-0050-0080-0020.html
- Washington RCW 9.46.0237: https://app.leg.wa.gov/rcw/default.aspx?cite=9.46.0237
- WSGC position (press coverage): https://www.seattletimes.com/sports/seahawks/is-it-gambling-why-fantasy-sports-sites-like-draftkings-and-fanduel-are-illegal-in-washington-state/
- Colorado fantasy contest registration/licensing: https://dpo.colorado.gov/FantasyContests/FAQ and https://sbg.colorado.gov/gaming/fantasy-contests
- Texas AG KP-0057 [2016-01-19]: https://www.texasattorneygeneral.gov/opinions/ken-paxton/kp-0057; summary: https://natlawreview.com/article/texas-attorney-general-opines-online-fantasy-sports-leagues-are-illegal-texas
- California AG Opinion 23-1001 [2025-07-03]: https://oag.ca.gov/system/files/opinions/pdfs/23-1001_1.pdf; ESPN coverage: https://www.espn.com/sports-betting/story/_/id/45661944/california-attorney-general-says-daily-fantasy-illegal-state
- Velawood fantasy sports legislation tracker [2026-02-12]: https://velawood.com/tracker/fantasy-sports-legislation-tracker/
- *Humphrey v. Viacom* (D.N.J. 2007): https://www.govinfo.gov/app/details/USCOURTS-njd-2_06-cv-02768
- *C.B.C. v. MLB Advanced Media* (8th Cir. 2007): https://harvardlawreview.org/wp-content/uploads/2008/02/CBC_v_MLBAM.pdf
- Criminal Code of Canada s.204: https://laws-lois.justice.gc.ca/eng/acts/c-46/section-204.html
- Chambers Gaming Law 2025, Canada: https://practiceguides.chambers.com/practice-guides/gaming-law-2025/canada
- IRS 1099-K threshold FAQ (OBBBA): https://irs.gov/newsroom/irs-issues-faqs-on-form-1099-k-threshold-under-the-one-big-beautiful-bill-dollar-limit-reverts-to-20000
- 1099-MISC $2,000 threshold (secondary): https://www.avalara.com/blog/en/north-america/2025/07/one-big-beautiful-bill-act-1099-reporting-threshold.html
- 90% gambling-loss cap (secondary): https://www.kiplinger.com/taxes/new-gambling-loss-deduction-limit

**Apple**
- App Review Guidelines (5.3, 5.1.1(ix), 3.1.1, 3.1.3, 3.2.1, 1.2): https://developer.apple.com/app-store/review/guidelines/
- Guideline update notes [2026-02-06, 2026-06-08]: https://developer.apple.com/news/
- Yahoo Fantasy App Store listing (IAP, 18+, Gambling): https://apps.apple.com/us/app/yahoo-fantasy-sports-nba-mlb/id328415391
- Sleeper App Store listing (18+, SleeperSafe): https://apps.apple.com/us/app/sleeper-sports/id987367543

**Payments**
- Stripe Prohibited and Restricted Businesses [2026-09-22]: https://stripe.com/legal/restricted-businesses
- PayPal gambling policy: https://www.paypal.com/us/cshelp/article/what-gambling-activities-does-paypal-prohibit-help391
- PayPal Acceptable Use Policy: https://www.paypal.com/us/legalhub/paypal/acceptableuse-full
- Venmo User Agreement [2026-08-24]: https://venmo.com/legal/us-user-agreement
- PayPal/Venmo league-pot freezes, Moneymaker [2022-01-13]: https://www.thelines.com/paypal-lawsuit-fantasy-football-chris-moneymaker-2022/
- Dwolla terms: https://www.dwolla.com/legal/dwolla-account-terms-of-service
- Aeropay gaming: https://www.aeropay.com/gaming
- Venmo Groups launch [2023-11-14]: https://techcrunch.com/2023/11/14/venmo-gets-a-new-way-to-split-expenses-among-groups-like-clubs-teams-trip-buddies-and-more/

**Competitors**
- LeagueSafe terms [2022-07-12]: https://www.leaguesafe.com/terms
- LeagueSafe home: https://www.leaguesafe.com/
- LeagueSafe partners (MFL integration): https://www.leaguesafe.com/partners
- LeagueSafe "legal in all 50 states" FAQ: https://help.leaguesafe.com/hc/en-us/articles/218017003-Is-LeagueSafe-legal-in-all-50-states
- SportsHub terms (SLFS excluded states) [2026-08-27]: https://terms.leaguesafe.com/terms
- LeagueSafe 2023 league report (press): https://www.onfocus.news/league-safe-publishes-fantasy-football-findings-vermont-tops-list-with-highest-entry-fee/
- Sleeper League Dues Tracker [2025-07-29]: https://support.sleeper.com/en/articles/11862228-fantasy-league-dues-tracker
- SleeperSafe Rules [2026-08-12]: https://support.sleeper.com/en/articles/15364522-sleepersafe-rules
- SleeperSafe announcement: https://x.com/SleeperHQ/status/2087648932180697481
- Sleeper "Where can I play?" [2026-08-03]: https://support.sleeper.com/en/articles/5556045-where-can-i-play
- Sleeper state rules [2026-02-01]: https://support.sleeper.com/en/articles/7062560-state-specific-rules-restrictions
- Sleeper Series C: https://sleeper.com/blog/fantasy-sports-app-sleeper-raises-40-million-series-c/; total funding: https://tracxn.com/d/companies/sleeper/__tYRPrSSLrnRPC8acmkCAeOaxsx0KdaGUvtWC_RIl9Ng
- Yahoo Paid Fantasy Terms of Service [2026-04-13]: https://legal.yahoo.com/us/en/yahoo/terms/product-atos/paidfantasy/index.html
- Yahoo Private Prize Leagues (2% fee): https://help.yahoo.com/kb/SLN26485.html
- Yahoo Fantasy Hockey Public Prize Leagues rules [2026-08-06]: https://legal.yahoo.com/us/en/yahoo/officialrules/fantasy-hockey/public-prize-leagues/index.html
- Fantrax Treasurer: https://www.fantrax.com/treasurer (JS page; details from search snippets)
- CBS Fantasy Hockey Commissioner pricing: https://www.cbssports.com/fantasy/hockey/games/prize-leagues/faq
- LeagueSwype: https://www.leagueswype.com/ and https://www.cbinsights.com/company/leagueswype
- PrizePicks/Underdog pivot [2026]: https://www.gamblinginsider.com/news/115830/prizepicks-exits-canada-underdog-layoffs-prediction-markets

**Data and market**
- NHL.com Terms of Service [2025-10-29]: https://www.nhl.com/info/terms-of-service
- NHL–Sportradar 10-year deal [2021-06-29]: https://www.nhl.com/news/nhl-sportradar-10-year-partnership-325502590
- SportsDataIO pricing (Vendr) [2025]: https://www.vendr.com/marketplace/sportsdataio
- Sportradar price ranges (third-party, unverified): https://kanopylabs.com/blog/how-much-does-it-cost-to-build-a-fantasy-sports-app
- FSGA: 57.4M fantasy players [2025]: https://thefsga.org/fantasy-sports-grows-to-57-4-million/ (primary page did not load; figures via search summaries)
- Fantasy stats roundup (hockey share, next-gen spend; secondary): https://sqmagazine.co.uk/fantasy-sports-statistics/
- Platform switching anecdotes: https://forums.hfboards.com/threads/yahoo-vs-fantrax-vs-espn.2690017/

### Things I could not verify (treat as open)
- The states where SleeperSafe is available, and whether Sleeper or LeagueSafe hold money-transmitter licences.
- Fantrax Treasurer details (page wouldn't render), and whether ESPN has any dues feature.
- Hockey's exact share of fantasy players, and any data tying money features to retention or switching.
- Why Yahoo excludes Missouri for season-long prize leagues only.
- Whether Apple strictly requires an 18+ rating for an app with paid fantasy leagues. It is inferred from Yahoo's and Sleeper's ratings.
- Data-feed and KYC/geolocation prices. All vendor quotes are rough or third-party.
