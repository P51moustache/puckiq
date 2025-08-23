import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, ActivityIndicator, View, Text, useColorScheme, Modal, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { ThemedView } from '@/components/ThemedView';
import { makeStyles } from './index';

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

function Dropdown({
	label,
	placeholder,
	options,
	value,
	onChange,
	disabled,
	loading,
	scheme,
}: {
	label?: string;
	placeholder: string;
	options: Option[];
	value: string | null;
	onChange: (val: string | null) => void;
	disabled?: boolean;
	loading?: boolean;
	scheme: 'light' | 'dark';
}) {
	const [open, setOpen] = useState(false);
	const textColor = scheme === 'dark' ? '#e6eef8' : '#0f172a';
	const border = scheme === 'dark' ? '#081726' : '#e2e8f0';
	const bg = scheme === 'dark' ? '#0b1630' : '#fff';
	const backdrop = 'rgba(0,0,0,0.4)';
	const selectedLabel = options.find((o) => o.value === value)?.label;
	return (
		<View style={{ alignSelf: 'stretch' }}>
			{label ? <Text style={{ color: scheme === 'dark' ? '#98a6bf' : '#64748b', marginBottom: 6 }}>{label}</Text> : null}
			  <Pressable
				disabled={disabled || loading}
				onPress={() => setOpen(true)}
				style={{
					backgroundColor: bg,
					borderRadius: 12,
					borderWidth: 1,
					borderColor: border,
				  paddingVertical: 12,
				  paddingHorizontal: 0,
					opacity: disabled || loading ? 0.6 : 1,
				}}
			>
				{loading ? (
					<ActivityIndicator size="small" color={scheme === 'dark' ? '#fff' : '#000'} />
				) : (
				  <Text style={{ color: textColor }}>
						{selectedLabel || placeholder}
					</Text>
				)}
			</Pressable>
			<Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
				<Pressable style={{ flex: 1, backgroundColor: backdrop, justifyContent: 'center', paddingHorizontal: 24 }} onPress={() => setOpen(false)}>
					<Pressable
						onPress={() => {}}
						style={{ backgroundColor: bg, borderRadius: 14, paddingVertical: 8, maxHeight: 420, borderWidth: 1, borderColor: border }}
					>
						<View style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: border }}>
							<Text style={{ color: textColor, fontWeight: '700' }}>{label || 'Select'}</Text>
						</View>
						<ScrollView>
							{options.map((opt) => (
								<Pressable
									key={`${opt.label}-${opt.value}`}
									onPress={() => {
										onChange(opt.value);
										setOpen(false);
									}}
									style={({ pressed }) => ({ paddingVertical: 12, paddingHorizontal: 14, backgroundColor: pressed ? (scheme === 'dark' ? '#0e223f' : '#f8fafc') : 'transparent' })}
								>
									<Text style={{ color: textColor }}>{opt.label}</Text>
								</Pressable>
							))}
						</ScrollView>
						<Pressable onPress={() => setOpen(false)} style={{ paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: border }}>
							<Text style={{ color: scheme === 'dark' ? '#98a6bf' : '#64748b' }}>Cancel</Text>
						</Pressable>
					</Pressable>
				</Pressable>
			</Modal>
		</View>
	);
}

export default function ExploreScreen() {
	const scheme = useColorScheme() || 'light';
	const styles = makeStyles(scheme as 'light' | 'dark');

	// Teams
	const [teams, setTeams] = useState<Team[] | null>(null);
	const [loadingTeams, setLoadingTeams] = useState(true);
	const [teamsError, setTeamsError] = useState<string | null>(null);
	const [selectedTeam, setSelectedTeam] = useState<string | null>(null); // abbrev

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
		// Prefer provided headshot if exists, else fallback to known CDN pattern
		const fromApi = pd?.headshot ?? pd?.imageUrl ?? pd?.heroImage; // may be object or string
		if (typeof fromApi === 'string' && fromApi) return fromApi;
		if (fromApi?.default) return String(fromApi.default);
		const id = pd?.playerId || pd?.id;
		if (id) {
			// 168x168 headshot pattern (works for most players)
			return `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${id}.jpg`;
		}
		return undefined;
	}

	const now = new Date();

	return (
		<ThemedView style={styles.container}>
			<ScrollView
				style={{ alignSelf: 'stretch', width: '100%' }}
				contentContainerStyle={styles.scrollContainer}
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.header}>
					<Text style={styles.title}>Explore Player Stats</Text>
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
							onChange={setSelectedTeam}
							disabled={!teams || teams.length === 0}
							loading={loadingTeams}
							scheme={scheme as 'light' | 'dark'}
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
							scheme={scheme as 'light' | 'dark'}
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
							scheme={scheme as 'light' | 'dark'}
						/>
					</View>
				</View>

				{/* Player Card */}
				<View style={[styles.card, { marginTop: 18, alignSelf: 'stretch', width: '100%' }]}>
					<Text style={styles.greeting}>Player Details</Text>
					{loadingPlayer && (
						<ActivityIndicator size="small" color={scheme === 'dark' ? '#fff' : '#000'} style={{ marginTop: 12 }} />
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
									style={{ width: 84, height: 84, borderRadius: 42, marginRight: 14, backgroundColor: scheme === 'dark' ? '#071a36' : '#e6eefb' }}
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
									{ label: 'Weight', value: playerData?.weightInLbs ? `${playerData.weightInLbs} lb` : undefined },
									{ label: 'Age', value: playerData?.age ? String(playerData.age) : undefined },
									{
										label: 'Born',
										value: [playerData?.birthDate, playerData?.birthCity, playerData?.birthCountry]
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
											borderColor: scheme === 'dark' ? '#081726' : '#f1f5f9',
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
						</View>
					)}
				</View>
			</ScrollView>
		</ThemedView>
	);
}

