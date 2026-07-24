package com.bookish.app;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Keeps the status- and navigation-bar ICONS readable.
 *
 * The bars themselves are transparent (see MainActivity.enableEdgeToEdge), so
 * the app's own background shows through them and they always match the theme.
 * Their icons do not follow automatically though: on a light background they
 * must be dark, and on a dark background light. Android only exposes that as a
 * window flag, so the web layer — which is the only thing that knows which
 * theme is active — calls in here whenever the theme changes.
 */
@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {

    /**
     * @param call `dark` — true when the app is showing its dark theme, i.e.
     *             the bars sit on a dark background and need LIGHT icons.
     */
    @PluginMethod
    public void setAppearance(PluginCall call) {
        final boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));

        getActivity().runOnUiThread(() -> {
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
                getActivity().getWindow(),
                getActivity().getWindow().getDecorView()
            );
            if (controller != null) {
                // "Light bars" means light BACKGROUND, so dark icons — the
                // opposite of the app's dark theme.
                controller.setAppearanceLightStatusBars(!dark);
                controller.setAppearanceLightNavigationBars(!dark);
            }
            call.resolve();
        });
    }
}
