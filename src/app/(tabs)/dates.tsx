import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function DatesScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Dates</Text>
        <Text style={styles.body}>
          Date proposals, confirmations, and debriefs will appear here.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F4EF' },
  content: { flex: 1, justifyContent: 'center', padding: 28 },
  title: { color: '#171717', fontSize: 30, fontWeight: '700' },
  body: { color: '#68635D', fontSize: 16, lineHeight: 24, marginTop: 12 },
});
