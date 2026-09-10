import React, { useState } from "react";
import { Alert, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArenaButton, arenaType, TeamPicker } from "./ArenaPrimitives";
import { useArena } from "./ArenaProvider";
import { ArenaSkater } from "./ArenaSkater";
import { ArenaHeadline } from "./ArenaHeadline";

export function ArenaOnboarding({
  onComplete,
  onApple,
  onGoogle,
}: {
  onComplete: () => Promise<void>;
  onApple: () => Promise<boolean>;
  onGoogle: () => Promise<boolean>;
}) {
  const { palette: p, homeTeam } = useArena();
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const finish = async (auth?: () => Promise<boolean>) => {
    setBusy(true);
    try {
      if (!auth || (await auth())) await onComplete();
    } catch {
      Alert.alert("Could not continue", "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.page }}>
      <ScrollView contentContainerStyle={{ padding: 23, gap: 18 }}>
        <Text
          style={{
            fontSize: 31,
            color: p.ink,
            fontWeight: "900",
            fontStyle: "italic",
            letterSpacing: -1.7,
          }}
        >
          puckiq
        </Text>
        <View
          style={{
            backgroundColor: p.hero,
            borderWidth: 2,
            borderColor: p.frame,
            borderRadius: 19,
            height: 340,
            overflow: "hidden",
            padding: 19,
          }}
        >
          <View
            style={{
              position: "absolute",
              left: -30,
              right: -30,
              height: 35,
              bottom: 40,
              backgroundColor: p.action,
              transform: [{ rotate: "-16deg" }],
            }}
          />
          <ArenaSkater
            style={{
              position: "absolute",
              height: 315,
              width: 230,
              right: -40,
              bottom: -35,
            }}
          />
          <Text
            style={{
              fontFamily: arenaType.body,
              color: p.heroInk,
              fontSize: 10,
              letterSpacing: 2,
            }}
          >
            WELCOME TO THE CLUB
          </Text>
          <ArenaHeadline
            text={"YOUR TEAM.\nYOUR ICE."}
            fontSize={76}
            color={p.heroInk}
            textShadowColor={p.hero}
            style={{ marginTop: 14 }}
          />
          <Text
            style={{
              position: "absolute",
              bottom: 19,
              left: 19,
              fontFamily: arenaType.body,
              color: p.heroInk,
              fontSize: 11,
              fontWeight: "800",
            }}
          >
            EVERY GAME HAS A STORY.
          </Text>
        </View>
        <Text
          style={{
            fontFamily: arenaType.body,
            fontSize: 15,
            lineHeight: 23,
            color: p.ink,
          }}
        >
          Get to know the matchup. Follow your players. Keep a season book of
          the games that mattered.
        </Text>
        <ArenaButton
          label={
            homeTeam ? `${homeTeam.name} · change` : "Choose your home team"
          }
          secondary
          onPress={() => setPicker(true)}
          icon="flag-outline"
        />
        <ArenaButton
          label="Start my season"
          disabled={busy}
          onPress={() => void finish()}
          icon="arrow-forward"
        />
        <Text
          style={{
            fontFamily: arenaType.body,
            color: p.muted,
            fontSize: 11,
            textAlign: "center",
          }}
        >
          Continue on this device, or sign in below.
        </Text>
        {Platform.OS === "ios" && (
          <ArenaButton
            secondary
            disabled={busy}
            label="Continue with Apple"
            onPress={() => void finish(onApple)}
            icon="logo-apple"
          />
        )}
        <ArenaButton
          secondary
          disabled={busy}
          label="Continue with Google"
          onPress={() => void finish(onGoogle)}
          icon="logo-google"
        />
        <Text
          style={{
            fontFamily: arenaType.body,
            color: p.muted,
            fontSize: 11,
            lineHeight: 17,
          }}
        >
          Schedules and statistics depend on feed availability. Saved cards and
          home-team preferences stay on this device.
        </Text>
      </ScrollView>
      <TeamPicker visible={picker} onClose={() => setPicker(false)} />
    </SafeAreaView>
  );
}
