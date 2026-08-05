import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AppScreen, StackHeader } from "@/components/vouch-ui";
import { layout, palette, radius, space, typography } from "@/constants/design";

const commitments = [
  { icon: "person-outline" as const, title: "Real people", body: "Membership is reviewed, identity and age eligibility are verified, and raw identity media is not kept by Vouch." },
  { icon: "eye-off-outline" as const, title: "No public profiles", body: "Your profile is not browsable or web-indexed. It appears only in a Vouch-approved introduction." },
  { icon: "sparkles-outline" as const, title: "AI stays optional", body: "AI matching is off by default, uses only approved dossier facts after consent, and never sends an introduction without human review." },
  { icon: "chatbubble-ellipses-outline" as const, title: "Private means private", body: "Private conversations, identity media, safety information, and private debrief notes are excluded from AI matching." },
  { icon: "analytics-outline" as const, title: "Outcomes over attention", body: "Vouch does not use swipes, boosts, popularity scores, streaks, or engagement bait. Success means worthwhile introductions and healthy real-world dates." },
  { icon: "shield-checkmark-outline" as const, title: "Safety can override speed", body: "Members can report concerns from a conversation and follow the case privately. Safety controls can pause or close connections immediately." },
];

export default function TrustCenterScreen() {
  return (
    <AppScreen includeBottomInset>
      <StackHeader title="Privacy & trust" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>THE VOUCH PROMISE</Text>
        <Text accessibilityRole="header" style={styles.title}>Designed for trust, not addiction</Text>
        <Text style={styles.subtitle}>
          A plain-language view of what Vouch does—and the product patterns we intentionally refuse to use.
        </Text>
        <View style={styles.list}>
          {commitments.map((item) => (
            <View key={item.title} style={styles.card}>
              <View style={styles.icon}><Ionicons color={palette.brand} name={item.icon} size={23} /></View>
              <View style={styles.copy}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardBody}>{item.body}</Text></View>
            </View>
          ))}
        </View>
        <View style={styles.note}>
          <Ionicons color={palette.sage} name="lock-closed-outline" size={22} />
          <Text style={styles.noteText}>
            You can change AI consent at any time, correct your profile and matchmaking information, and contact Vouch for access or deletion requests.
          </Text>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: "center", maxWidth: layout.contentMaxWidth, paddingBottom: space.xxxl, paddingHorizontal: space.lg, paddingTop: space.xl, width: "100%" },
  eyebrow: { color: palette.brand, ...typography.label }, title: { color: palette.ink, marginTop: space.xs, ...typography.title }, subtitle: { color: palette.muted, marginTop: space.sm, ...typography.body },
  list: { gap: space.sm, marginTop: space.xl }, card: { alignItems: "flex-start", backgroundColor: palette.surface, borderColor: palette.border, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: space.md, padding: space.md }, icon: { alignItems: "center", backgroundColor: palette.brandSoft, borderRadius: radius.sm, height: 46, justifyContent: "center", width: 46 }, copy: { flex: 1 }, cardTitle: { color: palette.ink, ...typography.bodyStrong }, cardBody: { color: palette.muted, marginTop: space.xs, ...typography.small },
  note: { alignItems: "flex-start", backgroundColor: palette.sageSoft, borderRadius: radius.md, flexDirection: "row", gap: space.sm, marginTop: space.xl, padding: space.md }, noteText: { color: palette.sage, flex: 1, ...typography.small },
});
