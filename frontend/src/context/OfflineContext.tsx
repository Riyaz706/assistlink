import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setOfflineHandler } from '../api/client';

export interface QueueItem {
    id: string;
    path: string;
    method: string;
    body?: string;
    timestamp: number;
}

interface OfflineContextType {
    isOffline: boolean;
    queueAction: (item: Omit<QueueItem, 'id' | 'timestamp'>) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType>({
    isOffline: false,
    queueAction: async () => { },
});

const STORAGE_KEY = '@assistlink_offline_queue';

export const OfflineProvider = ({ children }: { children: ReactNode }) => {
    const [isOffline, setIsOffline] = useState(false);
    const [animation] = useState(new Animated.Value(0));
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);

    // Load queue from storage on init
    useEffect(() => {
        const loadQueue = async () => {
            try {
                const storedQueue = await AsyncStorage.getItem(STORAGE_KEY);
                if (storedQueue) {
                    setQueue(JSON.parse(storedQueue));
                }
            } catch (error) {
                console.error('[OfflineContext] Failed to load queue:', error);
            }
        };
        loadQueue();
    }, []);

    // Sync queue when coming back online
    const syncQueue = useCallback(async (currentQueue: QueueItem[]) => {
        if (currentQueue.length === 0 || isSyncing) return;

        console.log(`[OfflineContext] Syncing ${currentQueue.length} pending actions...`);
        setIsSyncing(true);

        const remainingQueue: QueueItem[] = [];

        for (const item of currentQueue) {
            try {
                console.log(`[OfflineContext] Syncing action: ${item.method} ${item.path}`);
                // Use the raw request method to replay actions
                await api.request(item.path, {
                    method: item.method,
                    body: item.body,
                });
            } catch (error: any) {
                console.error(`[OfflineContext] Failed to sync item ${item.id}:`, error);

                // CONFLICT RESOLUTION LOGIC
                const isPermanentError = error.statusCode === 409 || error.statusCode === 422 || error.statusCode === 400;

                if (isPermanentError) {
                    console.warn(`[OfflineContext] Permanent error ${error.statusCode} for item ${item.id}. Removing from queue.`);
                    // Discard it
                } else if (error.code === 'NETWORK_ERROR' || error.statusCode === 503 || error.statusCode === 504) {
                    // It's a temporary network/server issue, keep in queue
                    remainingQueue.push(item);
                } else {
                    // Other errors (401, 403, 404) - likely permanent or auth related
                    // Discard for safety to prevent infinite retry loops
                    console.warn(`[OfflineContext] Discarding item ${item.id} due to status ${error.statusCode}`);
                }
            }
        }

        const newQueue = [...remainingQueue];
        setQueue(newQueue);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newQueue));
        setIsSyncing(false);
        console.log(`[OfflineContext] Sync complete. ${currentQueue.length - newQueue.length} items processed.`);
    }, [isSyncing]);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            const offline = state.isConnected === false;
            const wasOffline = isOffline;
            setIsOffline(offline);

            Animated.timing(animation, {
                toValue: offline ? 1 : 0,
                duration: 300,
                useNativeDriver: true,
            }).start();

            // If transitioned from offline to online, trigger sync
            if (wasOffline && !offline) {
                syncQueue(queue);
            }
        });

        return () => unsubscribe();
    }, [isOffline, queue, syncQueue]);

    const queueAction = useCallback(async (item: Omit<QueueItem, 'id' | 'timestamp'>) => {
        const newItem: QueueItem = {
            ...item,
            id: Math.random().toString(36).substring(2, 11),
            timestamp: Date.now(),
        };

        const updatedQueue = [...queue, newItem];
        setQueue(updatedQueue);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedQueue));
        console.log(`[OfflineContext] Action queued: ${newItem.method} ${newItem.path}`);
    }, [queue]);

    // Register offline handler with the API client
    useEffect(() => {
        setOfflineHandler(async (path, options) => {
            await queueAction({
                path,
                method: options.method || 'GET',
                body: options.body as string | undefined,
            });
        });

        return () => setOfflineHandler(null);
    }, [queueAction]);

    return (
        <OfflineContext.Provider value={{ isOffline, queueAction }}>
            <View style={{ flex: 1 }}>
                {children}

                {(isOffline || isSyncing) && (
                    <Animated.View
                        style={[
                            styles.offlineBanner,
                            {
                                backgroundColor: isSyncing ? '#059669' : '#333333',
                                transform: [
                                    {
                                        translateY: animation.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [100, 0],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <SafeAreaView edges={['bottom']}>
                            <View style={styles.bannerContent}>
                                <Text style={styles.bannerText}>
                                    {isSyncing ? 'Syncing offline actions...' : 'You are currently offline'}
                                </Text>
                            </View>
                        </SafeAreaView>
                    </Animated.View>
                )}
            </View>
        </OfflineContext.Provider>
    );
};

export const useOffline = () => useContext(OfflineContext);

const styles = StyleSheet.create({
    offlineBanner: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 10,
        zIndex: 9999,
    },
    bannerContent: {
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
});
