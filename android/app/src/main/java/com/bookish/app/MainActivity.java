package com.bookish.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceBooksPlugin.class);
        registerPlugin(MediaSessionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
