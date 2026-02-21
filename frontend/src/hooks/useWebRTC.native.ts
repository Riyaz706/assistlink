/**
 * Native (iOS/Android): 1-to-1 WebRTC video call with Supabase Realtime signaling.
 * Uses react-native-webrtc; same signaling protocol as web (useWebRTC.ts).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from 'react-native-webrtc';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

export type CallStatus =
  | 'idle'
  | 'getting_media'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export type CallError = 'permission_denied' | 'network' | 'signaling' | 'config' | 'unknown';

export interface UseWebRTCOptions {
  roomId: string;
  userId: string;
  onEnd?: () => void;
}

export interface UseWebRTCReturn {
  status: CallStatus;
  error: CallError | null;
  errorMessage: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isRemoteVideoOff: boolean;
  startCall: () => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  retry: () => void;
}

const ICE_SERVERS: RTCConfiguration['iceServers'] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function useWebRTC({ roomId, userId, onEnd }: UseWebRTCOptions): UseWebRTCReturn {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [error, setError] = useState<CallError | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const supabaseChannelRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);
  const isOffererRef = useRef(false);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (supabaseChannelRef.current) {
      try {
        getSupabase()?.removeChannel(supabaseChannelRef.current);
      } catch (_) {}
      supabaseChannelRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    remoteDescSetRef.current = false;
    pendingIceRef.current = [];
  }, []);

  const endCall = useCallback(() => {
    try {
      supabaseChannelRef.current?.send({
        type: 'broadcast',
        event: 'hangup',
        payload: { from: userId },
      });
    } catch (_) {}
    setStatus('disconnected');
    cleanup();
    onEnd?.();
  }, [cleanup, onEnd, userId]);

  const setErr = useCallback((err: CallError, message: string) => {
    setError(err);
    setErrorMessage(message);
    setStatus('error');
  }, []);

  const getMedia = useCallback(async (): Promise<MediaStream> => {
    const stream = await mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: true,
    });
    return stream as unknown as MediaStream;
  }, []);

  const startCall = useCallback(async () => {
    if (!roomId || !userId) {
      setErr('config', 'Missing room or user ID');
      return;
    }
    if (!isSupabaseConfigured() || !getSupabase()) {
      setErr('config', 'Video calling needs Supabase (EXPO_PUBLIC_SUPABASE_URL and anon key)');
      return;
    }

    setError(null);
    setErrorMessage(null);
    setStatus('getting_media');

    let stream: MediaStream;
    try {
      stream = await getMedia();
    } catch (e: any) {
      const name = e?.name || '';
      const msg = e?.message || String(e);
      if (name === 'NotAllowedError' || msg.toLowerCase().includes('permission')) {
        setErr('permission_denied', 'Camera and microphone access was denied. Please allow access and try again.');
      } else {
        setErr('permission_denied', msg || 'Could not access camera or microphone.');
      }
      return;
    }

    localStreamRef.current = stream;
    setLocalStream(stream);
    setStatus('connecting');

    const supabase = getSupabase()!;
    const channelName = `webrtc:${roomId}`;
    const channel = supabase.channel(channelName, { config: { broadcast: { self: false } } });
    supabaseChannelRef.current = channel;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track as any, stream as any));

    (pc as any).ontrack = (ev: { track: { kind: string }; streams?: MediaStream[] }) => {
      if (ev.track.kind === 'video') setIsRemoteVideoOff(false);
      if (ev.streams && ev.streams[0]) {
        setRemoteStream(ev.streams[0]);
      }
    };

    (pc as any).oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        setStatus('connected');
        setError(null);
        setErrorMessage(null);
      } else if (state === 'disconnected' || state === 'failed') {
        setStatus('reconnecting');
      } else if (state === 'closed') {
        setStatus('disconnected');
      }
    };

    (pc as any).onicecandidate = (ev: { candidate: RTCIceCandidate | null }) => {
      if (ev.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'ice',
          payload: { from: userId, candidate: ev.candidate.toJSON() },
        }).catch(() => {});
      }
    };

    channel
      .on('broadcast', { event: 'ready' }, (payload: { payload: { from: string } }) => {
        const from = payload?.payload?.from;
        if (!from || from === userId) return;
        if (isOffererRef.current) return;
        isOffererRef.current = true;
        (async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channel.send({
              type: 'broadcast',
              event: 'offer',
              payload: { from: userId, sdp: pc.localDescription?.toJSON() },
            }).catch(() => {});
          } catch (e) {
            setErr('signaling', 'Failed to create offer');
          }
        })();
      })
      .on('broadcast', { event: 'offer' }, async (payload: { payload: { from: string; sdp: RTCSessionDescriptionInit } }) => {
        const from = payload?.payload?.from;
        const sdp = payload?.payload?.sdp;
        if (!from || from === userId || !sdp) return;
        try {
          const desc = new RTCSessionDescription({ type: (sdp as any).type, sdp: (sdp as any).sdp ?? '' } as any);
          await pc.setRemoteDescription(desc);
          remoteDescSetRef.current = true;
          pendingIceRef.current.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
          pendingIceRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: 'broadcast',
            event: 'answer',
            payload: { from: userId, sdp: pc.localDescription?.toJSON() },
          }).catch(() => {});
        } catch (e) {
          setErr('signaling', 'Failed to handle offer');
        }
      })
      .on('broadcast', { event: 'answer' }, async (payload: { payload: { from: string; sdp: RTCSessionDescriptionInit } }) => {
        const from = payload?.payload?.from;
        const sdp = payload?.payload?.sdp;
        if (!from || from === userId || !sdp) return;
        try {
          const desc = new RTCSessionDescription({ type: (sdp as any).type, sdp: (sdp as any).sdp ?? '' } as any);
          await pc.setRemoteDescription(desc);
          remoteDescSetRef.current = true;
          pendingIceRef.current.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
          pendingIceRef.current = [];
        } catch (e) {
          setErr('signaling', 'Failed to handle answer');
        }
      })
      .on('broadcast', { event: 'ice' }, async (payload: { payload: { from: string; candidate: RTCIceCandidateInit } }) => {
        const from = payload?.payload?.from;
        const candidate = payload?.payload?.candidate;
        if (!from || from === userId || !candidate) return;
        try {
          if (remoteDescSetRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            pendingIceRef.current.push(candidate);
          }
        } catch (_) {}
      })
      .on('broadcast', { event: 'hangup' }, (payload: { payload: { from: string } }) => {
        if (payload?.payload?.from && payload.payload.from !== userId) {
          setStatus('disconnected');
          cleanup();
          onEnd?.();
        }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'ready',
            payload: { from: userId },
          }).catch(() => {});
        } else if (status === 'CHANNEL_ERROR') {
          setErr('signaling', 'Could not connect to signaling server');
        }
      });
  }, [roomId, userId, getMedia, setErr, cleanup, onEnd]);

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsMuted((m) => !m);
  }, []);

  const toggleCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsVideoOff((v) => !v);
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setErrorMessage(null);
    setStatus('idle');
    cleanup();
    startCall();
  }, [cleanup, startCall]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    status,
    error,
    errorMessage,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isRemoteVideoOff,
    startCall,
    endCall,
    toggleMute,
    toggleCamera,
    retry,
  };
}

export default useWebRTC;
