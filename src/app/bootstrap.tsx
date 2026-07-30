import { StyleSheet, View } from "react-native";

import {
  AppScreen,
  LoadingState,
  VouchWordmark,
} from "@/components/vouch-ui";
import { space } from "@/constants/design";

export default function BootstrapScreen() {
  return (
    <AppScreen includeBottomInset>
      <View style={styles.content}>
        <VouchWordmark />
        <LoadingState label="Preparing your private member experience…" />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
  },
});
