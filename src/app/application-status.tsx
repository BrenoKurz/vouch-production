import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  AppButton,
  AppScreen,
  VouchWordmark,
} from '@/components/vouch-ui';
import {
  layout,
  palette,
  space,
  typography,
} from '@/constants/design';
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
    <AppScreen includeBottomInset>
      <View style={styles.content}>
        <VouchWordmark />
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        <AppButton
          label={primaryLabel}
          onPress={() => void onPrimary()}
          style={styles.primaryButton}
        />
        <AppButton
          label={secondaryLabel}
          onPress={() => void onSecondary()}
          variant="secondary"
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignSelf: 'center',
    flex: 1,
    justifyContent: 'center',
    maxWidth: Math.min(layout.contentMaxWidth, 560),
    padding: space.xl,
    width: '100%',
  },
  eyebrow: {
    color: palette.brand,
    marginTop: space.xxxl,
    ...typography.label,
  },
  title: {
    color: palette.ink,
    marginTop: space.sm,
    ...typography.display,
  },
  body: {
    color: palette.muted,
    marginBottom: space.xl,
    marginTop: space.md,
    ...typography.body,
  },
  primaryButton: {
    marginBottom: space.sm,
  },
});
