import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  Image,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { api } from './api/client';
import { getSupabase, isSupabaseConfigured } from './lib/supabase';
import { useAuth } from './context/AuthContext';
import { useErrorHandler } from './hooks/useErrorHandler';
import { useIsFocused } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import BottomNav from './BottomNav';
import { colors, typography, spacing, borderRadius } from './theme';

const VoiceMessageBubble = ({ url, isMine, onError }: { url: string; isMine: boolean; onError: () => void }) => {
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const playPause = async () => {
    try {
      if (playing && soundRef.current) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
        return;
      }
      if (soundRef.current) {
        await soundRef.current.playAsync();
        setPlaying(true);
        return;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: url });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinishAndNotLooped) {
          setPlaying(false);
          sound.unloadAsync().then(() => { soundRef.current = null; });
        }
      });
      await sound.playAsync();
      setPlaying(true);
    } catch (e) {
      onError();
    }
  };

  return (
    <TouchableOpacity style={styles.voiceBubble} onPress={playPause} activeOpacity={0.7}>
      <Icon name={playing ? 'pause' : 'play'} size={24} color={isMine ? '#000' : THEME.text} />
      <Text style={[styles.voiceLabel, isMine && styles.voiceLabelMine]}>Voice message</Text>
    </TouchableOpacity>
  );
};

const THEME = {
  bg: colors.background,
  primary: colors.primary,
  white: colors.card,
  text: colors.textPrimary,
  grayText: colors.textSecondary,
  inputBg: '#F0F0F0',
  sentBubble: colors.secondary,
  receivedBubble: colors.card,
};

