import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/providers/auth-provider';
import {
  type ApplicationStatus,
  useMemberAccess,
} from '@/providers/member-access-provider';

const copy: Record<
  Exclude<ApplicationStatus, 'invited'>,
  { eyebrow: string; title: string; body: string }
> = {
  submitted: {
    eyebrow: 'UNDER REVIEW',
    title: 'Your application is with us.',
    body:
      'Vouch reviews every application thoughtfully. We’ll let you know when there is an update.',
  },
  waitlisted: {
    eyebrow: 'WAITLIST',
    title: 'You’re still on our radar.',
    body:
      'We are keeping your application on the Vouch waitlist and will contact you if space becomes available.',
  },
  declined: {
    eyebrow: 'APPLICATION UPDATE',
    title: 'We can’t offer membership right now.',
    body:
      'Thank you for your interest in Vouch. Membership decisions are made carefully and privately.',
  },
  banned: {
    eyebrow: 'ACCESS RESTRICTED',
    title: 'This account cannot access Vouch.',
    body:
      'Please contact Vouch support if you believe this decision was made in error.',
  },
};

export default function ApplicationStatusScreen() {
  const { signOut } = useAuth();
  const { state, refresh } = useMemberAccess();

  if (state.kind === 'error') {
    return (
      <StatusLayout
        body={state.message}
        eyebrow="CONNECTION ISSUE"
        onPrimary={refresh}
        onSecondary={signOut}
        primaryLabel="Try again"
        secondaryLabel="Sign out"
        title="We couldn’t load your status."
      />
    );
  }

  if (
    state.kind !== 'application' ||
    state.application.status === 'invited'
  ) {
    return null;
  }

  const rawStatus = String(state.application.status);

  const content =
    copy[
      rawStatus as Exclude<ApplicationStatus, 'invited'>
    ] ?? {
      eyebrow: 'APPLICATION UPDATE',
      title: 'Your application is being reviewed.',
      body:
        'Your application has been received. Refresh this page later for the latest membership update.',
    };

  if (__DEV__ && !(rawStatus in copy)) {
    console.warn(
      `Unexpected application status received: ${rawStatus}`,
    );
  }

  return (
    <StatusLayout
      body={content.body}
      eyebrow={content.eyebrow}
      onPrimary={refresh}
      onSecondary={signOut}
      primaryLabel="Refresh status"
      secondaryLabel="Sign out"
      title={content.title}
    />
  );
}

function StatusLayout({
  eyebrow,
  title,
  body,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: {
  eyebrow: string;
  title: string;
  body: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void | Promise<void>;
  onSecondary: () => void | Promise<void>;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.wordmark}>VOUCH</Text>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        <Pressable onPress={onPrimary} style={styles.primaryButton}>
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </Pressable>

        <Pressable onPress={onSecondary} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>{secondaryLabel}</Text>
        </Pressable>
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
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  wordmark: {
    color: '#352D28',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 4,
    marginBottom: 44,
  },
  eyebrow: {
    color: '#786F67',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: '#171717',
    fontSize: 36,
    fontWeight: '600',
    letterSpacing: -1,
    lineHeight: 42,
    marginTop: 14,
  },
  body: {
    color: '#68635D',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#352D28',
    borderRadius: 10,
    height: 56,
    justifyContent: 'center',
    marginTop: 36,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#BEB6AE',
    borderRadius: 10,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryText: {
    color: '#352D28',
    fontSize: 16,
    fontWeight: '700',
  },
});
