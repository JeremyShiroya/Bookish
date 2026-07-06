package com.bookish.app;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import android.util.Base64;

import java.io.File;
import java.io.FileInputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayDeque;
import java.util.Locale;

/**
 * Finds book documents (PDF / EPUB) on the device so the web layer can
 * auto-import them, ReadERA-style. Uses "All files access" on Android 11+
 * (reading arbitrary user documents is not covered by scoped storage) and
 * READ_EXTERNAL_STORAGE on older versions.
 */
@CapacitorPlugin(
    name = "DeviceBooks",
    permissions = {
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public class DeviceBooksPlugin extends Plugin {

    private static final int MAX_DEPTH = 8;
    private static final int MAX_RESULTS = 500;
    private static final int MAX_VISITED_DIRS = 4000;

    private boolean hasFullAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return Environment.isExternalStorageManager();
        }
        return getPermissionState("storage") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void check(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasFullAccess());
        call.resolve(ret);
    }

    @PluginMethod
    public void request(PluginCall call) {
        if (hasFullAccess()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // MANAGE_EXTERNAL_STORAGE can only be granted from the system
            // settings screen; open it and let the JS side re-check when the
            // app regains focus.
            try {
                Intent intent = new Intent(
                    Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName())
                );
                getActivity().startActivity(intent);
            } catch (Exception e) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                getActivity().startActivity(intent);
            }
            JSObject ret = new JSObject();
            ret.put("granted", false);
            ret.put("openedSettings", true);
            call.resolve(ret);
            return;
        }

        requestPermissionForAlias("storage", call, "storagePermissionCallback");
    }

    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        check(call);
    }

    /**
     * Reads a book file's bytes and returns them base64-encoded. Reading here
     * (with the same MANAGE_EXTERNAL_STORAGE grant that let us list the file)
     * is more reliable than Capacitor Filesystem, which does not resolve raw
     * absolute paths outside the app sandbox.
     */
    @PluginMethod
    public void readFile(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("A file path is required");
            return;
        }
        if (!hasFullAccess()) {
            call.reject("Storage permission has not been granted");
            return;
        }

        new Thread(() -> {
            File file = new File(path);
            if (!file.exists() || !file.canRead()) {
                call.reject("File cannot be read: " + path);
                return;
            }
            try (FileInputStream in = new FileInputStream(file)) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] chunk = new byte[65536];
                int read;
                while ((read = in.read(chunk)) != -1) {
                    out.write(chunk, 0, read);
                }
                JSObject ret = new JSObject();
                ret.put("data", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to read file: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void scan(PluginCall call) {
        if (!hasFullAccess()) {
            call.reject("Storage permission has not been granted");
            return;
        }

        new Thread(() -> {
            JSArray files = new JSArray();
            int[] visited = { 0 };
            walk(Environment.getExternalStorageDirectory(), 0, files, visited);

            JSObject ret = new JSObject();
            ret.put("files", files);
            call.resolve(ret);
        }).start();
    }

    private void walk(File dir, int depth, JSArray results, int[] visited) {
        if (dir == null || depth > MAX_DEPTH || results.length() >= MAX_RESULTS) return;
        if (visited[0] >= MAX_VISITED_DIRS) return;
        visited[0] += 1;

        File[] entries = dir.listFiles();
        if (entries == null) return;

        for (File entry : entries) {
            if (results.length() >= MAX_RESULTS) return;
            String name = entry.getName();
            if (name.startsWith(".")) continue;

            if (entry.isDirectory()) {
                // App sandboxes and system dirs: enormous and never hold user books.
                String lower = name.toLowerCase(Locale.ROOT);
                if (depth == 0 && (lower.equals("android") || lower.equals("obb") || lower.equals("data"))) continue;
                walk(entry, depth + 1, results, visited);
                continue;
            }

            String lower = name.toLowerCase(Locale.ROOT);
            if (!(lower.endsWith(".pdf") || lower.endsWith(".epub"))) continue;
            if (entry.length() <= 0) continue;

            JSObject item = new JSObject();
            item.put("path", entry.getAbsolutePath());
            item.put("name", name);
            item.put("size", entry.length());
            item.put("modified", entry.lastModified());
            results.put(item);
        }
    }
}
