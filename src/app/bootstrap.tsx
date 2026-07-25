import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function BootstrapScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.wordmark}>VOUCH</Text>
        <ActivityIndicator color="#352D28" size="large" />
        <Text style={styles.message}>Preparing your experience…</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F4EF',
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  wordmark: {
    color: '#352D28',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 4,
    marginBottom: 34,
  },
  message: {
    color: '#68635D',
    fontSize: 15,
    marginTop: 20,
  },
});
