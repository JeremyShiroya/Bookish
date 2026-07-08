package com.bookish.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Base64;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Media-style notification + lock-screen controls for book narration.
 *
 * The audio itself plays inside the WebView (Edge TTS chunks through an
 * HTMLAudioElement), so this plugin mirrors that playback into an Android
 * MediaSession: metadata (title / author / cover art), a seekable position, and
 * transport controls. Control presses are forwarded back to the WebView as
 * "mediaAction" events, where useTTS applies them.
 *
 * While narration is active a mediaPlayback foreground service ({@link
 * NarrationService}) holds the process alive — otherwise Android freezes it once
 * the app leaves the screen and narration stalls between sentences.
 *
 * Playback state lives in static fields because the service builds the very same
 * notification, and there is only ever one narration session per process.
 */
@CapacitorPlugin(
    name = "BookishMediaSession",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class MediaSessionPlugin extends Plugin {

    static final String CHANNEL_ID = "bookish_narration";
    static final int NOTIFICATION_ID = 424242;
    private static final String CONTROL_ACTION = "com.bookish.app.MEDIA_CONTROL";
    private static final String CONTROL_EXTRA = "control";

    private static MediaSessionCompat session;
    private static Bitmap albumArt;
    private static String currentTitle = "Bookish";
    private static String currentArtist = "";
    private static boolean currentlyPlaying = false;
    private static boolean sessionActive = false;
    private static boolean serviceRunning = false;

    private static MediaSessionPlugin instance;

    private BroadcastReceiver controlReceiver;
    private String artKey = "";

    @Override
    public void load() {
        instance = this;
        createChannel();

        session = new MediaSessionCompat(getContext(), "BookishNarration");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { emitAction("play", 0); }
            @Override public void onPause() { emitAction("pause", 0); }
            @Override public void onSkipToNext() { emitAction("next", 0); }
            @Override public void onSkipToPrevious() { emitAction("previous", 0); }
            @Override public void onStop() { emitAction("stop", 0); }
            @Override public void onSeekTo(long positionMs) { emitAction("seekTo", positionMs / 1000.0); }
        });

        controlReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String control = intent.getStringExtra(CONTROL_EXTRA);
                if (control != null) emitAction(control, 0);
            }
        };
        IntentFilter filter = new IntentFilter(CONTROL_ACTION);
        if (Build.VERSION.SDK_INT >= 33) {
            getContext().registerReceiver(controlReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(controlReceiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        try {
            if (controlReceiver != null) getContext().unregisterReceiver(controlReceiver);
        } catch (Exception ignored) {}
        stopNarrationService();
        if (session != null) {
            session.setActive(false);
            session.release();
            session = null;
        }
        sessionActive = false;
        instance = null;
        NotificationManagerCompat.from(getContext()).cancel(NOTIFICATION_ID);
    }

    private void emitAction(String action, double positionSeconds) {
        if (instance == null) return;
        JSObject data = new JSObject();
        data.put("action", action);
        data.put("position", positionSeconds);
        instance.notifyListeners("mediaAction", data);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Narration",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Book narration playback controls");
        channel.setShowBadge(false);
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || hasNotificationPermission()) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasNotificationPermission());
        call.resolve(result);
    }

    private boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33) return true;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void update(PluginCall call) {
        if (session == null) {
            call.reject("Media session unavailable");
            return;
        }

        currentTitle = call.getString("title", "Bookish");
        currentArtist = call.getString("artist", "");
        currentlyPlaying = Boolean.TRUE.equals(call.getBoolean("playing", false));
        double positionSec = call.getDouble("position", 0.0);
        double durationSec = call.getDouble("duration", 0.0);
        float speed = call.getFloat("speed", 1.0f);
        String artBase64 = call.getString("artBase64", null);

        // Cover art is expensive to decode — only when it actually changed.
        if (artBase64 != null) {
            String key = artBase64.length() > 64 ? artBase64.substring(0, 64) + artBase64.length() : artBase64;
            if (!key.equals(artKey)) {
                artKey = key;
                albumArt = decodeArt(artBase64);
            }
        }

        MediaMetadataCompat.Builder metadata = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, (long) (durationSec * 1000));
        if (albumArt != null) {
            metadata.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, albumArt);
            metadata.putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, albumArt);
        }
        session.setMetadata(metadata.build());

        PlaybackStateCompat.Builder state = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY
                    | PlaybackStateCompat.ACTION_PAUSE
                    | PlaybackStateCompat.ACTION_PLAY_PAUSE
                    | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                    | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                    | PlaybackStateCompat.ACTION_SEEK_TO
                    | PlaybackStateCompat.ACTION_STOP
            )
            .setState(
                currentlyPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                (long) (positionSec * 1000),
                currentlyPlaying ? speed : 0f
            );
        session.setPlaybackState(state.build());
        session.setActive(true);
        sessionActive = true;

        if (currentlyPlaying) {
            // Keeps the process (and therefore the WebView driving the audio)
            // running once the user leaves the app.
            startNarrationService();
        } else {
            // Paused: drop the foreground promotion but keep the notification so
            // the user can resume from the shade.
            stopNarrationService();
            postNotification();
        }

        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        sessionActive = false;
        currentlyPlaying = false;
        stopNarrationService();
        if (session != null) session.setActive(false);
        NotificationManagerCompat.from(getContext()).cancel(NOTIFICATION_ID);
        call.resolve();
    }

    private void startNarrationService() {
        // Android 12+ forbids starting a foreground service from the background,
        // so only start it on the transition into playback (which always happens
        // while the app is on screen, or from a notification/lock-screen control
        // press — both of which grant a start exemption). Every later `update`
        // while already playing just refreshes the notification.
        if (serviceRunning) {
            postNotification();
            return;
        }
        Intent intent = new Intent(getContext(), NarrationService.class)
            .setAction(NarrationService.ACTION_START);
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            serviceRunning = true;
        } catch (Exception e) {
            // ForegroundServiceStartNotAllowedException (API 31+) or a plain
            // IllegalStateException: fall back to a plain notification. Narration
            // still plays while the app is visible.
            postNotification();
        }
    }

    private void stopNarrationService() {
        if (!serviceRunning) return;
        serviceRunning = false;
        Intent intent = new Intent(getContext(), NarrationService.class)
            .setAction(NarrationService.ACTION_STOP);
        try {
            getContext().startService(intent);
        } catch (Exception ignored) {
            // The service is already gone.
        }
    }

    private void postNotification() {
        if (!hasNotificationPermission()) return;
        Notification notification = buildNotification(getContext());
        if (notification == null) return;
        try {
            NotificationManagerCompat.from(getContext()).notify(NOTIFICATION_ID, notification);
        } catch (SecurityException ignored) {
            // Permission revoked mid-session — lock-screen controls still work
            // via the MediaSession; the shade notification is skipped.
        }
    }

    private Bitmap decodeArt(String base64) {
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Bitmap raw = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (raw == null) return null;
            // Keep the bitmap notification-sized; huge covers waste binder space.
            int max = 512;
            int width = raw.getWidth();
            int height = raw.getHeight();
            if (width <= max && height <= max) return raw;
            float scale = Math.min((float) max / width, (float) max / height);
            return Bitmap.createScaledBitmap(raw, Math.round(width * scale), Math.round(height * scale), true);
        } catch (Exception e) {
            return null;
        }
    }

    private static PendingIntent controlIntent(Context context, String control, int requestCode) {
        Intent intent = new Intent(CONTROL_ACTION).setPackage(context.getPackageName());
        intent.putExtra(CONTROL_EXTRA, control);
        return PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    /**
     * Builds the MediaStyle notification for the current narration state.
     * Shared with {@link NarrationService}, which must post this exact
     * notification when it promotes itself to the foreground.
     *
     * @return null when there is no active narration session.
     */
    static Notification buildNotification(Context context) {
        if (session == null || !sessionActive) return null;

        Intent launch = new Intent(context, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            context, 0, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(context.getApplicationInfo().icon)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setLargeIcon(albumArt)
            .setContentIntent(contentIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(currentlyPlaying)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .addAction(android.R.drawable.ic_media_previous, "Previous", controlIntent(context, "previous", 1))
            .addAction(
                currentlyPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                currentlyPlaying ? "Pause" : "Play",
                controlIntent(context, currentlyPlaying ? "pause" : "play", 2)
            )
            .addAction(android.R.drawable.ic_media_next, "Next", controlIntent(context, "next", 3))
            .setStyle(
                new androidx.media.app.NotificationCompat.MediaStyle()
                    .setMediaSession(session.getSessionToken())
                    .setShowActionsInCompactView(0, 1, 2)
            );

        return builder.build();
    }
}
