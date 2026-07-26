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
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
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

import { ApiError, apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import type {
  Conversation,
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

export default function ConversationScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { session, signOut } = useAuth();
  const listRef = useRef<FlatList<ConversationMessage>>(null);

  const [conversation, setConversation] =
    useState<Conversation | null>(null);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
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

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'poll' = 'refresh') => {
      if (!id || !session?.access_token) {
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
          session.access_token,
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
    [id, session?.access_token, signOut],
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
  const canSend =
    Boolean(isOpen) &&
    draft.trim().length > 0 &&
    !isSending;

  async function sendMessage() {
    const body = draft.trim();

    if (
      !conversation ||
      !session?.access_token ||
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
        session.access_token,
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header title="Conversation" />
        <View style={styles.center}>
          <ActivityIndicator color="#352D28" size="large" />
          <Text style={styles.helper}>
            Opening your conversation…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!conversation) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header title="Conversation" />
        <View style={styles.center}>
          <Text style={styles.eyebrow}>UNAVAILABLE</Text>
          <Text style={styles.errorTitle}>
            This conversation could not be opened.
          </Text>
          <Text style={styles.errorBody}>{errorMessage}</Text>
          <Pressable
            onPress={() => void load('initial')}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
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
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.matchIcon}>
                <Ionicons
                  color="#365C4D"
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
                color="#365C4D"
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
              color="#352D28"
              name="chevron-forward"
              size={20}
            />
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
            color="#943D35"
            name="shield-outline"
            size={18}
          />
          <Text style={styles.safetyActionText}>
            Report a safety concern
          </Text>
        </Pressable>

        {isOpen ? (
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
              placeholderTextColor="#918A83"
              returnKeyType="send"
              style={styles.input}
              value={draft}
            />

            <Pressable
              accessibilityLabel="Send message"
              disabled={!canSend}
              onPress={() => void sendMessage()}
              style={[
                styles.sendButton,
                !canSend && styles.sendButtonDisabled,
              ]}
            >
              {isSending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons
                  color="#FFFFFF"
                  name="arrow-up"
                  size={21}
                />
              )}
            </Pressable>
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
    </SafeAreaView>
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
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <Ionicons
          color="#352D28"
          name="chevron-back"
          size={25}
        />
      </Pressable>

      <View style={styles.headerCopy}>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        ) : null}
      </View>

      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F7F4EF',
    flex: 1,
  },
  keyboardView: { flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomColor: '#E5DFD8',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerCopy: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  headerTitle: {
    color: '#1D1B19',
    fontSize: 17,
    fontWeight: '700',
    maxWidth: '100%',
  },
  headerSubtitle: {
    color: '#746D66',
    fontSize: 11,
    marginTop: 2,
  },
  headerSpacer: { width: 40 },
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
    backgroundColor: '#E5ECE8',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  emptyTitle: {
    color: '#1F1D1B',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 18,
    textAlign: 'center',
  },
  emptyBody: {
    color: '#6F6861',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 9,
    textAlign: 'center',
  },
  messageRow: { width: '100%' },
  myMessageRow: { alignItems: 'flex-end' },
  theirMessageRow: { alignItems: 'flex-start' },
  bubble: {
    borderRadius: 16,
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myBubble: {
    backgroundColor: '#352D28',
    borderBottomRightRadius: 5,
  },
  theirBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 5,
    borderColor: '#E3DDD6',
    borderWidth: 1,
  },
  messageBody: {
    color: '#26221F',
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageBody: { color: '#FFFFFF' },
  messageTime: {
    color: '#8A837C',
    fontSize: 10,
    marginTop: 5,
    textAlign: 'right',
  },
  myMessageTime: { color: '#D8D0C9' },
  dateActionCard: {
    alignItems: 'center',
    backgroundColor: '#E8ECE9',
    borderTopColor: '#D4DED8',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateActionIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  dateActionCopy: { flex: 1 },
  dateActionTitle: {
    color: '#29483B',
    fontSize: 14,
    fontWeight: '800',
  },
  dateActionBody: {
    color: '#60736B',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  dateActionButton: {
    alignItems: 'center',
    backgroundColor: '#352D28',
    borderRadius: 9,
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  dateActionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  viewDateCard: {
    alignItems: 'center',
    backgroundColor: '#E8ECE9',
    borderTopColor: '#D4DED8',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  viewDateCopy: { flex: 1 },
  viewDateTitle: {
    color: '#29483B',
    fontSize: 14,
    fontWeight: '800',
  },
  viewDateBody: {
    color: '#60736B',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  safetyAction: {
    alignItems: 'center',
    backgroundColor: '#F8EFED',
    borderTopColor: '#E6C8C3',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  safetyActionText: {
    color: '#943D35',
    fontSize: 13,
    fontWeight: '800',
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E2DCD5',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    backgroundColor: '#F4F1ED',
    borderColor: '#DDD7D0',
    borderRadius: 16,
    borderWidth: 1,
    color: '#1F1D1B',
    flex: 1,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 46,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#352D28',
    borderRadius: 23,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  sendButtonDisabled: { opacity: 0.35 },
  errorBanner: {
    backgroundColor: '#F6E9E6',
    borderTopColor: '#E8CAC5',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: '#8D3933',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  closedBanner: {
    alignItems: 'center',
    backgroundColor: '#EEEAE5',
    borderTopColor: '#DED7D0',
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
