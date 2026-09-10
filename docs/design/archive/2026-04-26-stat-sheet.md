# PuckIQ Design Vision — "Stat Sheet"

**Picked**: 2026-04-26
**Replaces**: "Rink Glass" (atmospheric arena-glass metaphor) — too abstract to drive concrete decisions, ~70/30 adoption with 30% of the app on legacy navy theme tokens
**Reason**: Owner feedback — "the app is honestly all over the place" + "I don't want there to be articles, I want it to be stats focused for the hockey enthusiast"

## The vibe

A daily briefing for someone who takes hockey seriously. The press box, not the broadcast booth. Calm, confident, terse, information-dense. Trust the reader.

Nearest reference: The Athletic dataroom × Linear × the back of a baseball card.

## The rules

1. **One surface system.** `rinkGlass.boards` (#141829) as the single card background. Optional 1px hairline border at `rinkGlass.glassBorder` for emphasis. No glass-on-glass. No blue-tinted Explore panels. No red-shadowed goalie cards.

2. **One accent color.** Cyan `#4cc9f0` (`rinkGlass.blueLight`) is the only decorative accent — used for active segments, primary CTAs, section underlines, sparklines. Semantic green `#06d6a0` / red `#e63946` / amber `#ffd60a` are reserved strictly for **data direction** (positive / negative / warn), never for section decoration.

3. **No emojis. Ever.** Fire 🔥 → small chart-up icon or numeric heat. The original "Rink Glass" spec said this; we now actually enforce it.

4. **Real headshots or dropped.** No letter circles. No abbreviation-text "logos." Where we lack a headshot, fall back to position + number in a neutral monogram, not a colored circle.

5. **Display-Bold is rationed.** Oswald-Bold is reserved for page titles + key stat numbers (the giant "8.2 PROJ PTS"). Body text is system. Tabular records use SF Mono.

6. **Premium stays subtle.** Replace the impenetrable scrim with a thin `PRO` lock badge on the gated card. Don't black out a whole tab.

7. **Section headers unify.** All-caps label + thin cyan underline (or a 4×20 cyan stripe). No more vertical pink + green + orange + yellow accent stripes per module.

8. **No editorial copy.** "Home teams winning 58% of games this week — ride the home ice edge" → out. "Be the first on the leaderboard!" → "NO RESULTS YET". "Factor accuracy tracking coming soon. Make picks to build data!" → "NO PICK HISTORY · Corsi · Fenwick · xG · PDO · SV%". The reader is a hockey enthusiast who can interpret raw data; don't pep-talk them.

9. **Data integrity first.** No "0th in Atlantic". No raw ISO timestamps. No floating-point artifacts. No empty section headers with nothing under them.
