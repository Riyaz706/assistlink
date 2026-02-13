import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  ListRenderItem,
  Image,
  StatusBar,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

// --- THEME FROM ChatDetailScreen ---
const THEME = {
  bg: "#F5F7F5",
  primary: "#059669", // Bright Green
  white: "#FFFFFF",
  text: "#1A1A1A",
  grayText: "#666666",
  inputBg: "#F0F0F0",
  sentBubble: "#059669",
  receivedBubble: "#FFFFFF"
};

// --- TYPES ---
interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  time: string;
}

interface Props {
  route: any; 
  navigation: any; 
}

export default function ChatDetailScreen2({ route, navigation }: Props) {
  const { name } = route.params || { name: 'Chat' };
  
  const [message, setMessage] = useState<string>('');
  
  // Initial Dummy Data
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: 'Hi! I see you need assistance with meal prep. Do you have specific dietary restrictions?', sender: 'them', time: '9:42 AM' },
    { id: '2', text: 'Yes, low sodium please. Also, the gate code is 1234.', sender: 'me', time: '9:45 AM' },
  ]);

  const sendMessage = () => {
    if (message.trim()) {
      const newMessage: Message = { 
        id: Date.now().toString(), 
        text: message, 
        sender: 'me',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([...messages, newMessage]);
      setMessage('');
    }
  };

  // --- RENDER ITEM (Bubbles) ---
  const renderItem: ListRenderItem<Message> = ({ item }) => {
    if (item.sender === 'me') {
      // SENT MESSAGE STYLE
      return (
        <View style={styles.msgContainerRight}>
          <View style={styles.bubbleRight}>
            <Text style={styles.textRight}>{item.text}</Text>
            <View style={styles.readContainer}>
              <Text style={styles.timeRight}>{item.time}</Text>
              <Icon name="check-all" size={14} color="black" style={{ marginLeft: 4 }} />
            </View>
          </View>
        </View>
      );
    } else {
      // RECEIVED MESSAGE STYLE
      return (
        <View style={styles.msgContainerLeft}>
          <View style={styles.avatarPlaceholder}>
            <Icon name="account" size={16} color="#6B7280" />
          </View>
          <View>
            <Text style={styles.senderName}>{name}</Text>
            <View style={styles.bubbleLeft}>
              <Text style={styles.textLeft}>{item.text}</Text>
              <Text style={styles.timeLeft}>{item.time}</Text>
            </View>
          </View>
        </View>
      );
    }
  };

  // --- HEADER COMPONENT FOR FLATLIST (Banners etc) ---
  const ListHeader = () => (
    <View style={{ marginBottom: 10 }}>
       {/* SERVICE REQUEST BANNER */}
       <View style={styles.banner}>
        <View style={styles.bannerRow}>
          <Icon name="calendar-clock" size={20} color={THEME.primary} style={{ marginRight: 8 }} />
          <View>
            <Text style={styles.bannerTitle}>Oct 24 • 2:00 PM</Text>
            <Text style={styles.bannerSub}>2 hours • Bathing Assistance</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.detailsBtn}>
          <Text style={styles.detailsText}>Details</Text>
          <Icon name="arrow-right" size={16} color={THEME.primary} />
        </TouchableOpacity>
      </View>

      {/* SYSTEM MESSAGE */}
      <Text style={styles.systemMessage}>Service request accepted • Today 9:41 AM</Text>

      {/* VIDEO CALL CARD (Placed here to scroll with list as per original look) */}
      <TouchableOpacity 
        style={styles.videoCallCard}
        onPress={() => navigation.navigate('VideoCallScreen', {
          otherPartyName: name || 'User',
        })}
      >
        <View style={styles.videoIconCircle}>
          <Icon name="video" size={20} color={THEME.white} />
        </View>
        <Text style={styles.videoCallText}>Start Video Call</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.white} />

      {/* --- HEADER --- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={THEME.text} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{name}</Text>
          <View style={styles.onlineContainer}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online</Text>
          </View>
        </View>

        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn}>
            <Icon name="phone-outline" size={24} color={THEME.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.iconBtn, styles.videoBtn]}
            onPress={() => navigation.navigate('VideoCallScreen', {
              otherPartyName: name || 'User',
            })}
          >
            <Icon name="video-outline" size={24} color={THEME.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* --- MESSAGES LIST --- */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.content}
        />

        {/* --- FOOTER ACTIONS --- */}
        <View style={styles.footer}>
          {/* Quick Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            <TouchableOpacity style={styles.chip}><Text style={styles.chipText}>Confirm Time</Text></TouchableOpacity>
            <TouchableOpacity style={styles.chip}><Text style={styles.chipText}>Share Location</Text></TouchableOpacity>
            <TouchableOpacity style={styles.chip}><Text style={styles.chipText}>Parking Info</Text></TouchableOpacity>
          </ScrollView>

          {/* Input Area */}
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.plusBtn}>
              <Icon name="plus" size={24} color={THEME.grayText} />
            </TouchableOpacity>
            
            <View style={styles.inputContainer}>
              <TextInput 
                placeholder="Type a message..." 
                style={styles.input} 
                value={message}
                onChangeText={setMessage}
              />
              <Icon name="emoticon-happy-outline" size={20} color={THEME.grayText} />
            </View>

            <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
              <Icon name="send" size={20} color={THEME.white} />
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
}

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
  onlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.primary,
    marginRight: 4,
  },
  onlineText: {
    fontSize: 12,
    color: THEME.grayText,
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
    padding: 16,
    paddingBottom: 20,
  },
  banner: {
    backgroundColor: '#F0FDF4', 
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#14532D',
  },
  bannerSub: {
    fontSize: 12,
    color: '#166534',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsText: {
    color: THEME.primary,
    fontWeight: 'bold',
    marginRight: 4,
  },
  systemMessage: {
    textAlign: 'center',
    color: '#888',
    fontSize: 12,
    marginBottom: 20,
    backgroundColor: '#EFEFEF',
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  msgContainerLeft: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginTop: 18,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginTop: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  senderName: {
    fontSize: 11,
    color: '#888',
    marginLeft: 4,
    marginBottom: 2,
  },
  bubbleLeft: {
    backgroundColor: THEME.white,
    padding: 12,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    maxWidth: '85%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    elevation: 1,
  },
  textLeft: {
    color: THEME.text,
    fontSize: 15,
    lineHeight: 20,
  },
  timeLeft: {
    fontSize: 10,
    color: '#999',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  msgContainerRight: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  bubbleRight: {
    backgroundColor: THEME.sentBubble,
    padding: 12,
    borderRadius: 16,
    borderTopRightRadius: 4,
    maxWidth: '85%',
  },
  textRight: {
    color: '#000', 
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  readContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timeRight: {
    fontSize: 10,
    color: 'rgba(0,0,0,0.6)',
  },
  videoCallCard: {
    backgroundColor: THEME.white,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 0,
    marginBottom: 20,
  },
  videoIconCircle: {
    backgroundColor: THEME.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  videoCallText: {
    fontWeight: 'bold',
    color: '#333',
  },
  footer: {
    backgroundColor: THEME.white,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  chipsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chip: {
    backgroundColor: THEME.white,
    borderWidth: 1,
    borderColor: '#DDD',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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
    height: 44,
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#333',
  },
  sendBtn: {
    backgroundColor: THEME.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secureRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secureText: {
    fontSize: 10,
    color: '#999',
  }
});