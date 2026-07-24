package com.bookish.app;

import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import androidx.annotation.RequiresApi;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceBooksPlugin.class);
        registerPlugin(MediaSessionPlugin.class);
        registerPlugin(SystemBarsPlugin.class);
        super.onCreate(savedInstanceState);
        enableEdgeToEdge();
        installRenderProcessGoneHandler();
        // Cold start from the system "Open with" sheet: the web layer isn't
        // loaded yet, so just park the document until JS asks for it.
        captureViewIntent(getIntent(), false);
    }

    /**
     * Survive a WebView renderer crash instead of dying with it.
     *
     * The renderer runs in its own sandboxed process. When it dies — most
     * often because a worker (PDF.js parsing a large document) exhausted the
     * renderer's memory — Android's DEFAULT behaviour is to kill the hosting
     * app: "Render process's crash wasn't handled by all associated webviews".
     * That is what closed the app on a device with hundreds of books, and no
     * amount of care on the JS side can prevent it, because by then the JS
     * heap is already gone.
     *
     * Returning true from onRenderProcessGone tells the framework we have
     * handled it, so the app process survives. The dead WebView can never be
     * reused, so it is destroyed and the activity restarted to get a fresh one
     * — the library and every import is already persisted, so the user lands
     * back where they were rather than watching the app vanish.
     */
    /**
     * Draw the app behind the status and navigation bars, and make those bars
     * transparent, so the app's own background reaches the very top and bottom
     * of the screen. Without this the system bars keep their own opaque colour
     * and the app looks boxed inside them.
     *
     * The web layer already reserves the physical bar areas through the CSS
     * env(safe-area-inset-*) values (enabled by viewport-fit=cover), so nothing
     * important is ever hidden behind a bar.
     *
     * Bar ICONS start out dark, to suit the default light chrome. The web layer
     * is the only thing that knows which theme is active, so it calls
     * SystemBarsPlugin.setAppearance whenever that changes and flips them.
     */
    private void enableEdgeToEdge() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(true);
            controller.setAppearanceLightNavigationBars(true);
        }
    }

    private void installRenderProcessGoneHandler() {
        if (getBridge() == null || getBridge().getWebView() == null) return;

        getBridge().getWebView().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            @RequiresApi(api = Build.VERSION_CODES.O)
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                Log.w("Bookish", "WebView renderer gone (crashed="
                    + (detail != null && !detail.didCrash() ? "false, killed by system" : "true")
                    + ") — recovering instead of letting it take the app down");

                // The WebView is unusable from here on; detach and destroy it.
                if (view != null) {
                    view.loadUrl("about:blank");
                    view.destroy();
                }

                // Relaunch into a clean process rather than leaving a blank shell.
                Intent restart = getPackageManager().getLaunchIntentForPackage(getPackageName());
                if (restart != null) {
                    restart.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(restart);
                }
                finish();
                return true;
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // Warm start (launchMode is singleTask): the WebView is already
        // running, so nudge it to consume the document right away.
        captureViewIntent(intent, true);
    }

    private void captureViewIntent(Intent intent, boolean notifyWebView) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        Uri uri = intent.getData();
        if (uri == null) return;

        DeviceBooksPlugin.setPendingOpenedDocument(uri);
        if (notifyWebView && getBridge() != null) {
            getBridge().triggerWindowJSEvent("bookishOpenedDocument");
        }
    }
}
