# PUCK-IQ USER ARCHETYPES

These three personas drive every product decision. Every feature must serve at least one persona well and not actively harm the others. Use these profiles when running the Persona Gauntlet, Persona Validation, and Conflict Resolution persona tests.

---

## 1. THE SHARK (Competitive / Edge-Seeker)

**Core Identity:** Treats hockey like a market. Wants information asymmetry — data that other fans don't have or haven't processed yet.

**Motivation:** Wants an edge. Uses obscure stats to win fantasy leagues, make smarter picks, and outperform casual fans.

**Frustration:** "This data is too slow. I already saw this on Twitter."

**Quote:** "Show me the underlying metrics, not the score."

### What Shark Wants From Each Screen
- **Today:** Confidence scores with the math behind them. Factor breakdowns showing WHY a pick is strong. Wants to see disagreement between factors (e.g., "Goaltending says A, but Recent Form says B").
- **Explore:** Advanced stats (Corsi, Fenwick, xG). Loves splits, trends, and comparisons. Wants data density — don't hide numbers behind taps.
- **Models:** This is Shark's playground. Wants to tweak weights, backtest, compare model variants, and find the edge that PuckIQ Classic misses.
- **Learn:** Only if it teaches something actionable. "What does xG actually predict?" not "What is a goal?"
- **My IQ:** Obsessed with accuracy tracking. Wants to know which factors they're best at reading.

### What "Good" Looks Like for Shark
- A screen where Shark notices something other apps don't show
- Data that updates fast (no stale scores from 2 hours ago)
- Ability to dig deeper on any number (tap a stat → see what drives it)
- Model Builder that actually affects predictions

### Red Flags (Shark Is Leaving)
- Predictions with no explanation ("trust us")
- Data that's easily available elsewhere (basic scores, standings)
- Dumbed-down language ("this team is doing great!")
- Can't customize or go deeper

---

## 2. THE DEBATER (Social / Argument-Winner)

**Core Identity:** Hockey is a social sport for Debater. Every stat is ammunition for a group chat argument or Reddit thread. Needs proof, not opinions.

**Motivation:** Wants to be right. Needs screenshots and charts to win arguments in group chats and social media.

**Frustration:** "I can't share this easily. Why is the text so small?"

**Quote:** "I need to prove McDavid is slumping."

### What Debater Wants From Each Screen
- **Today:** Clear, quotable pick headlines. "PuckIQ says Rangers 68% — here's why" in a format that screenshots well (dark background, big text, clean layout).
- **Explore:** Comparison tools. "Team A vs Team B" side-by-side. Charts that tell a story at a glance.
- **Models:** Only cares if it produces a bold, defensible take. "My custom model says the Oilers are frauds" — that's shareable.
- **Learn:** Wants talking points. "Did you know teams with 3+ days rest win 61% of the time?" — ammo for conversations.
- **My IQ:** Brags about accuracy. "I'm at 72% this month" — screenshot material.

### What "Good" Looks Like for Debater
- Any screen that looks good as a screenshot (contrast, hierarchy, no clutter)
- Stats presented as takes/opinions ("Rangers are the hottest team in the East")
- Easy copy/share flows (share button, screenshot-optimized cards)
- Charts with clear narratives (not raw data dumps)

### Red Flags (Debater Is Leaving)
- Ugly screenshots (low contrast, tiny text, walls of numbers)
- No opinion — just raw data with no interpretation
- Can't easily share or copy a stat
- Text-heavy explanations instead of visual summaries

---

## 3. HOMER (Casual / Vibes-First)

**Core Identity:** Hockey is an emotional experience. Homer doesn't care about Corsi — they care about their team, game day energy, and whether tonight is going to be fun.

**Motivation:** Just loves their team. Wants the "Game Day Experience" — the emotional highs, the tension, the celebration.

**Frustration:** "This looks like a spreadsheet. It's boring."

**Quote:** "Where is the goal horn?"

### What Homer Wants From Each Screen
- **Today:** "Is my team playing tonight? Are we gonna win?" Big, clear matchup cards. Team colors. Confidence as a feeling ("STRONG PICK" badge), not a decimal. Wants to feel the excitement of game day.
- **Explore:** Team page for THEIR team. Roster, standings position, "are we in a playoff spot?" Don't make them scroll past 31 other teams.
- **Models:** Doesn't care. Will use PuckIQ Classic and never touch this. If forced here, needs a dead-simple UX.
- **Learn:** Only if it's fun. Bite-sized facts, "did you know" energy. Not textbook material.
- **My IQ:** Streak badges, milestones, achievements. Gamification. "You've been here 14 days straight!" makes Homer feel loyal and rewarded.

### What "Good" Looks Like for Homer
- Team colors and identity throughout (not generic dark cards for every team)
- Animations, transitions, and micro-interactions (scale on press, fade-ins, celebration on milestone)
- Emotional language ("LOCK OF THE DAY" not "Highest confidence prediction")
- Gamification (streaks, badges, milestones, progress bars)
- The app feels like opening ESPN on game day, not logging into a dashboard

### Red Flags (Homer Is Leaving)
- "Spreadsheet energy" — dense tables, no visual hierarchy, no color
- No personality — generic analytics language
- Nothing happens when you do something (no feedback, no animation, no celebration)
- Can't find their team quickly
- Feels like work, not fun

---

## Persona Decision Matrix

Use this when a feature serves one persona but might hurt another:

| Conflict | Resolution |
|----------|-----------|
| Shark wants data density, Homer wants simplicity | Use progressive disclosure: clean surface, tap to expand details |
| Debater wants screenshots, Shark wants interactivity | Make the default view screenshot-friendly, put interactive tools behind a tap |
| Homer wants fun, Shark wants serious | Use confident/energetic tone (serves both) — avoid either "boring" or "childish" |
| All three want different home screen emphasis | Personalize via the model switcher (Shark) and favorite team (Homer). Default state should serve Debater (clean, quotable picks) |

## The Universal Win
A feature that makes all three happy: **A bold, opinionated pick with clear reasoning, presented in a visually striking card that screenshots well, with a tap-to-expand for the nerdy details.**
