import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { api } from './api/client';
import { useAuth } from './context/AuthContext';

const THEME = {
  bg: "#F5F7F5",
  card: "#FFFFFF",
  primary: "#059669",
  text: "#1A1A1A",
  subText: "#666666",
  searchBg: "#E0E0E0",
  iconPlaceholder: "#E0E0E0"
};

export default function ChatList2({ navigation }: any) {
  const { user } = useAuth();
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadChatSessions = async () => {
    try {
      setLoading(true);
      const sessions = await api.getChatSessions();
      console.log("Chat sessions received:", JSON.stringify(sessions, null, 2));
      // Filter to only show enabled chat sessions
      const enabledSessions = (sessions || []).filter((s: any) => s.is_enabled === true);
      console.log("Enabled sessions:", enabledSessions.length);
      setChatSessions(enabledSessions);
    } catch (e: any) {
      console.error("Failed to load chat sessions:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadChatSessions();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadChatSessions();
  };

  const getOtherParty = (session: any) => {
    if (user?.role === 'caregiver') {
      return session.care_recipient || {};
    } else {
      return session.caregiver || {};
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredSessions = chatSessions.filter((session) => {
    if (!searchQuery) return true;
    const otherParty = getOtherParty(session);
    const name = otherParty.full_name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const renderItem = ({ item }: any) => {
    const otherParty = getOtherParty(item);
    console.log("Rendering item:", item.id, "Other party:", otherParty);
    const name = otherParty?.full_name || otherParty?.name || 'Unknown';
    const avatarUrl = otherParty?.profile_photo_url;
    const role = user?.role === 'caregiver' ? 'CARE RECIPIENT' : 'CAREGIVER';
    const roleColor = user?.role === 'caregiver' ? '#F3E5F5' : '#E8F5E9';
    const roleTextColor = user?.role === 'caregiver' ? '#6A1B9A' : '#2E7D32';

    return (
      <TouchableOpacity
        style={styles.chatCard}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ChatDetailsScreen', {
          chatSessionId: item.id,
          otherPartyName: name,
          otherPartyAvatar: avatarUrl || null,
        })}
      >
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Icon name="account" size={24} color="#6B7280" />
            </View>
          )}
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.time}>{formatTime(item.updated_at || item.created_at)}</Text>
          </View>

          <View style={[styles.roleBadge, { backgroundColor: roleColor }]}>
            <Text style={[styles.roleText, { color: roleTextColor }]}>{role}</Text>
          </View>

          <View style={styles.messageRow}>
            <Text style={styles.message} numberOfLines={1}>
              {item.last_message || 'No messages yet'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Messages</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={THEME.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.bg} />
      
      <View style={styles.header}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10}}>
             <Ionicons name="arrow-back" size={28} color={THEME.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Messages</Text>
        </View>
        <TouchableOpacity style={styles.editBtn}>
          <Icon name="square-edit-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color={THEME.subText} style={{ marginRight: 10 }} />
        <TextInput 
          placeholder="Search conversations..." 
          placeholderTextColor={THEME.subText}
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {filteredSessions.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Icon name="message-outline" size={64} color={THEME.subText} />
          <Text style={{ marginTop: 16, color: THEME.subText, fontSize: 16, textAlign: 'center' }}>
            {searchQuery ? 'No conversations found' : 'No active conversations yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredSessions}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: THEME.text },
  editBtn: { padding: 8, borderRadius: 12, backgroundColor: THEME.primary, elevation: 4 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.searchBg, marginHorizontal: 20, borderRadius: 25, paddingHorizontal: 15, height: 50, marginBottom: 20 },
  searchInput: { flex: 1, color: THEME.text, fontSize: 16 },
  chatCard: { flexDirection: 'row', backgroundColor: THEME.card, marginHorizontal: 16, marginBottom: 12, borderRadius: 20, padding: 16, alignItems: 'center', elevation: 2 },
  avatarContainer: { position: 'relative', marginRight: 15 },
  avatar: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: THEME.iconPlaceholder },
  avatarPlaceholder: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatContent: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { color: THEME.text, fontSize: 16, fontWeight: '700' },
  time: { color: THEME.subText, fontSize: 12, fontWeight: '500' },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 6 },
  roleText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  messageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  message: { color: THEME.subText, fontSize: 14, flex: 1, marginRight: 10 },
});
