import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  type Href,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';

import { ApiError, apiGet } from '@/lib/api';
import { attachSafetyEvidence } from '@/lib/safety-evidence';
import { useAuth } from '@/providers/auth-provider';
import type {
  LocalEvidenceAsset,
  MemberSafetyCase,
  SafetyCaseEnvelope,
  SafetyCaseState,
  SafetyCategory,
} from '@/types/safety';

const stateLabels: Record<SafetyCaseState, string> = {
  open: 'Received',
  assigned: 'Assigned for review',
  investigating: 'Under review',
  resolved: 'Resolved',
  dismissed: 'Closed',
};

const categoryLabels: Record<SafetyCategory, string> = {
  harassment: 'Harassment',
  coercion: 'Coercion or pressure',
  threats: 'Threats',
  physical_safety: 'Physical safety',
  sexual_misconduct: 'Sexual misconduct',
  fraud: 'Fraud or financial concern',
  impersonation: 'Impersonation',
  other: 'Other concern',
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatSize(value: number | null) {
  if (value === null) return 'File';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SafetyCaseDetailScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session, signOut } = useAuth();
  const accessToken = session?.access_token;

  const [item, setItem] = useState<MemberSafetyCase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const closed = useMemo(
    () =>
      item?.state === 'resolved' ||
      item?.state === 'dismissed',
    [item?.state],
  );

  const load = useCallback(async () => {
    if (!id || !accessToken) {
      setErrorMessage('This private report could not be opened.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await apiGet<SafetyCaseEnvelope>(
        `/safety-cases/${encodeURIComponent(id)}`,
        accessToken,
      );
      setItem(response.data);
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 401 ||
          error.code === 'authentication_required')
      ) {
        await signOut();
        return;
      }
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load this private report.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, id, signOut]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function uploadEvidence(asset: LocalEvidenceAsset) {
    if (!item || !accessToken || isUploading || closed) {
      return;
    }

    if (asset.size && asset.size > 10 * 1024 * 1024) {
      setErrorMessage('Evidence files must be 10 MB or smaller.');
      return;
    }

    setIsUploading(true);
    setErrorMessage('');

    try {
      const response = await attachSafetyEvidence({
        caseId: item.id,
        asset,
        accessToken,
      });
      setItem(response.data);
      Alert.alert(
        'Evidence attached',
        'The file is private and available only to you and authorized Vouch safety staff.',
      );
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 401 ||
          error.code === 'authentication_required')
      ) {
        await signOut();
        return;
      }
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to attach this evidence.',
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function pickPhoto() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setErrorMessage(
        'Photo-library access is required to attach a screenshot.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 1,
    });

    if (result.canceled) return;
    const asset = result.assets[0];

    await uploadEvidence({
      uri: asset.uri,
      name:
        asset.fileName ??
        `safety-evidence-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      size: asset.fileSize ?? null,
    });
  }

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: [
        'image/*',
        'application/pdf',
        'text/plain',
      ],
    });

    if (result.canceled) return;
    const asset = result.assets[0];

    await uploadEvidence({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? null,
      size: asset.size ?? null,
    });
  }

  function chooseEvidenceSource() {
    Alert.alert(
      'Attach private evidence',
      'Choose a screenshot or another supported file.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Photo library',
          onPress: () => void pickPhoto(),
        },
        {
          text: 'Choose file',
          onPress: () => void pickFile(),
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <ActivityIndicator color="#352D28" size="large" />
          <Text style={styles.helper}>Opening your report…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>
            This report could not be opened.
          </Text>
          <Text style={styles.errorBody}>{errorMessage}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Header />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>PRIVATE SAFETY CASE</Text>
        <Text style={styles.title}>Your report</Text>
        <Text style={styles.created}>
          Submitted {formatDateTime(item.created_at)}
        </Text>

        <View
          style={[
            styles.statusCard,
            item.priority === 'urgent' && styles.urgentStatusCard,
          ]}
        >
          <Ionicons
            color={item.priority === 'urgent' ? '#943D35' : '#365C4D'}
            name={
              item.priority === 'urgent'
                ? 'warning-outline'
                : 'shield-checkmark-outline'
            }
            size={23}
          />
          <View style={styles.statusCopy}>
            <Text
              style={[
                styles.statusTitle,
                item.priority === 'urgent' &&
                  styles.urgentStatusTitle,
              ]}
            >
              {stateLabels[item.state]}
            </Text>
            <Text style={styles.statusBody}>
              {item.state === 'open'
                ? 'Vouch has received the report.'
                : item.state === 'assigned'
                  ? 'An authorized team member has been assigned.'
                  : item.state === 'investigating'
                    ? 'The report is being reviewed privately.'
                    : 'The review is closed.'}
            </Text>
          </View>
        </View>

        {item.immediate_danger ? (
          <View style={styles.emergencyCard}>
            <Text style={styles.emergencyTitle}>
              Immediate danger was selected
            </Text>
            <Text style={styles.emergencyBody}>
              Vouch is not an emergency service. Contact local
              emergency services immediately when danger is ongoing.
            </Text>
          </View>
        ) : null}

        <View style={styles.detailCard}>
          <Text style={styles.detailLabel}>CATEGORY</Text>
          <Text style={styles.detailValue}>
            {categoryLabels[item.category]}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.detailLabel}>YOUR PRIVATE REPORT</Text>
          <Text style={styles.narrative}>{item.narrative}</Text>
          {item.resolution ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.detailLabel}>CASE OUTCOME</Text>
              <Text style={styles.detailValue}>
                {item.resolution.split('_').join(' ')}
              </Text>
            </>
          ) : null}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>PRIVATE EVIDENCE</Text>
          <Text style={styles.sectionMeta}>
            {item.evidence.length} attached
          </Text>
        </View>

        {item.evidence.length === 0 ? (
          <View style={styles.emptyEvidence}>
            <Ionicons
              color="#766E67"
              name="document-attach-outline"
              size={24}
            />
            <Text style={styles.emptyEvidenceTitle}>
              No evidence attached
            </Text>
            <Text style={styles.emptyEvidenceBody}>
              Screenshots, PDFs, and text files can be added privately.
            </Text>
          </View>
        ) : (
          <View style={styles.evidenceList}>
            {item.evidence.map((evidence, index) => (
              <View key={evidence.id} style={styles.evidenceCard}>
                <View style={styles.evidenceIcon}>
                  <Ionicons
                    color="#365C4D"
                    name="document-text-outline"
                    size={20}
                  />
                </View>
                <View style={styles.evidenceCopy}>
                  <Text style={styles.evidenceTitle}>
                    Evidence {index + 1}
                  </Text>
                  <Text style={styles.evidenceMeta}>
                    {[
                      evidence.content_type,
                      formatSize(evidence.size_bytes),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Ionicons
                  color="#365C4D"
                  name="checkmark-circle"
                  size={20}
                />
              </View>
            ))}
          </View>
        )}

        {errorMessage ? (
          <Text style={styles.inlineError}>{errorMessage}</Text>
        ) : null}

        {!closed ? (
          <Pressable
            disabled={isUploading}
            onPress={chooseEvidenceSource}
            style={styles.primaryButton}
          >
            {isUploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  color="#FFFFFF"
                  name="attach-outline"
                  size={19}
                />
                <Text style={styles.primaryText}>
                  Attach private evidence
                </Text>
              </>
            )}
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => router.push('/safety-cases' as Href)}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryText}>
            View all safety reports
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons color="#352D28" name="chevron-back" size={25} />
      </Pressable>
      <Text style={styles.wordmark}>VOUCH</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F4EF' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 54,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  wordmark: {
    color: '#352D28',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3.2,
  },
  headerSpacer: { width: 40 },
  content: { paddingBottom: 48, paddingHorizontal: 20 },
  eyebrow: {
    color: '#766E67',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginTop: 12,
  },
  title: {
    color: '#171717',
    fontSize: 31,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginTop: 9,
  },
  created: {
    color: '#746D66',
    fontSize: 13,
    marginTop: 7,
  },
  statusCard: {
    alignItems: 'flex-start',
    backgroundColor: '#E5ECE8',
    borderRadius: 11,
    flexDirection: 'row',
    gap: 11,
    marginTop: 22,
    padding: 16,
  },
  urgentStatusCard: { backgroundColor: '#F6E9E6' },
  statusCopy: { flex: 1 },
  statusTitle: {
    color: '#365C4D',
    fontSize: 15,
    fontWeight: '800',
  },
  urgentStatusTitle: { color: '#943D35' },
  statusBody: {
    color: '#68635D',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  emergencyCard: {
    backgroundColor: '#F6E9E6',
    borderRadius: 10,
    marginTop: 14,
    padding: 15,
  },
  emergencyTitle: {
    color: '#943D35',
    fontSize: 14,
    fontWeight: '800',
  },
  emergencyBody: {
    color: '#7A4A45',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2DCD5',
    borderRadius: 11,
    borderWidth: 1,
    marginTop: 18,
    padding: 17,
  },
  detailLabel: {
    color: '#766E67',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  detailValue: {
    color: '#282522',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
    textTransform: 'capitalize',
  },
  narrative: {
    color: '#423B36',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  divider: {
    backgroundColor: '#EEE9E3',
    height: 1,
    marginVertical: 17,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 26,
  },
  sectionTitle: {
    color: '#716961',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sectionMeta: {
    color: '#8A827A',
    fontSize: 12,
  },
  emptyEvidence: {
    alignItems: 'center',
    backgroundColor: '#EEEAE5',
    borderRadius: 10,
    marginTop: 12,
    padding: 22,
  },
  emptyEvidenceTitle: {
    color: '#352D28',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
  },
  emptyEvidenceBody: {
    color: '#746D66',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'center',
  },
  evidenceList: { gap: 10, marginTop: 12 },
  evidenceCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2DCD5',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 13,
  },
  evidenceIcon: {
    alignItems: 'center',
    backgroundColor: '#E5ECE8',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  evidenceCopy: { flex: 1 },
  evidenceTitle: {
    color: '#2D2926',
    fontSize: 14,
    fontWeight: '800',
  },
  evidenceMeta: {
    color: '#746D66',
    fontSize: 12,
    marginTop: 3,
  },
  inlineError: {
    backgroundColor: '#F6E9E6',
    borderRadius: 9,
    color: '#943D35',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 18,
    padding: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#352D28',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 54,
    paddingHorizontal: 18,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#CFC7BF',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  secondaryText: {
    color: '#352D28',
    fontSize: 15,
    fontWeight: '800',
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  helper: {
    color: '#68635D',
    fontSize: 15,
    marginTop: 12,
  },
  errorTitle: {
    color: '#1F1D1B',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorBody: {
    color: '#6F6861',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 9,
    textAlign: 'center',
  },
});
