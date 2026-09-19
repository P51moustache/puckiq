import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ARENA_TEAMS } from "../../constants/arenaTheme";
import { useArena } from "./ArenaProvider";
import { arenaType } from "../../constants/arenaTypography";
import { getSettingsOriginFromPathname } from "../../utils/accountFlowPolicy";
export { arenaType } from "../../constants/arenaTypography";

export function ArenaButton({
  label,
  onPress,
  icon,
  secondary = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  secondary?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette: p } = useArena();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? p.paper : p.action,
          borderColor: p.frame,
          shadowColor: p.frame,
          opacity: disabled ? 0.5 : 1,
          transform: [{ translateY: pressed ? 3 : 0 }],
          shadowOffset: { width: 0, height: pressed ? 1 : 4 },
        },
        style,
      ]}
    >
      <Text
        style={[styles.buttonText, { color: secondary ? p.ink : p.actionInk }]}
      >
        {label}
      </Text>
      {icon && (
        <Ionicons
          name={icon}
          size={20}
          color={secondary ? p.ink : p.actionInk}
        />
      )}
    </Pressable>
  );
}

export function ArenaHeader({
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  const { palette: p, homeTeam } = useArena();
  const pathname = usePathname();
  const [picker, setPicker] = useState(false);
  return (
    <>
      <View style={styles.header}>
        <View style={styles.wordmark}>
          <View
            style={{
              width: 7,
              height: 25,
              backgroundColor: p.action,
              transform: [{ skewX: "-14deg" }],
              marginRight: 6,
            }}
          />
          <Text
            style={{
              color: p.ink,
              fontSize: 29,
              fontWeight: "900",
              fontStyle: "italic",
              letterSpacing: -1.7,
            }}
          >
            puckiq
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 7 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose home team"
            onPress={() => setPicker(true)}
            style={[
              styles.teamControl,
              { borderColor: p.edge, backgroundColor: p.paper },
            ]}
          >
            <Text
              style={{
                color: p.ink,
                fontFamily: arenaType.body,
                fontWeight: "700",
                fontSize: 12,
              }}
            >
              {homeTeam?.abbrev ?? "YOUR TEAM"}
            </Text>
            <Ionicons name="chevron-down" color={p.ink} size={13} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push({ pathname: "/(tabs)/hub", params: { origin: getSettingsOriginFromPathname(pathname) } })}
            style={styles.iconButton}
          >
            <Ionicons name="options-outline" size={24} color={p.ink} />
          </Pressable>
        </View>
      </View>
      {title && (
        <View style={{ marginBottom: 18 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: arenaType.display,
              fontSize: 48,
              color: p.ink,
            }}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={{
                fontFamily: arenaType.body,
                color: p.muted,
                fontSize: 14,
                lineHeight: 21,
              }}
            >
              {subtitle}
            </Text>
          )}
        </View>
      )}
      <TeamPicker visible={picker} onClose={() => setPicker(false)} />
    </>
  );
}

export function TeamPicker({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const {
    palette: p,
    homeTeam,
    followedTeams,
    followTeam,
    chooseHomeTeam,
  } = useArena();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const choose = async (abbrev: string) => {
    setBusy(abbrev);
    try {
      if (!followedTeams.some((team) => team.triCode === abbrev))
        await followTeam(abbrev);
      await chooseHomeTeam(abbrev);
      onClose();
    } catch {
      Alert.alert("Team could not be saved", "Please try again.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: p.page }}>
        <View style={{ padding: 20, flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: arenaType.display,
                fontSize: 40,
                color: p.ink,
              }}
            >
              HOME ICE
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close team picker"
              onPress={onClose}
              style={styles.iconButton}
            >
              <Ionicons name="close" size={27} color={p.ink} />
            </Pressable>
          </View>
          <Text
            style={{
              color: p.muted,
              fontFamily: arenaType.body,
              lineHeight: 21,
            }}
          >
            Pick the colors you live in. Choosing a new team also adds it to
            Following.
          </Text>
          <TextInput
            accessibilityLabel="Search teams"
            placeholder="Find your team"
            placeholderTextColor={p.muted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            style={{
              borderColor: p.edge,
              color: p.ink,
              backgroundColor: p.paper,
              borderWidth: 1.5,
              borderRadius: 12,
              padding: 14,
              marginVertical: 18,
              fontFamily: arenaType.body,
            }}
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24, gap: 8 }}
          >
            {ARENA_TEAMS.filter((team) =>
              `${team.name} ${team.abbrev}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            ).map((team) => (
              <Pressable
                key={team.abbrev}
                accessibilityRole="button"
                accessibilityLabel={`Use ${team.name} colors`}
                accessibilityState={{
                  selected: homeTeam?.abbrev === team.abbrev,
                  disabled: !!busy,
                }}
                disabled={!!busy}
                onPress={() => void choose(team.abbrev)}
                style={{
                  borderWidth: homeTeam?.abbrev === team.abbrev ? 2 : 1,
                  borderColor:
                    homeTeam?.abbrev === team.abbrev ? p.frame : p.edge,
                  backgroundColor: p.paper,
                  borderRadius: 12,
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  minHeight: 66,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 42,
                    backgroundColor: team.tokens.hero,
                    borderBottomWidth: 7,
                    borderBottomColor: team.tokens.action,
                    borderRadius: 7,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: arenaType.display,
                      fontSize: 20,
                      color: team.tokens.heroInk,
                    }}
                  >
                    {team.abbrev}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: p.ink,
                      fontFamily: arenaType.body,
                      fontWeight: "700",
                    }}
                  >
                    {team.name}
                  </Text>
                  <Text
                    style={{
                      color: p.muted,
                      fontFamily: arenaType.body,
                      fontSize: 11,
                      marginTop: 3,
                    }}
                  >
                    {homeTeam?.abbrev === team.abbrev
                      ? "HOME TEAM"
                      : followedTeams.some((f) => f.triCode === team.abbrev)
                        ? "FOLLOWING"
                        : "FOLLOW + MAKE HOME"}
                  </Text>
                </View>
                {busy === team.abbrev ? (
                  <ActivityIndicator color={p.ink} />
                ) : (
                  <Ionicons
                    name={
                      homeTeam?.abbrev === team.abbrev
                        ? "checkmark-circle"
                        : "arrow-forward"
                    }
                    color={p.ink}
                    size={21}
                  />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export function ArenaNote({ children }: { children: React.ReactNode }) {
  const { palette: p } = useArena();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: p.edge,
        backgroundColor: p.soft,
        borderRadius: 12,
        padding: 15,
        marginVertical: 10,
      }}
    >
      <Text
        style={{
          fontFamily: arenaType.body,
          fontSize: 13,
          lineHeight: 20,
          color: p.ink,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderWidth: 2,
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  buttonText: {
    fontFamily: arenaType.body,
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 7,
    paddingBottom: 20,
  },
  wordmark: { flexDirection: "row", alignItems: "center" },
  teamControl: {
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
