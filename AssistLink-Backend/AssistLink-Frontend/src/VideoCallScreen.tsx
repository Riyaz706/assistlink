import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  SafeAreaView
} from 'react-native';
import {
  TwilioVideoLocalView,
  TwilioVideoParticipantView,
  TwilioVideo
} from 'react-native-twilio-video-webrtc';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from './api/client';
import { useAuth } from './context/AuthContext';

const { width, height } = Dimensions.get('window');

const VideoCallScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { bookingId } = route.params;
  const { user } = useAuth();

  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isRearCamera, setIsRearCamera] = useState(false);
  const [roomName, setRoomName] = useState<string>('');
  const [videoTracks, setVideoTracks] = useState<Map<string, any>>(new Map());

  const twilioRef = useRef<TwilioVideo>(null);

  useEffect(() => {
    connectToRoom();
    return () => {
      disconnect();
    };
  }, []);

  const connectToRoom = async () => {
    try {
      setStatus('connecting');
      const response = await api.getVideoToken(bookingId);
      setToken(response.token);
      setRoomName(response.room_name);

      twilioRef.current?.connect({
        accessToken: response.token,
        roomName: response.room_name
      });
    } catch (error: any) {
      console.error("Failed to connect:", error);
      Alert.alert("Connection Failed", error.message || "Could not join video call");
      navigation.goBack();
    }
  };

  const disconnect = () => {
    twilioRef.current?.disconnect();
    setStatus('disconnected');
  };

  const handleEndCall = () => {
    disconnect();
    navigation.goBack();
  };

  const _onRoomDidConnect = () => {
    setStatus('connected');
    console.log("Connected to room:", roomName);
  };

  const _onRoomDidDisconnect = ({ error }: any) => {
    console.log("Room disconnected:", error);
    setStatus('disconnected');
    if (error) {
      Alert.alert("Disconnected", error);
    }
    navigation.goBack();
  };

  const _onRoomDidFailToConnect = (error: any) => {
    console.log("Failed to connect:", error);
    setStatus('disconnected');
    Alert.alert("Connection Error", "Failed to connect to room.");
    navigation.goBack();
  };

  const _onParticipantAddedVideoTrack = ({ participant, track }: any) => {
    console.log("Participant added video track:", participant.identity, track);
    setVideoTracks(new Map(videoTracks.set(participant.sid, { ...participant, trackId: track.trackId })));
  };

  const _onParticipantRemovedVideoTrack = ({ participant, track }: any) => {
    console.log("Participant removed video track:", participant.identity, track);
    const newVideoTracks = new Map(videoTracks);
    newVideoTracks.delete(participant.sid);
    setVideoTracks(newVideoTracks);
  };

  const toggleAudio = () => {
    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);
    twilioRef.current?.setLocalAudioEnabled(newState);
  };

  const toggleVideo = () => {
    const newState = !isVideoEnabled;
    setIsVideoEnabled(newState);
    twilioRef.current?.setLocalVideoEnabled(newState);
  };

  const flipCamera = () => {
    twilioRef.current?.flipCamera();
    setIsRearCamera(!isRearCamera);
  };

  return (
    <View style={styles.container}>
      {/* Remote Video(s) */}
      <View style={styles.remoteGrid}>
        {Array.from(videoTracks, ([sid, trackDesc]) => (
          <TwilioVideoParticipantView
            style={styles.remoteVideo}
            key={sid}
            trackIdentifier={{
              participantSid: sid,
              videoTrackSid: trackDesc.trackId
            }}
          />
        ))}
        {videoTracks.size === 0 && status === 'connected' && (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>Waiting for others to join...</Text>
          </View>
        )}
      </View>

      {/* Local Video */}
      <View style={styles.localVideoContainer}>
        <TwilioVideoLocalView
          enabled={true}
          style={styles.localVideo}
        />
      </View>

      {/* Controls */}
      <SafeAreaView style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, !isAudioEnabled && styles.controlButtonDisabled]}
          onPress={toggleAudio}
        >
          <Ionicons name={isAudioEnabled ? "mic" : "mic-off"} size={28} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={handleEndCall}
        >
          <Ionicons name="call" size={32} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !isVideoEnabled && styles.controlButtonDisabled]}
          onPress={toggleVideo}
        >
          <Ionicons name={isVideoEnabled ? "videocam" : "videocam-off"} size={28} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={flipCamera}
        >
          <Ionicons name="camera-reverse" size={28} color="#FFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Twilio Component (Invisible) */}
      <TwilioVideo
        ref={twilioRef}
        onRoomDidConnect={_onRoomDidConnect}
        onRoomDidDisconnect={_onRoomDidDisconnect}
        onRoomDidFailToConnect={_onRoomDidFailToConnect}
        onParticipantAddedVideoTrack={_onParticipantAddedVideoTrack}
        onParticipantRemovedVideoTrack={_onParticipantRemovedVideoTrack}
      />

      {status === 'connecting' && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loadingText}>Connecting...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingText: {
    color: '#FFF',
    fontSize: 18,
  },
  localVideoContainer: {
    position: 'absolute',
    bottom: 120, // Above controls
    right: 20,
    width: 100,
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFF',
    zIndex: 10,
  },
  localVideo: {
    flex: 1,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    zIndex: 20,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonDisabled: {
    backgroundColor: '#FF3B30',
  },
  endCallButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF3B30',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 30,
  },
  loadingText: {
    color: '#FFF',
    marginTop: 10,
  }
});

export default VideoCallScreen;
