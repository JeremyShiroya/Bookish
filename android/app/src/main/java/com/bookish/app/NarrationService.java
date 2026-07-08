package com.bookish.app;

import android.app.Notification;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/**
 * Foreground service that keeps book narration alive while the app is in the
 * background.
 *
 * The audio itself is played by the WebView. Without a foreground service,
 * Android freezes the app process (and throttles the WebView's timers) once the
 * activity is no longer visible — narration then stalled at the end of a
 * sentence, because the JavaScript that starts the next sentence never ran.
 * Holding a mediaPlayback foreground service exempts the process from that.
 */
public class NarrationService extends Service {

    public static final String ACTION_START = "com.bookish.app.NARRATION_START";
    public static final String ACTION_STOP = "com.bookish.app.NARRATION_STOP";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;

        if (ACTION_STOP.equals(action)) {
            stopForegroundCompat();
            stopSelf();
            return START_NOT_STICKY;
        }

        Notification notification = MediaSessionPlugin.buildNotification(this);
        if (notification == null) {
            // Nothing is playing (e.g. the process was restarted by the system).
            stopForegroundCompat();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(
                MediaSessionPlugin.NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            );
        } else {
            startForeground(MediaSessionPlugin.NOTIFICATION_ID, notification);
        }

        // Narration is driven by the WebView; if the system restarts this
        // service on its own there is nothing to resume.
        return START_NOT_STICKY;
    }

    private void stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= 24) {
            stopForeground(Service.STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
    }

    @Override
    public void onDestroy() {
        stopForegroundCompat();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
