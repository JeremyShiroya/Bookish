package com.bookish.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceBooksPlugin.class);
        registerPlugin(MediaSessionPlugin.class);
        super.onCreate(savedInstanceState);
        // Cold start from the system "Open with" sheet: the web layer isn't
        // loaded yet, so just park the document until JS asks for it.
        captureViewIntent(getIntent(), false);
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
