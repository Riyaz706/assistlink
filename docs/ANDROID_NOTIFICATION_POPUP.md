# Android notification popup (heads-up)

AssistLink is configured so notifications can appear as **popups** (heads-up) on Android.

## What we did in the app

1. **Channel importance**  
   The default and emergency notification channels use **MAX** importance so the system can show them as heads-up (pop on screen). See `frontend/src/hooks/useNotifications.ts` (`setNotificationChannelAsync` for `default` and `emergency`).

2. **Notification handler**  
   `setNotificationHandler` uses `shouldShowAlert: true`, `shouldShowBanner: true`, and on Android `priority: HIGH` (or `MAX` for emergencies).

3. **Android 13+ permission**  
   `android.permission.POST_NOTIFICATIONS` is in `app.config.js` so the app can request notification permission at runtime on Android 13+.

4. **Default channel in native config**  
   The `expo-notifications` plugin is configured with `defaultChannel: 'default'` so FCM uses the same channel we create with MAX importance.

## If popups still don’t show

On some devices (e.g. Samsung, Xiaomi, Oppo), the system can still hide heads-up unless the user enables it:

1. Open **Settings** → **Apps** → **AssistLink** → **Notifications**.
2. Ensure notifications are **allowed**.
3. Open the **AssistLink** notification category (e.g. “Notifications” or “Emergency Alerts”).
4. Turn on **“Pop on screen”** / **“Heads-up”** / **“Show as pop-up”** (wording varies by OEM).

After a rebuild, **reinstall or clear app data** so the new channel importance is applied; changing channel importance later can be ignored by the system until the channel is reset.
