import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AccessibilityContextType = {
    largeText: boolean;
    highContrast: boolean;
    setLargeText: (value: boolean) => Promise<void>;
    setHighContrast: (value: boolean) => Promise<void>;
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [largeText, _setLargeText] = useState(false);
    const [highContrast, _setHighContrast] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedLargeText = await AsyncStorage.getItem('largeText');
                const savedHighContrast = await AsyncStorage.getItem('highContrast');
                if (savedLargeText !== null) _setLargeText(savedLargeText === 'true');
                if (savedHighContrast !== null) _setHighContrast(savedHighContrast === 'true');
            } catch (e) {
                console.error('Failed to load accessibility settings', e);
            }
        };
        loadSettings();
    }, []);

    const setLargeText = async (value: boolean) => {
        _setLargeText(value);
        try {
            await AsyncStorage.setItem('largeText', String(value));
        } catch (e) {
            console.error('Failed to save largeText setting', e);
        }
    };

    const setHighContrast = async (value: boolean) => {
        _setHighContrast(value);
        try {
            await AsyncStorage.setItem('highContrast', String(value));
        } catch (e) {
            console.error('Failed to save highContrast setting', e);
        }
    };

    return (
        <AccessibilityContext.Provider value={{ largeText, highContrast, setLargeText, setHighContrast }}>
            {children}
        </AccessibilityContext.Provider>
    );
};

export const useAccessibility = () => {
    const context = useContext(AccessibilityContext);
    if (!context) {
        throw new Error('useAccessibility must be used within AccessibilityProvider');
    }
    return context;
};
