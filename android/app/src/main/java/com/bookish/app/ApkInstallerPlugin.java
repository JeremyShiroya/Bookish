package com.bookish.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Hands a downloaded APK to Android's package installer.
 *
 * Pages installs outside the Play Store, so it ships its own update flow. The
 * web layer downloads the APK itself (so the progress bar lives in the app's
 * own modal instead of the browser's notification shade) and then calls in here
 * to open it.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: install anything. Android does not allow
 * a normal app to install a package silently — the system installer dialog
 * always appears and the user confirms it there. That is enforced by the OS for
 * every non-system app, so the most an update flow can do is put the right file
 * in front of that dialog with one tap. This class does exactly that and no
 * more.
 *
 * Two things are required and are checked rather than assumed:
 *   - REQUEST_INSTALL_PACKAGES in the manifest (a manifest permission, granted
 *     at install time), AND
 *   - the per-app "install unknown apps" toggle, which the USER must grant in
 *     system settings from Android 8 onwards. canInstall() reports it and
 *     openInstallSettings() takes them straight to the right screen, because a
 *     failed install intent is otherwise completely silent.
 *
 * The APK is served through the app's existing FileProvider: a raw file:// uri
 * would throw FileUriExposedException on Android 7+.
 */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    private static final String APK_MIME = "application/vnd.android.package-archive";

    /**
     * Whether this app may currently ask to install packages. Below Android 8
     * the manifest permission is enough; from 8 onwards the user holds a
     * per-app toggle that can be off even with the permission declared.
     */
    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasInstallPermission());
        call.resolve(result);
    }

    /**
     * Opens the "install unknown apps" screen for THIS app. Without the package
     * uri Android drops the user on the full list of every installed app, which
     * is a much worse place to land.
     */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve();
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                .setData(Uri.parse("package:" + getContext().getPackageName()))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not open the install-permission screen.", error);
        }
    }

    /**
     * @param call `path` — where the downloaded APK is, as an absolute path or
     *             a file:// uri (Capacitor's Filesystem returns the latter).
     */
    @PluginMethod
    public void install(PluginCall call) {
        final String path = call.getString("path");
        if (path == null || path.trim().isEmpty()) {
            call.reject("No APK path was provided.");
            return;
        }

        final File apk = resolveFile(path);
        // Fail loudly here: a missing or empty file otherwise surfaces as
        // Android's generic "There was a problem parsing the package", which
        // says nothing about what actually went wrong.
        if (!apk.exists()) {
            call.reject("The downloaded update could not be found on this device.");
            return;
        }
        if (apk.length() <= 0) {
            call.reject("The downloaded update is empty — the download did not finish.");
            return;
        }
        if (!hasInstallPermission()) {
            call.reject("PERMISSION_REQUIRED");
            return;
        }

        try {
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apk
            );

            Intent intent = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, APK_MIME)
                // The installer runs in another process, so it needs explicit
                // permission to read a uri that belongs to us.
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not open the installer for this update.", error);
        }
    }

    private boolean hasInstallPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        try {
            return getContext().getPackageManager().canRequestPackageInstalls();
        } catch (Exception error) {
            return false;
        }
    }

    private File resolveFile(String path) {
        String trimmed = path.trim();
        if (trimmed.startsWith("file://")) {
            Uri uri = Uri.parse(trimmed);
            String resolved = uri.getPath();
            if (resolved != null) return new File(resolved);
        }
        return new File(trimmed);
    }
}
