import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import {
  type Href,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  AppScreen,
  ErrorState,
  LoadingState,
  StackHeader,
} from '@/components/vouch-ui';
import {
  layout,
  palette,
  radius,
} from '@/constants/design';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import type {
  ClosedConversationEnvelope,
  Conversation,
  ConversationCloseRequest,
  ConversationEnvelope,
  ConversationMessage,
  SentMessageEnvelope,
} from '@/types/conversation';

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatExpiry(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function compactCopy(value: string, length = 74) {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

function buildConversationStarters(
  name: string,
  prompts: Conversation['counterpart_profile']['prompts'],
) {
  const suggestions: string[] = [];

  for (const prompt of prompts) {
    if (prompt.answer.trim()) {
      suggestions.push(
        `Your answer about “${compactCopy(
          prompt.answer,
          58,
        )}” caught my attention—what’s the story behind it?`,
      );
    }

    if (prompt.question.trim()) {
      suggestions.push(
        `I liked your take on “${compactCopy(
          prompt.question,
          58,
        )}” What made you choose that answer?`,
      );
    }

    if (suggestions.length >= 3) {
      break;
    }
  }

  const fallbacks = [
    `What’s something you’ve been looking forward to lately, ${name}?`,
    `What would make an ordinary weekend feel great to you?`,
    `What’s a topic you can happily talk about for way too long?`,
  ];

  return [...suggestions, ...fallbacks].slice(0, 3);
}

function reviewDraft(value: string) {
  const trimmed = value.trim();

  if (trimmed.length < 20) {
    return null;
  }

  const letters = trimmed.match(/[A-Za-z]/g) ?? [];
  const uppercase = trimmed.match(/[A-Z]/g) ?? [];

  if (letters.length >= 12 && uppercase.length / letters.length > 0.8) {
    return 'This reads mostly in capital letters. A calmer tone may feel easier to receive.';
  }

  if (/[!?]{4,}/.test(trimmed)) {
    return 'A few fewer exclamation or question marks may make this feel more natural.';
  }

  if (trimmed.length > 1000) {
    return 'This is a thoughtful note. Splitting it into a shorter message may make it easier to respond to.';
  }

  return null;
}

export default function ConversationScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { session, signOut } = useAuth();
  const accessToken = session?.access_token;
  const listRef = useRef<FlatList<ConversationMessage>>(null);
  const inputRef = useRef<TextInput>(null);

  const [conversation, setConversation] =
    useState<Conversation | null>(null);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const counterpartName =
    conversation?.counterpart_profile.first_name || 'Conversation';

  const expiry = useMemo(
    () =>
      conversation
        ? formatExpiry(conversation.expires_at)
        : null,
    [conversation],
  );
  const conversationStarters = useMemo(
    () =>
      conversation
        ? buildConversationStarters(
            conversation.counterpart_profile.first_name,
            conversation.counterpart_profile.prompts,
          )
        : [],
    [conversation],
  );
  const draftReview = useMemo(() => reviewDraft(draft), [draft]);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'poll' = 'refresh') => {
      if (!id || !accessToken) {
        setErrorMessage('This conversation could not be opened.');
        setIsLoading(false);
        return;
      }

      if (mode === 'initial') setIsLoading(true);
      if (mode === 'refresh') setIsRefreshing(true);
      if (mode !== 'poll') setErrorMessage('');

      try {
        const response = await apiGet<ConversationEnvelope>(
          `/conversations/${encodeURIComponent(id)}`,
          accessToken,
        );

        setConversation(response.data);
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.status === 401 ||
            error.code === 'authentication_required')
        ) {
          await signOut();
          return;
        }

        if (mode !== 'poll') {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load this conversation.',
          );
        }
      } finally {
        if (mode === 'initial') setIsLoading(false);
        if (mode === 'refresh') setIsRefreshing(false);
      }
    },
    [accessToken, id, signOut],
  );

  useFocusEffect(
    useCallback(() => {
      void load('initial');

      const timer = setInterval(() => {
        void load('poll');
      }, 8000);

      return () => clearInterval(timer);
    }, [load]),
  );

  const isOpen = conversation?.state === 'open';
  const canProposeDate = Boolean(
    conversation?.available_actions.includes('propose_date'),
  );
  const canKindClose = Boolean(
    conversation?.available_actions.includes('kind_close'),
  );
  const canSend =
    Boolean(isOpen) &&
    draft.trim().length > 0 &&
    !isSending;

  async function sendMessage() {
    const body = draft.trim();

    if (
      !conversation ||
      !accessToken ||
      !body ||
      isSending ||
      !isOpen
    ) {
      return;
    }

    setIsSending(true);
    setErrorMessage('');

    try {
      const response = await apiPost<
        SentMessageEnvelope,
        { body: string }
      >(
        `/conversations/${encodeURIComponent(
          conversation.id,
        )}/messages`,
        accessToken,
        { body },
        Crypto.randomUUID(),
        { 'If-Match': String(conversation.version) },
      );

      setDraft('');
      setConversation((current) => {
        if (!current) return current;

        const alreadyPresent = current.messages.some(
          (message) => message.id === response.data.id,
        );

        return {
          ...current,
          version: response.data.conversation_version,
          last_message_at: response.data.sent_at,
          messages: alreadyPresent
            ? current.messages
            : [...current.messages, response.data],
        };
      });

      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (
          error.status === 401 ||
          error.code === 'authentication_required'
        ) {
          await signOut();
          return;
        }

        if (
          error.code === 'version_conflict' ||
          error.code === 'state_conflict' ||
          error.code === 'conversation_closed'
        ) {
          await load('refresh');
          setErrorMessage(
            error.code === 'version_conflict'
              ? 'The conversation updated. Your message was not sent; review the latest messages and try again.'
              : error.message,
          );
          return;
        }

        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to send your message.');
      }
    } finally {
      setIsSending(false);
    }
  }

  function confirmKindClose() {
    if (!conversation || isClosing || !canKindClose) return;

    Alert.alert(
      'Close this conversation?',
      'This ends the conversation for both of you, cancels any active date plan, and releases both introduction slots. Your messages remain private.',
      [
        { text: 'Keep conversation', style: 'cancel' },
        {
          text: 'Close conversation',
          style: 'destructive',
          onPress: () => void kindClose(),
        },
      ],
    );
  }

  async function kindClose() {
    if (
      !conversation ||
      !accessToken ||
      isClosing ||
      !canKindClose
    ) {
      return;
    }

    setIsClosing(true);
    setErrorMessage('');

    try {
      const response = await apiPost<
        ClosedConversationEnvelope,
        ConversationCloseRequest
      >(
        `/conversations/${encodeURIComponent(
          conversation.id,
        )}/close`,
        accessToken,
        { reason: null },
        Crypto.randomUUID(),
        { 'If-Match': String(conversation.version) },
      );

      setConversation(response.data);
      setDraft('');
      Alert.alert(
        'Conversation closed',
        'Both introduction slots are now available again.',
      );
    } catch (error) {
      if (error instanceof ApiError) {
        if (
          error.status === 401 ||
          error.code === 'authentication_required'
        ) {
          await signOut();
          return;
        }

        if (
          error.code === 'version_conflict' ||
          error.code === 'state_conflict'
        ) {
          await load('refresh');
        }

        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to close this conversation.');
      }
    } finally {
      setIsClosing(false);
    }
  }

  if (isLoading) {
    return (
      <AppScreen includeBottomInset>
        <Header title="Conversation" />
        <LoadingState label="Opening your private conversation…" />
      </AppScreen>
    );
  }

  if (!conversation) {
    return (
      <AppScreen includeBottomInset>
        <Header title="Conversation" />
        <ErrorState
          body={errorMessage}
          onRetry={() => void load('initial')}
          title="This conversation could not be opened"
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen includeBottomInset>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.keyboardView}
      >
        <Header
          subtitle={
            expiry && isOpen
              ? `Open through ${expiry}`
              : undefined
          }
          title={counterpartName}
        />

        <FlatList
          ref={listRef}
          contentContainerStyle={[
            styles.messages,
            conversation.messages.length === 0 &&
              styles.emptyMessages,
          ]}
          data={conversation.messages}
          keyExtractor={(message) => message.id}
          onContentSizeChange={() => {
            if (conversation.messages.length > 0) {
              listRef.current?.scrollToEnd({
                animated: false,
              });
            }
          }}
          onRefresh={() => void load('refresh')}
          refreshing={isRefreshing}
          renderItem={({ item }) => (
            <MessageBubble message={item} />
          )}
          ListHeaderComponent={
            isOpen && conversation.messages.length <= 3 ? (
              <ConversationCoach
                name={counterpartName}
                onChoose={(suggestion) => {
                  setDraft(suggestion);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
                suggestions={conversationStarters}
              />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.matchIcon}>
                <Ionicons
                  color={palette.sage}
                  name="heart"
                  size={24}
                />
              </View>
              <Text style={styles.emptyTitle}>
                The interest is mutual.
              </Text>
              <Text style={styles.emptyBody}>
                Start with something thoughtful and specific
                from their introduction.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        {canProposeDate ? (
          <View style={styles.dateActionCard}>
            <View style={styles.dateActionIcon}>
              <Ionicons
                color={palette.sage}
                name="calendar-outline"
                size={20}
              />
            </View>
            <View style={styles.dateActionCopy}>
              <Text style={styles.dateActionTitle}>
                Ready to meet?
              </Text>
              <Text style={styles.dateActionBody}>
                Propose a date and time for {counterpartName}.
              </Text>
            </View>
            <Pressable
              onPress={() =>
                router.push(
                  {
                    pathname:
                      '/schedule-date/[conversationId]',
                    params: {
                      conversationId: conversation.id,
                    },
                  } as Href,
                )
              }
              style={styles.dateActionButton}
            >
              <Text style={styles.dateActionButtonText}>Plan</Text>
            </Pressable>
          </View>
        ) : conversation.date_id ? (
          <Pressable
            onPress={() =>
              router.push(
                {
                  pathname: '/date/[id]',
                  params: { id: conversation.date_id },
                } as Href,
              )
            }
            style={styles.viewDateCard}
          >
            <Ionicons
              color="#365C4D"
              name="calendar"
              size={20}
            />
            <View style={styles.viewDateCopy}>
              <Text style={styles.viewDateTitle}>
                View your date plan
              </Text>
              <Text style={styles.viewDateBody}>
                Review the proposal or confirmed details.
              </Text>
            </View>
            <Ionicons
              color={palette.ink}
              name="chevron-forward"
              size={20}
            />
          </Pressable>
        ) : null}

        {canKindClose ? (
          <Pressable
            accessibilityRole="button"
            disabled={isClosing}
            onPress={confirmKindClose}
            style={[
              styles.kindCloseAction,
              isClosing && styles.kindCloseActionDisabled,
            ]}
          >
            {isClosing ? (
              <ActivityIndicator color="#665E57" size="small" />
            ) : (
              <Ionicons
                color="#665E57"
                name="hand-left-outline"
                size={18}
              />
            )}
            <Text style={styles.kindCloseActionText}>
              {isClosing
                ? 'Closing conversation…'
                : 'Close conversation kindly'}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() =>
            router.push(
              {
                pathname:
                  '/report-safety/[conversationId]',
                params: {
                  conversationId: conversation.id,
                  ...(conversation.date_id
                    ? { dateId: conversation.date_id }
                    : {}),
                },
              } as Href,
            )
          }
          style={styles.safetyAction}
        >
          <Ionicons
            color={palette.danger}
            name="shield-outline"
            size={18}
          />
          <Text style={styles.safetyActionText}>
            Report a safety concern
          </Text>
        </Pressable>

        {isOpen ? (
          <View>
            {draftReview ? (
              <View
                accessibilityLiveRegion="polite"
                style={styles.draftReview}
              >
                <Ionicons
                  color={palette.amber}
                  name="heart-outline"
                  size={16}
                />
                <Text style={styles.draftReviewText}>{draftReview}</Text>
              </View>
            ) : null}
            <View style={styles.composer}>
              <TextInput
                accessibilityLabel="Message"
                editable={!isSending}
                maxLength={4000}
                multiline
                onChangeText={setDraft}
                onSubmitEditing={() => {
                  if (canSend) void sendMessage();
                }}
                placeholder={`Message ${counterpartName}`}
                placeholderTextColor={palette.subtle}
                ref={inputRef}
                returnKeyType="send"
                style={styles.input}
                value={draft}
              />

              <Pressable
                accessibilityLabel="Send message"
                accessibilityRole="button"
                disabled={!canSend}
                onPress={() => void sendMessage()}
                style={[
                  styles.sendButton,
                  !canSend && styles.sendButtonDisabled,
                ]}
              >
                {isSending ? (
                  <ActivityIndicator color={palette.white} size="small" />
                ) : (
                  <Ionicons
                    color={palette.white}
                    name="arrow-up"
                    size={21}
                  />
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.closedBanner}>
            <Ionicons
              color="#665E57"
              name="lock-closed-outline"
              size={18}
            />
            <Text style={styles.closedText}>
              This conversation is closed.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function ConversationCoach({
  name,
  suggestions,
  onChoose,
}: {
  name: string;
  suggestions: string[];
  onChoose: (suggestion: string) => void;
}) {
  return (
    <View style={styles.coachCard}>
      <View style={styles.coachHeader}>
        <View style={styles.coachIcon}>
          <Ionicons
            color={palette.brand}
            name="sparkles-outline"
            size={19}
          />
        </View>
        <View style={styles.coachHeaderCopy}>
          <Text style={styles.coachEyebrow}>PRIVATE CONVERSATION COACH</Text>
          <Text style={styles.coachTitle}>
            A thoughtful way to start with {name}
          </Text>
        </View>
      </View>
      <Text style={styles.coachBody}>
        These ideas are created on your device from the profile Vouch already
        shared with you. Tap one to edit it in your own voice.
      </Text>
      <View style={styles.coachSuggestions}>
        {suggestions.map((suggestion) => (
          <Pressable
            accessibilityHint="Adds this suggestion to your message draft"
            accessibilityRole="button"
            key={suggestion}
            onPress={() => onChoose(suggestion)}
            style={({ pressed }) => [
              styles.coachSuggestion,
              pressed && styles.coachSuggestionPressed,
            ]}
          >
            <Text style={styles.coachSuggestionText}>{suggestion}</Text>
            <Ionicons
              color={palette.brand}
              name="add-circle-outline"
              size={19}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MessageBubble({
  message,
}: {
  message: ConversationMessage;
}) {
  return (
    <View
      style={[
        styles.messageRow,
        message.is_mine
          ? styles.myMessageRow
          : styles.theirMessageRow,
      ]}
    >
      <View
        style={[
          styles.bubble,
          message.is_mine
            ? styles.myBubble
            : styles.theirBubble,
        ]}
      >
        <Text
          style={[
            styles.messageBody,
            message.is_mine && styles.myMessageBody,
          ]}
        >
          {message.body}
        </Text>
        <Text
          style={[
            styles.messageTime,
            message.is_mine && styles.myMessageTime,
          ]}
        >
          {formatTime(message.sent_at)}
        </Text>
      </View>
    </View>
  );
}

function Header({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return <StackHeader subtitle={subtitle} title={title} />;
}

const styles = StyleSheet.create({
  keyboardView: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: layout.contentMaxWidth,
    width: '100%',
  },
  messages: {
    gap: 10,
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  emptyMessages: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 34,
  },
  matchIcon: {
    alignItems: 'center',
    backgroundColor: palette.sageSoft,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 18,
    textAlign: 'center',
  },
  emptyBody: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 9,
    textAlign: 'center',
  },
  coachCard: {
    backgroundColor: palette.brandSoft,
    borderColor: palette.brandSoftStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 16,
    padding: 14,
  },
  coachHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  coachIcon: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radius.sm,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  coachHeaderCopy: {
    flex: 1,
  },
  coachEyebrow: {
    color: palette.brand,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  coachTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 2,
  },
  coachBody: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  coachSuggestions: {
    gap: 7,
    marginTop: 11,
  },
  coachSuggestion: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  coachSuggestionPressed: {
    opacity: 0.74,
  },
  coachSuggestionText: {
    color: palette.inkSoft,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  messageRow: { width: '100%' },
  myMessageRow: { alignItems: 'flex-end' },
  theirMessageRow: { alignItems: 'flex-start' },
  bubble: {
    borderRadius: radius.md,
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myBubble: {
    backgroundColor: palette.brand,
    borderBottomRightRadius: 5,
  },
  theirBubble: {
    backgroundColor: palette.surface,
    borderBottomLeftRadius: 5,
    borderColor: palette.border,
    borderWidth: 1,
  },
  messageBody: {
    color: palette.ink,
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageBody: { color: palette.white },
  messageTime: {
    color: palette.subtle,
    fontSize: 10,
    marginTop: 5,
    textAlign: 'right',
  },
  myMessageTime: { color: '#D8D0C9' },
  dateActionCard: {
    alignItems: 'center',
    backgroundColor: palette.sageSoft,
    borderTopColor: '#C9DCD2',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateActionIcon: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  dateActionCopy: { flex: 1 },
  dateActionTitle: {
    color: palette.sage,
    fontSize: 14,
    fontWeight: '800',
  },
  dateActionBody: {
    color: palette.inkSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  dateActionButton: {
    alignItems: 'center',
    backgroundColor: palette.brand,
    borderRadius: radius.sm,
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  dateActionButtonText: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '800',
  },
  viewDateCard: {
    alignItems: 'center',
    backgroundColor: palette.sageSoft,
    borderTopColor: '#C9DCD2',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  viewDateCopy: { flex: 1 },
  viewDateTitle: {
    color: palette.sage,
    fontSize: 14,
    fontWeight: '800',
  },
  viewDateBody: {
    color: palette.inkSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  safetyAction: {
    alignItems: 'center',
    backgroundColor: palette.dangerSoft,
    borderTopColor: palette.brandSoftStrong,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  safetyActionText: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  kindCloseAction: {
    alignItems: 'center',
    backgroundColor: palette.canvasStrong,
    borderTopColor: palette.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  kindCloseActionDisabled: { opacity: 0.55 },
  kindCloseActionText: {
    color: '#665E57',
    fontSize: 13,
    fontWeight: '800',
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: palette.surface,
    borderTopColor: palette.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  draftReview: {
    alignItems: 'flex-start',
    backgroundColor: palette.amberSoft,
    borderTopColor: '#E6D5B5',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  draftReviewText: {
    color: palette.amber,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    backgroundColor: palette.canvas,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: palette.ink,
    flex: 1,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 46,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: palette.brand,
    borderRadius: 23,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  sendButtonDisabled: { opacity: 0.35 },
  errorBanner: {
    backgroundColor: palette.dangerSoft,
    borderTopColor: palette.brandSoftStrong,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: palette.danger,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  closedBanner: {
    alignItems: 'center',
    backgroundColor: palette.canvasStrong,
    borderTopColor: palette.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    padding: 16,
  },
  closedText: {
    color: '#665E57',
    fontSize: 14,
    fontWeight: '700',
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
    marginTop: 16,
  },
  eyebrow: {
    color: '#766E67',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  errorTitle: {
    color: '#171717',
    fontSize: 28,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  errorBody: {
    color: '#68635D',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#352D28',
    borderRadius: 10,
    height: 52,
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 28,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
