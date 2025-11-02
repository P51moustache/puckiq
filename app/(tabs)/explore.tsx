import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import Dropdown from '../../components/Dropdown';
import { ThemedView } from '../../components/ThemedView';
import { makeStyles } from '../../constants/theme';
import { useAnalytics } from '../../hooks/useAnalytics';

type Team = {
	id: string;
	name: string;
	abbrev: string; // three-letter code
};

type RosterPlayer = {
	id: string;
	name: string;
	number?: string | number;
	shoots?: string; // L/R/C
	posGroup: 'F' | 'D' | 'G';
};

type PositionKey = 'F' | 'D' | 'G';

type PlayerLanding = any; // loose type – API fields vary; we'll guard accesses

type Option = { label: string; value: string | null };

// Local Dropdown replaced by shared Dropdown component

export default function ExploreScreen() {
	const styles = makeStyles();
	
	// Initialize analytics for this screen (background tracking only)
	const analytics = useAnalytics('ExploreScreen');

	// Teams
	const [teams, setTeams] = useState<Team[] | null>(null);
	const [loadingTeams, setLoadingTeams] = useState(true);
	const [teamsError, setTeamsError] = useState<string | null>(null);
	const [selectedTeam, setSelectedTeam] = useState<string | null>(null); // abbrev

	// Load saved team preference on app start
	useEffect(() => {
		async function loadSavedTeam() {
			try {
				const savedTeam = await AsyncStorage.getItem('selectedTeam');
				if (savedTeam) {
					setSelectedTeam(savedTeam);
				}
			} catch (error) {
				console.warn('Failed to load saved team preference:', error);
			}
		}
		loadSavedTeam();
	}, []);

	// Save team preference whenever it changes
	const handleTeamChange = async (teamAbbrev: string | null) => {
		setSelectedTeam(teamAbbrev);
		try {
			if (teamAbbrev) {
				await AsyncStorage.setItem('selectedTeam', teamAbbrev);
			} else {
				await AsyncStorage.removeItem('selectedTeam');
			}
		} catch (error) {
			console.warn('Failed to save team preference:', error);
		}
	};

	// Roster
	const [roster, setRoster] = useState<RosterPlayer[] | null>(null);
	const [loadingRoster, setLoadingRoster] = useState(false);
	const [rosterError, setRosterError] = useState<string | null>(null);
	const [selectedPos, setSelectedPos] = useState<PositionKey | null>(null);

	// Player
	const [playersForPos, setPlayersForPos] = useState<RosterPlayer[]>([]);
	const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
	const [playerData, setPlayerData] = useState<PlayerLanding | null>(null);
	const [loadingPlayer, setLoadingPlayer] = useState(false);
	const [playerError, setPlayerError] = useState<string | null>(null);

	// Fetch teams once
	useEffect(() => {
		let mounted = true;
		async function loadTeams() {
			setLoadingTeams(true);
			setTeamsError(null);
			try {
				const res = await fetch('https://api.nhle.com/stats/rest/en/team');
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const json = await res.json();
				const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json?.teams) ? json.teams : [];
				const EXCLUDE_ABBREV = new Set([
					'ATL', 'ARI', 'AFM', 'BRK', 'CGS', 'CLE', 'CLR', 'DCG', 'DFL', 'HAM', 'HFD', 'KCS', 'MNS', 'MMR', 'MWN', 'NYA', 'NHL',
					'OAK', 'SEN', 'QUA', 'PHX', 'PIR', 'QBD', 'QUE', 'SLE', 'TBD', 'TAN', 'TSP', 'WIN',
				]);
				const EXCLUDE_NAMES = new Set(['UTAH HOCKEY CLUB']);
				const parsed: Team[] = rows
					.map((r: any) => ({
						id: String(r.teamId ?? r.id ?? r.abbrev ?? r.teamAbbrev ?? Math.random()),
						name: String(
							r.teamFullName ?? r.fullName ?? r.teamName ?? r.name ?? `${r.teamCommonName ?? ''} ${r.teamPlaceName ?? ''}`
						).trim(),
						abbrev: String(r.teamAbbrev ?? r.abbrev ?? r.triCode ?? r.code ?? '').toUpperCase(),
					}))
					.filter((t: Team) => t.abbrev && t.name)
					.filter((t: Team) => !EXCLUDE_ABBREV.has(t.abbrev) && !EXCLUDE_NAMES.has(t.name.toUpperCase()));
				parsed.sort((a, b) => a.name.localeCompare(b.name));
				if (mounted) setTeams(parsed);
			} catch (e: any) {
				if (mounted) setTeamsError(e?.message ?? 'Failed to load teams');
			} finally {
				if (mounted) setLoadingTeams(false);
			}
		}
		loadTeams();
		return () => {
			mounted = false;
		};
	}, []);

	// Fetch roster when team changes
	useEffect(() => {
		let mounted = true;
		async function loadRoster(teamAbbrev: string) {
			setLoadingRoster(true);
			setRosterError(null);
			setRoster(null);
			setSelectedPos(null);
			setSelectedPlayerId(null);
			setPlayerData(null);
			try {
				const res = await fetch(`https://api-web.nhle.com/v1/roster/${encodeURIComponent(teamAbbrev)}/current`);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const json = await res.json();

				const buckets: Array<{ key: PositionKey; list: any[] }> = [
					{ key: 'F', list: json?.forwards ?? json?.skaters ?? [] },
					{ key: 'D', list: json?.defensemen ?? [] },
					{ key: 'G', list: json?.goalies ?? json?.goaltenders ?? [] },
				];

				const flattened: RosterPlayer[] = buckets
					.flatMap(({ key, list }) =>
						(Array.isArray(list) ? list : []).map((p: any) => ({
							id: String(p.id ?? p.personId ?? p.playerId ?? Math.random()),
							name: `${p.firstName?.default ?? p.firstName ?? ''} ${p.lastName?.default ?? p.lastName ?? ''}`.trim(),
							number: p.sweaterNumber ?? p.jerseyNumber,
							shoots: p.shootsCatches ?? p.hand ?? p.catches ?? undefined,
							posGroup: key,
						}))
					)
					.filter((p) => p.id && p.name);

				if (mounted) setRoster(flattened);
			} catch (e: any) {
				if (mounted) setRosterError(e?.message ?? 'Failed to load roster');
			} finally {
				if (mounted) setLoadingRoster(false);
			}
		}
		if (selectedTeam) loadRoster(selectedTeam);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedTeam]);

	// Derive players list when pos changes
	useEffect(() => {
		if (!roster || !selectedPos) {
			setPlayersForPos([]);
			return;
		}
		const filtered = roster.filter((p) => p.posGroup === selectedPos);
		filtered.sort((a, b) => a.name.localeCompare(b.name));
		setPlayersForPos(filtered);
		setSelectedPlayerId(null);
		setPlayerData(null);
	}, [roster, selectedPos]);

	// Fetch player landing when player changes
	useEffect(() => {
		let mounted = true;
		async function loadPlayer(playerId: string) {
			setLoadingPlayer(true);
			setPlayerError(null);
			setPlayerData(null);
			try {
				const res = await fetch(`https://api-web.nhle.com/v1/player/${encodeURIComponent(playerId)}/landing`);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const json = await res.json();
				if (mounted) setPlayerData(json);
			} catch (e: any) {
				if (mounted) setPlayerError(e?.message ?? 'Failed to load player');
			} finally {
				if (mounted) setLoadingPlayer(false);
			}
		}
		if (selectedPlayerId) loadPlayer(selectedPlayerId);
		return () => {
			mounted = false;
		};
	}, [selectedPlayerId]);

	const positionsAvailable: Array<{ key: PositionKey; label: string }> = useMemo(() => {
		if (!roster) return [];
		const hasF = roster.some((p) => p.posGroup === 'F');
		const hasD = roster.some((p) => p.posGroup === 'D');
		const hasG = roster.some((p) => p.posGroup === 'G');
		const out: Array<{ key: PositionKey; label: string }> = [];
		if (hasF) out.push({ key: 'F', label: 'Forwards' });
		if (hasD) out.push({ key: 'D', label: 'Defensemen' });
		if (hasG) out.push({ key: 'G', label: 'Goalies' });
		return out;
	}, [roster]);

	// Helpers
	function heightFromInches(inches?: number): string | undefined {
		if (!inches || isNaN(inches)) return undefined;
		const ft = Math.floor(inches / 12);
		const inch = Math.round(inches % 12);
		return `${ft}' ${inch}\"`;
	}

		function playerHeadshot(pd: any): string | undefined {
			// Only use values provided by API, no synthetic fallbacks
			const fromApi = pd?.headshot ?? pd?.imageUrl ?? pd?.heroImage; // may be object or string
			if (typeof fromApi === 'string' && fromApi) return fromApi;
			if (fromApi?.default) return String(fromApi.default);
			return undefined;
		}

	const now = new Date();

	return (
		<ThemedView style={styles.container}>
			<ScrollView
				style={{ alignSelf: 'stretch', width: '100%' }}
				contentContainerStyle={[styles.scrollContainer, { paddingBottom: 100 }]}
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.header}>
					<Text style={styles.title}>Player Stats</Text>
				</View>

				{/* Selection Card */}
				<View style={[styles.card, { alignSelf: 'stretch', width: '100%' }]}>
					
					{/* Team Dropdown */}
					<View style={{ alignSelf: 'stretch', marginTop: 12 }}>
						{teamsError ? (
							<Text style={{ color: 'red', paddingBottom: 6 }}>{teamsError}</Text>
						) : null}
						<Dropdown
							label="Team"
							placeholder="Select a team"
							options={(teams ?? []).map((t) => ({ label: `${t.name} (${t.abbrev})`, value: t.abbrev }))}
							value={selectedTeam}
							onChange={handleTeamChange}
							disabled={!teams || teams.length === 0}
							loading={loadingTeams}
							selectedTextStyle={{ fontWeight: '900', fontSize: 18, letterSpacing: 0.5 }}
						/>
					</View>

					{/* Position Dropdown */}
					<View style={{ alignSelf: 'stretch', marginTop: 16 }}>
						{rosterError ? (
							<Text style={{ color: 'red', paddingBottom: 6 }}>{rosterError}</Text>
						) : null}
						<Dropdown
							label="Position"
							placeholder={!selectedTeam ? 'Select a team first' : 'Select a position'}
							options={positionsAvailable.map((p) => ({ label: p.label, value: p.key }))}
							value={selectedPos as unknown as string | null}
							onChange={(v) => setSelectedPos((v as PositionKey) || null)}
							disabled={!roster || loadingRoster}
							loading={loadingRoster}
							selectedTextStyle={{ fontWeight: '900', fontSize: 18, letterSpacing: 0.5 }}
						/>
					</View>

					{/* Player Dropdown */}
					<View style={{ alignSelf: 'stretch', marginTop: 16 }}>
						<Dropdown
							label="Player"
							placeholder={!selectedPos ? 'Select a position first' : 'Select a player'}
							options={playersForPos.map((p) => ({ label: `${p.name}${p.number ? ` (#${p.number})` : ''}`, value: p.id }))}
							value={selectedPlayerId}
							onChange={setSelectedPlayerId}
							disabled={playersForPos.length === 0}
							loading={false}
							selectedTextStyle={{ fontWeight: '900', fontSize: 18, letterSpacing: 0.5 }}
						/>
					</View>
				</View>

				{/* Player Card */}
				<View style={[styles.card, { marginTop: 18, marginBottom: 24, alignSelf: 'stretch', width: '100%' }]}>
					<Text style={styles.greeting}>Player Details</Text>
					{loadingPlayer && (
						<ActivityIndicator size="small" color="#fff" style={{ marginTop: 12 }} />
					)}
					{playerError && <Text style={{ color: 'red', marginTop: 12 }}>{playerError}</Text>}
					{!selectedPlayerId && !loadingPlayer && (
						<Text style={{ color: styles.lead.color }}>Make selections above to view a player.</Text>
					)}

					{playerData && (
						<View style={{ width: '100%', marginTop: 12 }}>
							<View style={{ flexDirection: 'row', alignItems: 'center' }}>
								<Image
									source={{ uri: playerHeadshot(playerData) }}
									style={{ width: 84, height: 84, borderRadius: 42, marginRight: 14, backgroundColor: '#071a36' }}
									contentFit="cover"
									accessibilityLabel="Player headshot"
								/>
								<View style={{ flex: 1 }}>
									<Text style={[styles.greeting, { marginBottom: 2 }]}>
										{`${playerData?.firstName?.default ?? playerData?.firstName ?? ''} ${playerData?.lastName?.default ?? playerData?.lastName ?? ''}`.trim()}
									</Text>
									<Text style={styles.subtitle}>
										{playerData?.currentTeamAbbrev || selectedTeam} · #{playerData?.sweaterNumber ?? playerData?.primaryNumber ?? ''}
									</Text>
								</View>
							</View>

							{/* Quick facts grid */}
							<View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 }}>
								{[
									{ label: 'Position', value: playerData?.positionCode ?? playerData?.position ?? '' },
									{ label: 'Shoots/Catches', value: playerData?.shootsCatches ?? '' },
									{
										label: 'Height',
										value: heightFromInches(
											Number(playerData?.heightInInches ?? playerData?.heightInInches1 ?? playerData?.height)
										),
									},
									{ label: 'Weight', value: playerData?.weightInPounds ? `${playerData.weightInPounds} lbs` : '' },
									{ label: 'Age', value: playerData?.age ? String(playerData.age) : undefined },
									{
										label: 'Born',
										value: [playerData?.birthDate, playerData?.birthCity.default, playerData?.birthCountry]
											.filter(Boolean)
											.join(' · '),
									},
									{ label: 'Nationality', value: playerData?.nationality ?? playerData?.birthCountry },
								]
									.filter((x) => x.value)
									.map((x) => (
										<View key={x.label} style={{ width: '50%', paddingVertical: 6 }}>
											<Text style={[styles.subtitle, { fontSize: 12 }]}>{x.label}</Text>
											<Text style={{ color: styles.greeting.color, fontWeight: '600' }}>{x.value}</Text>
										</View>
									))}
							</View>

								{/* Draft details (moved first) */}
								{playerData?.draftDetails && (
									<View style={{ marginTop: 12 }}>
										<Text style={[styles.subtitle, { marginBottom: 6 }]}>Draft</Text>
										<Text style={{ color: styles.greeting.color, fontWeight: '600' }}>
											{playerData.draftDetails.year} · Round {playerData.draftDetails.round}, Pick {playerData.draftDetails.pickInRound} (#{playerData.draftDetails.overallPick}) · {playerData.draftDetails.teamAbbrev}
										</Text>
									</View>
								)}

							{/* Featured stats if present */}
							{playerData?.featuredStats?.regularSeason?.subSeason && (
								<View style={{ marginTop: 12 }}>
									<Text style={[styles.subtitle, { marginBottom: 6 }]}>This Season</Text>
									<View
										style={{
											flexDirection: 'row',
											justifyContent: 'space-between',
											paddingVertical: 8,
											borderTopWidth: 1,
											borderBottomWidth: 1,
											borderColor: '#081726',
										}}
									>
										{Object.entries(playerData.featuredStats.regularSeason.subSeason)
											.filter(([k]) => ['gamesPlayed', 'goals', 'assists', 'points', 'wins', 'savePct', 'gaa'].includes(k))
											.map(([k, v]) => (
												<View key={k} style={{ alignItems: 'center', flex: 1 }}>
													<Text style={[styles.subtitle, { fontSize: 12 }]}>{k}</Text>
													<Text style={{ color: styles.nameAccent.color, fontWeight: '800' }}>{String(v)}</Text>
												</View>
											))}
									</View>
								</View>
							)}
							
							{/* Playoffs (this year) */}
							{playerData?.featuredStats?.playoffs?.subSeason && (
								<View style={{ marginTop: 12 }}>
									<Text style={[styles.subtitle, { marginBottom: 6 }]}>This Playoffs</Text>
									<View
										style={{
											flexDirection: 'row',
											justifyContent: 'space-between',
											paddingVertical: 8,
											borderTopWidth: 1,
											borderBottomWidth: 1,
											borderColor: '#081726',
										}}
									>
										{Object.entries(playerData.featuredStats.playoffs.subSeason)
											.filter(([k]) => ['gamesPlayed', 'goals', 'assists', 'points', 'wins', 'savePct', 'gaa'].includes(k))
											.map(([k, v]) => (
												<View key={k} style={{ alignItems: 'center', flex: 1 }}>
													<Text style={[styles.subtitle, { fontSize: 12 }]}>{k}</Text>
													<Text style={{ color: styles.nameAccent.color, fontWeight: '800' }}>{String(v)}</Text>
												</View>
											))}
									</View>
								</View>
							)}
							{/* Career totals (from API only) */}
							{(() => {
								// Prefer more complete fields first
								const candidateList: any[] = [
									playerData?.careerTotals?.regularSeason,
									playerData?.featuredStats?.regularSeason?.career,
									playerData?.regularSeasonCareer,
									playerData?.stats?.career,
									playerData?.career,
									playerData?.featuredStats?.career?.subSeason,
								];
								const career = candidateList.find((c) => c && typeof c === 'object');
								if (!career) return null;

								function fmtNum(n: any) {
									const num = Number(n);
									if (Number.isFinite(num)) return num.toLocaleString();
									return String(n ?? '');
								}

								function fmtPct(p: any) {
									const num = Number(p);
									if (!Number.isFinite(num)) return '';
									const percent = num > 1 ? num : num * 100;
									return `${percent.toFixed(1)}%`;
								}

								return (
									<View style={{ marginTop: 12 }}>
										<Text style={[styles.subtitle, { marginBottom: 6 }]}>Career</Text>
										<View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
											{[
												{ label: 'GP', value: fmtNum(career.gamesPlayed) },
												{ label: 'G', value: fmtNum(career.goals) },
												{ label: 'A', value: fmtNum(career.assists) },
												{ label: 'P', value: fmtNum(career.points) },
												{ label: '+/-', value: fmtNum(career.plusMinus) },
												{ label: 'PIM', value: fmtNum(career.pim) },
												{ label: 'S', value: fmtNum(career.shots) },
												{ label: 'S%', value: fmtPct(career.shootingPctg) },
												{ label: 'GWG', value: fmtNum(career.gameWinningGoals) },
												{ label: 'OTG', value: fmtNum(career.otGoals) },
												{ label: 'PPG', value: fmtNum(career.powerPlayGoals) },
												{ label: 'PPP', value: fmtNum(career.powerPlayPoints) },
												{ label: 'SHG', value: fmtNum(career.shorthandedGoals) },
												{ label: 'SHP', value: fmtNum(career.shorthandedPoints) },
												{ label: 'FO%', value: fmtPct(career.faceoffWinningPctg) },
												{ label: 'ATOI', value: career.avgToi as string },
											]
												.filter((x) => x.value !== '' && x.value !== undefined)
												.map((x) => (
													<View key={x.label} style={{ width: '25%', paddingVertical: 6 }}>
														<Text style={[styles.subtitle, { fontSize: 12, textAlign: 'center' }]}>{x.label}</Text>
														<Text style={{ color: styles.greeting.color, fontWeight: '700', textAlign: 'center' }}>{x.value}</Text>
													</View>
												))}
										</View>
									</View>
								);
							})()}

							{/* Career playoffs (API only) – moved after Career */}
							{(() => {
								const cp = playerData?.careerTotals?.playoffs || playerData?.featuredStats?.playoffs?.career;
								if (!cp) return null;
								function fmt(n: any) {
									const x = Number(n);
									return Number.isFinite(x) ? x.toLocaleString() : String(n ?? '');
								}
								function pct(p: any) {
									const x = Number(p);
									if (!Number.isFinite(x)) return '';
									const percent = x > 1 ? x : x * 100;
									return `${percent.toFixed(1)}%`;
								}
								return (
									<View style={{ marginTop: 12 }}>
										<Text style={[styles.subtitle, { marginBottom: 6 }]}>Career Playoffs</Text>
										<View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
											{[
												{ label: 'GP', value: fmt(cp.gamesPlayed) },
												{ label: 'G', value: fmt(cp.goals) },
												{ label: 'A', value: fmt(cp.assists) },
												{ label: 'P', value: fmt(cp.points) },
												{ label: '+/-', value: fmt(cp.plusMinus) },
												{ label: 'PIM', value: fmt(cp.pim) },
												{ label: 'S', value: fmt(cp.shots) },
												{ label: 'S%', value: pct(cp.shootingPctg) },
												{ label: 'GWG', value: fmt(cp.gameWinningGoals) },
												{ label: 'OTG', value: fmt(cp.otGoals) },
												{ label: 'PPG', value: fmt(cp.powerPlayGoals) },
												{ label: 'PPP', value: fmt(cp.powerPlayPoints) },
											]
												.filter((x) => x.value !== '' && x.value !== undefined)
												.map((x) => (
													<View key={x.label} style={{ width: '25%', paddingVertical: 6 }}>
														<Text style={[styles.subtitle, { fontSize: 12, textAlign: 'center' }]}>{x.label}</Text>
														<Text style={{ color: styles.greeting.color, fontWeight: '700', textAlign: 'center' }}>{x.value}</Text>
													</View>
												))}
										</View>
									</View>
								);
							})()}

							{/* Last 5 games – moved to end */}
							{Array.isArray(playerData?.last5Games) && playerData.last5Games.length > 0 && (
								<View style={{ marginTop: 12 }}>
									<Text style={[styles.subtitle, { marginBottom: 6 }]}>Last 5 Games</Text>
									<View style={{ borderWidth: 1, borderColor: '#081726', borderRadius: 10, overflow: 'hidden' }}>
										<View style={{ flexDirection: 'row', backgroundColor: '#071a36' }}>
											{['Date', 'Opp', 'G', 'A', 'P', 'S', 'TOI'].map((h) => (
												<Text key={h} style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, color: styles.subtitle.color, fontSize: 12 }}>{h}</Text>
											))}
										</View>
										{playerData.last5Games.map((g: any, i: number) => (
											<View key={`${g.gameId}-${i}`} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#081726' }}>
												<Text style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, color: styles.greeting.color }}>{new Date(g.gameDate).toLocaleDateString()}</Text>
												<Text style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, color: styles.greeting.color }}>{g.opponentAbbrev}</Text>
												<Text style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, color: styles.greeting.color }}>{g.goals}</Text>
												<Text style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, color: styles.greeting.color }}>{g.assists}</Text>
												<Text style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, color: styles.greeting.color }}>{g.points}</Text>
												<Text style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, color: styles.greeting.color }}>{g.shots}</Text>
												<Text style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, color: styles.greeting.color }}>{g.toi || g.avgToi}</Text>
											</View>
										))}
									</View>
								</View>
							)}
						</View>
					)}
				</View>
			</ScrollView>
		</ThemedView>
	);
}

