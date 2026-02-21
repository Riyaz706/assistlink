import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { api } from './api/client';
import { useAuth } from './context/AuthContext';
import { useErrorHandler } from './hooks/useErrorHandler';
import { useIsFocused } from '@react-navigation/native';

const THEME = {
  bg: "#F5F7F5",
  primary: "#059669",
  white: "#FFFFFF",
  text: "#1A1A1A",
  grayText: "#666666",
  inputBg: "#F0F0F0",
  sentBubble: "#059669",
  receivedBubble: "#FFFFFF"
};

const ChatDetailsScreen = ({ route, navigation }: any) => {
  const { user } = useAuth();
  const { chatSessionId, otherPartyName: initialName, otherPartyAvatar: initialAvatar } = route.params || {};

  const [otherPartyName, setOtherPartyName] = useState(initialName);
  const [otherPartyAvatar, setOtherPartyAvatar] = useState(initialAvatar);

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const isFocused = useIsFocused();
  const scrollViewRef = useRef<ScrollView>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageCountRef = useRef(0);

  const { error, handleError, clearError } = useErrorHandler();

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) clearError();
      const data = await api.getMessages(chatSessionId, { limit: 100 });
      const newMessages = (data as any[]) || [];

      setMessages(prev => {
        // If we have optimistic messages, we need to reconcile or just replace
        // For simplicity with polling, we replace but keep the optimistic ones if they haven't landed yet
        return newMessages;
      });

      // Mark messages as read ONLY IF focused
      if (isFocused && newMessages.length > 0) {
        const hasUnread = newMessages.some(m => !isMyMessage(m) && !m.read_at);
        if (hasUnread) {
          try {
            await api.markMessagesAsRead(chatSessionId);
          } catch (e) {
            console.log("Failed to mark messages read", e);
          }
        }
      }

      // Scroll if new messages arrived
      if (newMessages.length > lastMessageCountRef.current) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
      lastMessageCountRef.current = newMessages.length;
    } catch (e: any) {
      if (!silent) handleError(e, 'chat-load-messages');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadSessionDetails = async () => {
    if (otherPartyName) return; // Already have details

    try {
      const session = await api.getChatSession(chatSessionId) as any;
      if (session) {
        // Determine other party based on current user
        const other = user?.role === 'care_recipient' ? session.caregiver : session.care_recipient;
        if (other) {
          setOtherPartyName(other.full_name || other.name || 'User');
          setOtherPartyAvatar(other.profile_photo_url);
        }
      }
    } catch (e) {
      // Non-critical, log but don't show user error
      console.error("Failed to load session details:", e);
    }
  };

  useEffect(() => {
    if (chatSessionId) {
      loadMessages();
      loadSessionDetails();

      // Poll for new messages every 3 seconds when focused
      pollIntervalRef.current = setInterval(async () => {
        if (isFocused) {
          await loadMessages(true);
        }
      }, 3000);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [chatSessionId, isFocused]);

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    const messageText = inputText.trim();
    const tempId = `temp-${Date.now()}`;

    // Optimistic Update
    const optimisticMessage = {
      id: tempId,
      content: messageText,
      sender_id: user?.id,
      created_at: new Date().toISOString(),
      sending: true
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setInputText('');
    setSending(true);
    clearError();

    try {
      await api.sendMessage(chatSessionId, { content: messageText });
      await loadMessages(true);
    } catch (e: any) {
      handleError(e, 'chat-send-message');
      setInputText(messageText); // Restore text on error
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const isMyMessage = (message: any) => {
    return message.sender_id === user?.id || message.sender?.id === user?.id;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={24} color={THEME.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={THEME.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.white} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={THEME.text} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{otherPartyName || 'Chat'}</Text>
        </View>

        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn}>
            <Icon name="phone-outline" size={24} color={THEME.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, styles.videoBtn]}
            onPress={async () => {
              if (!chatSessionId) {
                alert('Cannot start video call: chat session not found.');
                return;
              }
              try {
                setLoading(true);
                clearError();
                const videoCall = await api.createVideoCallFromChat(chatSessionId) as { id: string; video_call_url?: string };
                const callId = videoCall?.id;
                if (!callId) {
                  alert('Failed to start video call. Please try again.');
                  return;
                }
                navigation.navigate('VideoCallScreen', {
                  callId,
                  otherPartyName: otherPartyName || 'User',
                });
              } catch (e: any) {
                console.error('Video call from chat failed:', e);
                handleError(e, 'video-call-from-chat');
                alert(e?.message || 'Failed to start video call. Please try again.');
              } finally {
                setLoading(false);
              }
            }}
            accessibilityLabel="Start video call"
            accessibilityRole="button"
          >
            <Icon name="video-outline" size={24} color={THEME.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 20 }}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
            </View>
          ) : (
            messages.map((message, index) => {
              const isMine = isMyMessage(message);
              const showAvatar = !isMine && (index === 0 || !isMyMessage(messages[index - 1]));

              return (
                <View
                  key={message.id}
                  style={[
                    styles.msgContainer,
                    isMine ? styles.msgContainerRight : styles.msgContainerLeft
                  ]}
                >
                  {!isMine && showAvatar && (
                    otherPartyAvatar && !otherPartyAvatar.includes('pravatar.cc') ? (
                      <Image
                        source={{ uri: otherPartyAvatar }}
                        style={styles.avatarSmall}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Icon name="account" size={16} color="#6B7280" />
                      </View>
                    )
                  )}
                  {!isMine && !showAvatar && <View style={styles.avatarPlaceholder} />}

                  <View style={isMine ? styles.bubbleRight : styles.bubbleLeft}>
                    <Text style={isMine ? styles.textRight : styles.textLeft}>
                      {message.content}
                    </Text>
                    <View style={isMine ? styles.readContainer : styles.timeContainer}>
                      <Text style={isMine ? styles.timeRight : styles.timeLeft}>
                        {formatTime(message.created_at)}
                      </Text>
                      {isMine && (
                        <Icon
                          name={message.read_at ? "check-all" : "check"}
                          size={14}
                          color="rgba(0,0,0,0.6)"
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.plusBtn}>
              <Icon name="plus" size={24} color={THEME.grayText} />
            </TouchableOpacity>

            <View style={styles.inputContainer}>
              <TextInput
                placeholder="Type a message..."
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity>
                <Icon name="emoticon-happy-outline" size={20} color={THEME.grayText} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim() || sending}
              accessibilityLabel={sending ? 'Sending message' : 'Send message'}
              accessibilityRole="button"
              accessibilityState={{ disabled: !inputText.trim() || sending }}
            >
              {sending ? (
                <ActivityIndicator size="small" color={THEME.white} />
              ) : (
                <Icon name="send" size={20} color={THEME.white} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.secureRow}>
            <Icon name="lock" size={10} color="#999" />
            <Text style={styles.secureText}> Messages are secure. Do not share financial info.</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backBtn: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.text,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconBtn: {
    marginLeft: 16,
  },
  videoBtn: {
    backgroundColor: '#E8F5E9',
    padding: 6,
    borderRadius: 20,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: THEME.grayText,
    fontSize: 16,
    textAlign: 'center',
  },
  msgContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  msgContainerLeft: {
    justifyContent: 'flex-start',
  },
  msgContainerRight: {
    justifyContent: 'flex-end',
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleLeft: {
    backgroundColor: THEME.white,
    padding: 12,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    maxWidth: '75%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    elevation: 1,
  },
  bubbleRight: {
    backgroundColor: THEME.sentBubble,
    padding: 12,
    borderRadius: 16,
    borderTopRightRadius: 4,
    maxWidth: '75%',
  },
  textLeft: {
    color: THEME.text,
    fontSize: 15,
    lineHeight: 20,
  },
  textRight: {
    color: '#000',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  timeContainer: {
    marginTop: 4,
  },
  readContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timeLeft: {
    fontSize: 10,
    color: '#999',
  },
  timeRight: {
    fontSize: 10,
    color: 'rgba(0,0,0,0.6)',
  },
  footer: {
    backgroundColor: THEME.white,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
  },
  plusBtn: {
    marginRight: 10,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    paddingHorizontal: 16,
    minHeight: 44,
    maxHeight: 100,
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#333',
    fontSize: 15,
    paddingVertical: 10,
  },
  sendBtn: {
    backgroundColor: THEME.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  secureRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  secureText: {
    fontSize: 10,
    color: '#999',
  }
});

export default ChatDetailsScreen;