const ChatDetailsScreen = ({ route, navigation }: any) => {
  const { user } = useAuth();
  const isCareRecipient = user?.role === 'care_recipient' || (user as any)?.user_metadata?.role === 'care_recipient';
  const { chatSessionId, otherPartyName: initialName, otherPartyAvatar: initialAvatar } = route.params || {};

  const [otherPartyName, setOtherPartyName] = useState(initialName);
  const [otherPartyAvatar, setOtherPartyAvatar] = useState(initialAvatar);

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
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

  // Typing indicator: broadcast when user types, listen for others
  const broadcastTyping = useCallback((isTyping: boolean) => {
    if (!isSupabaseConfigured() || !chatSessionId) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const ch = supabase.channel(`chat:${chatSessionId}`);
    ch.send({ type: 'broadcast', event: 'typing', payload: { userId: user?.id, typing: isTyping } }).catch(() => {});
  }, [chatSessionId, user?.id]);

  useEffect(() => {
    if (inputText.trim().length > 0) {
      broadcastTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        broadcastTyping(false);
        typingTimeoutRef.current = null;
      }, 2000);
    }
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [inputText, broadcastTyping]);

  useEffect(() => {
    if (chatSessionId) {
      loadMessages();
      loadSessionDetails();

      // Supabase typing + real-time messages
      let ch: any = null;
      if (isSupabaseConfigured()) {
        const supabase = getSupabase();
        if (supabase) {
          ch = supabase.channel(`chat:${chatSessionId}`)
            .on('broadcast', { event: 'typing' }, (payload: { payload?: { userId?: string; typing?: boolean } }) => {
              const p = payload?.payload;
              if (p && p.userId !== user?.id && p.typing) {
                setRemoteTyping(true);
                setTimeout(() => setRemoteTyping(false), 3000);
              }
            })
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `chat_session_id=eq.${chatSessionId}`,
            }, () => {
              loadMessages(true);
            })
            .subscribe();
        }
      }

      // Poll fallback when Supabase Realtime not available or table not replicated
      pollIntervalRef.current = setInterval(async () => {
        if (isFocused) await loadMessages(true);
      }, 5000);

      return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (ch?.unsubscribe) ch.unsubscribe();
      };
    }
  }, [chatSessionId, isFocused, user?.id]);

  const sendVoiceMessage = useCallback(async (audioUri: string) => {
    if (!audioUri || sending) return;
    setSending(true);
    clearError();
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      content: 'Voice message',
      message_type: 'voice',
      attachment_url: null,
      sender_id: user?.id,
      created_at: new Date().toISOString(),
      sending: true,
    };
    setMessages(prev => [...prev, optimisticMessage]);
    try {
      const { url } = await api.uploadChatAttachment(chatSessionId, audioUri, 'voice.m4a', 'audio/mp4');
      await api.sendMessage(chatSessionId, {
        content: 'Voice message',
        message_type: 'voice',
        attachment_url: url,
      });
      await loadMessages(true);
    } catch (e: any) {
      handleError(e, 'chat-send-voice');
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Voice message failed', e?.message || 'Could not send voice message. Try again.');
    } finally {
      setSending(false);
    }
  }, [chatSessionId, user?.id, sending]);

  const startVoiceRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Microphone access', 'Allow microphone access to record voice messages.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setRecording(true);
    } catch (e: any) {
      console.error('Start recording failed:', e);
      Alert.alert('Recording failed', e?.message || 'Could not start recording.');
    }
  }, []);

  const stopVoiceRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    setRecording(false);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (uri) await sendVoiceMessage(uri);
    } catch (e: any) {
      console.error('Stop recording failed:', e);
      recordingRef.current = null;
    }
  }, [sendVoiceMessage]);

  const sendImageMessage = useCallback(async (imageUri: string) => {
    if (!imageUri || sending) return;
    setSending(true);
    clearError();
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      content: 'Photo',
      message_type: 'image',
      attachment_url: imageUri,
      sender_id: user?.id,
      created_at: new Date().toISOString(),
      sending: true,
    };
    setMessages(prev => [...prev, optimisticMessage]);
    try {
      const { url } = await api.uploadChatAttachment(chatSessionId, imageUri, 'photo.jpg', 'image/jpeg');
      await api.sendMessage(chatSessionId, {
        content: 'Photo',
        message_type: 'image',
        attachment_url: url,
      });
      await loadMessages(true);
    } catch (e: any) {
      handleError(e, 'chat-send-image');
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Photo failed', e?.message || 'Could not send photo. Try again.');
    } finally {
      setSending(false);
    }
  }, [chatSessionId, user?.id, sending]);

  const pickAndSendDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      const fileName = asset.name || 'document.pdf';
      const mimeType = asset.mimeType || 'application/pdf';
      if (!asset.uri || sending) return;
      setSending(true);
      clearError();
      const tempId = `temp-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: tempId,
        content: fileName,
        message_type: 'document',
        attachment_url: null,
        sender_id: user?.id,
        created_at: new Date().toISOString(),
        sending: true,
      }]);
      try {
        const { url } = await api.uploadChatAttachment(chatSessionId, asset.uri, fileName, mimeType);
        await api.sendMessage(chatSessionId, {
          content: fileName,
          message_type: 'document',
          attachment_url: url,
        });
        await loadMessages(true);
      } catch (e: any) {
        handleError(e, 'chat-send-document');
        setMessages(prev => prev.filter(m => m.id !== tempId));
        Alert.alert('Document failed', e?.message || 'Could not send document.');
      } finally {
        setSending(false);
      }
    } catch (e: any) {
      console.error('Document pick failed:', e);
      Alert.alert('Error', e?.message || 'Could not pick document.');
    }
  }, [chatSessionId, user?.id, sending]);

  const pickAndSendImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission', 'Allow photo library access to share photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        await sendImageMessage(result.assets[0].uri);
      }
    } catch (e: any) {
      console.error('Image pick failed:', e);
      Alert.alert('Error', e?.message || 'Could not pick image.');
    }
  }, [sendImageMessage]);

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
          {isCareRecipient && (
            <TouchableOpacity
              style={[styles.iconBtn, styles.sosBtn]}
              onPress={() => navigation.navigate('EmergencyScreen')}
              accessibilityLabel="Emergency SOS"
              accessibilityRole="button"
            >
              <Icon name="alert-octagon" size={22} color="#DC2626" />
            </TouchableOpacity>
          )}
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
        {remoteTyping && (
          <View style={styles.typingBanner}>
            <Text style={styles.typingText}>{otherPartyName || 'Someone'} is typing...</Text>
          </View>
        )}
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
                    {message.message_type === 'voice' && message.attachment_url ? (
                      <VoiceMessageBubble
                        url={message.attachment_url}
                        isMine={isMine}
                        onError={() => {}}
                      />
                    ) : message.message_type === 'image' && message.attachment_url ? (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(message.attachment_url)}
                        activeOpacity={0.9}
                      >
                        <Image
                          source={{ uri: message.attachment_url }}
                          style={styles.chatImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ) : message.message_type === 'document' && message.attachment_url ? (
                      <TouchableOpacity
                        style={styles.documentBubble}
                        onPress={() => Linking.openURL(message.attachment_url)}
                        activeOpacity={0.8}
                      >
                        <Icon name="file-document-outline" size={28} color={isMine ? '#000' : THEME.text} />
                        <Text style={[styles.documentLabel, isMine && styles.documentLabelMine]} numberOfLines={2}>
                          {message.content || 'Document'}
                        </Text>
                        <Icon name="download" size={18} color={isMine ? 'rgba(0,0,0,0.6)' : THEME.grayText} />
                      </TouchableOpacity>
                    ) : (
                      <Text style={isMine ? styles.textRight : styles.textLeft}>
                        {message.content}
                      </Text>
                    )}
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
            <TouchableOpacity
              style={styles.plusBtn}
              onPress={pickAndSendImage}
              disabled={sending}
              accessibilityLabel="Attach photo"
              accessibilityRole="button"
            >
              <Icon name="image-plus" size={24} color={THEME.grayText} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.plusBtn}
              onPress={pickAndSendDocument}
              disabled={sending}
              accessibilityLabel="Attach document"
              accessibilityRole="button"
            >
              <Icon name="file-document-outline" size={24} color={THEME.grayText} />
            </TouchableOpacity>

            <Pressable
              style={styles.voiceBtn}
              onPressIn={startVoiceRecording}
              onPressOut={stopVoiceRecording}
              disabled={sending}
              accessibilityLabel={recording ? 'Release to send voice message' : 'Hold to record voice message'}
            >
              <Icon name="microphone" size={22} color={recording ? THEME.primary : THEME.grayText} />
            </Pressable>
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
      <BottomNav />
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
  sosBtn: { marginLeft: 8 },
  videoBtn: {
    backgroundColor: '#E8F5E9',
    padding: 6,
    borderRadius: 20,
  },
  typingBanner: { paddingHorizontal: 16, paddingVertical: 4, backgroundColor: '#F0F0F0' },
  typingText: { fontSize: 12, color: THEME.grayText, fontStyle: 'italic' },
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
  voiceBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceLabel: { fontSize: 14, color: THEME.text },
  voiceLabelMine: { color: '#000', fontWeight: '500' },
  documentBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  documentLabel: { fontSize: 14, color: THEME.text, flex: 1 },
  documentLabelMine: { color: '#000', fontWeight: '500' },
  chatImage: { width: 200, height: 150, borderRadius: 12 },
  footer: {
    backgroundColor: THEME.white,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  voiceBtn: { padding: 8, justifyContent: 'center' },
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

