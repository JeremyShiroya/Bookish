package com.bookish.app;

import android.Manifest;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.OpenableColumns;
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
import java.io.InputStream;
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

    // Matches MAX_DEVICE_IMPORT_BYTES on the JS side: bigger documents would
    // exhaust the WebView's memory crossing the base64 bridge.
    private static final long MAX_OPENED_DOCUMENT_BYTES = 150L * 1024 * 1024;

    // Document URI parked by MainActivity when the app is launched from the
    // system "Open with" sheet, until the web layer consumes it.
    private static Uri pendingOpenedDocument = null;

    static void setPendingOpenedDocument(Uri uri) {
        pendingOpenedDocument = uri;
    }

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
     * Hands the document the app was opened with (system "Open with" sheet)
     * to the web layer as base64 bytes plus a display name. Reading the
     * content:// URI uses the temporary grant from the sending app, so no
     * storage permission is needed. Resolves { available: false } when the
     * app was opened normally.
     */
    @PluginMethod
    public void consumeOpenedDocument(PluginCall call) {
        Uri uri = pendingOpenedDocument;
        pendingOpenedDocument = null;

        if (uri == null) {
            JSObject ret = new JSObject();
            ret.put("available", false);
            call.resolve(ret);
            return;
        }

        new Thread(() -> {
            try {
                String name = resolveDisplayName(uri);
                long size = resolveSize(uri);
                if (size > MAX_OPENED_DOCUMENT_BYTES) {
                    call.reject("Document is too large to open (over 150 MB)");
                    return;
                }

                // Same heap arithmetic as readFile: refuse what we cannot
                // afford rather than dying part-way through the encode.
                if (size > 0) {
                    long needed = (long) (size * READ_PEAK_MULTIPLIER) + READ_HEADROOM_BYTES;
                    if (needed > availableHeapBytes()) {
                        System.gc();
                        if (needed > availableHeapBytes()) {
                            call.reject(
                                "Not enough memory to open a " + (size / (1024 * 1024)) + "MB document",
                                TOO_LARGE
                            );
                            return;
                        }
                    }
                }

                try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
                    if (in == null) {
                        call.reject("Document could not be opened: " + uri);
                        return;
                    }
                    ByteArrayOutputStream out = new ByteArrayOutputStream(
                        size > 0 && size <= Integer.MAX_VALUE ? (int) size : 65536
                    );
                    byte[] chunk = new byte[65536];
                    int read;
                    long total = 0;
                    while ((read = in.read(chunk)) != -1) {
                        total += read;
                        if (total > MAX_OPENED_DOCUMENT_BYTES) {
                            call.reject("Document is too large to open (over 150 MB)");
                            return;
                        }
                        out.write(chunk, 0, read);
                    }

                    String encoded = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
                    JSObject ret = new JSObject();
                    ret.put("available", true);
                    ret.put("name", name);
                    ret.put("size", total);
                    ret.put("mimeType", getContext().getContentResolver().getType(uri));
                    ret.put("data", encoded);
                    call.resolve(ret);
                }
            } catch (OutOfMemoryError e) {
                call.reject("Ran out of memory opening this document", TOO_LARGE);
            } catch (Throwable t) {
                call.reject("Failed to read opened document: " + t.getMessage());
            }
        }).start();
    }

    private String resolveDisplayName(Uri uri) {
        if ("content".equals(uri.getScheme())) {
            try (Cursor cursor = getContext().getContentResolver().query(
                uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    String name = cursor.getString(0);
                    if (name != null && !name.isEmpty()) return name;
                }
            } catch (Exception ignored) {}
        }
        String segment = uri.getLastPathSegment();
        return segment != null && !segment.isEmpty() ? segment : "document";
    }

    private long resolveSize(Uri uri) {
        if ("content".equals(uri.getScheme())) {
            try (Cursor cursor = getContext().getContentResolver().query(
                uri, new String[] { OpenableColumns.SIZE }, null, null, null)) {
                if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0)) {
                    return cursor.getLong(0);
                }
            } catch (Exception ignored) {}
        }
        if ("file".equals(uri.getScheme()) && uri.getPath() != null) {
            return new File(uri.getPath()).length();
        }
        return -1;
    }

    /** Rejection code the web layer checks to skip a file permanently. */
    private static final String TOO_LARGE = "FILE_TOO_LARGE";

    /**
     * Base64 across the bridge costs roughly 2.7x the file size at peak (the
     * raw bytes, plus the encoded bytes, plus the String). Require that much
     * headroom plus a safety margin before even attempting the read.
     */
    private static final double READ_PEAK_MULTIPLIER = 2.7d;
    private static final long READ_HEADROOM_BYTES = 32L * 1024 * 1024;

    private static long availableHeapBytes() {
        Runtime runtime = Runtime.getRuntime();
        // maxMemory is the growth limit; totalMemory-freeMemory is live usage.
        return runtime.maxMemory() - (runtime.totalMemory() - runtime.freeMemory());
    }

    /**
     * Reads a book file's bytes and returns them base64-encoded. Reading here
     * (with the same MANAGE_EXTERNAL_STORAGE grant that let us list the file)
     * is more reliable than Capacitor Filesystem, which does not resolve raw
     * absolute paths outside the app sandbox.
     *
     * Memory safety matters more than throughput here: a library with hundreds
     * of books is very likely to contain one huge document, and this used to
     * build the bytes in a ByteArrayOutputStream (which doubles as it grows),
     * copy them out with toByteArray(), then encode to a String — around 4.7x
     * the file size at peak. An 80MB book needed ~380MB against a 256MB heap
     * cap, and the resulting OutOfMemoryError was an Error (not an Exception),
     * so it escaped the catch below, killed this thread, and took the whole
     * app down with it. Now: the size is checked against real free heap first,
     * the bytes are read into an exactly-sized array, and Throwable is caught
     * so a file we cannot afford is reported instead of fatal.
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
            try {
                File file = new File(path);
                if (!file.exists() || !file.canRead()) {
                    call.reject("File cannot be read: " + path);
                    return;
                }

                long length = file.length();
                if (length <= 0) {
                    call.reject("File is empty: " + path);
                    return;
                }
                if (length > Integer.MAX_VALUE) {
                    call.reject("File is too large to import: " + path, TOO_LARGE);
                    return;
                }

                long needed = (long) (length * READ_PEAK_MULTIPLIER) + READ_HEADROOM_BYTES;
                if (needed > availableHeapBytes()) {
                    // Give the collector a chance to hand back room from the
                    // previous book before declaring the file unaffordable.
                    System.gc();
                    if (needed > availableHeapBytes()) {
                        call.reject(
                            "Not enough memory to import a " + (length / (1024 * 1024)) + "MB file",
                            TOO_LARGE
                        );
                        return;
                    }
                }

                byte[] bytes = new byte[(int) length];
                try (FileInputStream in = new FileInputStream(file)) {
                    int offset = 0;
                    while (offset < bytes.length) {
                        int read = in.read(bytes, offset, bytes.length - offset);
                        if (read < 0) break;
                        offset += read;
                    }
                    if (offset < bytes.length) {
                        call.reject("File ended early while reading: " + path);
                        return;
                    }
                }

                String encoded = Base64.encodeToString(bytes, Base64.NO_WRAP);
                // Drop the raw copy before the bridge serializes the String.
                bytes = null;

                JSObject ret = new JSObject();
                ret.put("data", encoded);
                call.resolve(ret);
            } catch (OutOfMemoryError e) {
                // Reject rather than rethrow: an Error escaping this thread is
                // a fatal, app-killing crash.
                call.reject("Ran out of memory reading: " + path, TOO_LARGE);
            } catch (Throwable t) {
                call.reject("Failed to read file: " + t.getMessage());
            }
        }).start();
    }

    /**
     * Permanently deletes a document that Bookish imported from device storage.
     *
     * Only called after the user confirms an explicitly-worded "delete from this
     * device" dialog. Resolves { deleted: false } when the file is already gone
     * so removing a book never fails on a stale path.
     */
    @PluginMethod
    public void deleteFile(PluginCall call) {
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
            try {
                File file = new File(path);
                JSObject ret = new JSObject();
                if (!file.exists()) {
                    ret.put("deleted", false);
                    ret.put("missing", true);
                    call.resolve(ret);
                    return;
                }
                boolean deleted = file.delete();
                ret.put("deleted", deleted);
                ret.put("missing", false);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to delete file: " + e.getMessage());
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
