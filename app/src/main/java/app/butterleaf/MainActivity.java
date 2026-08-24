package app.butterleaf;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {

    private static final String TAG = "Butterleaf";
    static final String ORIGIN = "https://butterleaf.local";
    private static final String START_URL = ORIGIN + "/app.html";

    private static final int REQ_FILE_CHOOSER = 1001;
    private static final int REQ_IMPORT_DOC = 1002;
    private static final int REQ_NOTIF_PERM = 1003;

    private WebView web;
    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraOutputUri;
    private String pendingSharedUrl;
    private final ExecutorService io = Executors.newFixedThreadPool(3);
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        Notifs.ensureChannel(this);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        web.setBackgroundColor(isNight() ? Color.parseColor("#121110") : Color.parseColor("#FCFBF9"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        if (Build.VERSION.SDK_INT >= 19) WebView.setWebContentsDebuggingEnabled(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (u != null && ("butterleaf.local".equals(u.getHost()))) {
                    return serveAsset(u.getPath());
                }
                return null;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (u != null && "butterleaf.local".equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception e) {
                    Log.w(TAG, "no handler for " + u, e);
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                applyInsets();
                js("window.__setTheme && window.__setTheme('" + (isNight() ? "dark" : "light") + "')");
                if (pendingSharedUrl != null) {
                    js("window.__onSharedUrl && window.__onSharedUrl(" + jsStr(pendingSharedUrl) + ")");
                    pendingSharedUrl = null;
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = cb;
                try {
                    startActivityForResult(buildPickerIntent(params), REQ_FILE_CHOOSER);
                } catch (ActivityNotFoundException e) {
                    filePathCallback = null;
                    toast("No app available to pick a photo");
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "Native");

        web.getRootView().setOnApplyWindowInsetsListener((v, insets) -> {
            applyInsets();
            return insets;
        });

        handleIntent(getIntent());
        web.loadUrl(START_URL);
        maybeRequestNotifPermission();
    }

    // ---------------------------------------------------------------- assets

    private WebResourceResponse serveAsset(String path) {
        if (path == null || path.equals("/")) path = "/app.html";
        String asset = path.startsWith("/") ? path.substring(1) : path;
        try {
            InputStream in = getAssets().open(asset);
            WebResourceResponse r = new WebResourceResponse(mimeOf(asset), "utf-8", in);
            java.util.Map<String, String> h = new java.util.HashMap<>();
            h.put("Cache-Control", "no-cache");
            r.setResponseHeaders(h);
            return r;
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8",
                    new java.io.ByteArrayInputStream("not found".getBytes(StandardCharsets.UTF_8)));
        }
    }

    private static String mimeOf(String p) {
        String l = p.toLowerCase();
        if (l.endsWith(".html")) return "text/html";
        if (l.endsWith(".css")) return "text/css";
        if (l.endsWith(".js")) return "application/javascript";
        if (l.endsWith(".otf")) return "font/otf";
        if (l.endsWith(".ttf")) return "font/ttf";
        if (l.endsWith(".woff2")) return "font/woff2";
        if (l.endsWith(".svg")) return "image/svg+xml";
        if (l.endsWith(".png")) return "image/png";
        if (l.endsWith(".jpg") || l.endsWith(".jpeg")) return "image/jpeg";
        if (l.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    // ---------------------------------------------------------------- system

    private boolean isNight() {
        int mode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }

    private void applyInsets() {
        View root = getWindow().getDecorView();
        android.view.WindowInsets wi = root.getRootWindowInsets();
        int top = 0, bottom = 0;
        if (wi != null) {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets i = wi.getInsets(
                        android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout());
                top = i.top;
                bottom = i.bottom;
            } else {
                top = wi.getSystemWindowInsetTop();
                bottom = wi.getSystemWindowInsetBottom();
            }
        }
        float d = getResources().getDisplayMetrics().density;
        final int t = Math.round(top / d), b = Math.round(bottom / d);
        js("window.__setInsets && window.__setInsets(" + t + "," + b + ")");
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        js("window.__setTheme && window.__setTheme('" + (isNight() ? "dark" : "light") + "')");
        applyInsets();
    }

    private void js(final String code) {
        main.post(() -> {
            try {
                web.evaluateJavascript(code, null);
            } catch (Exception ignored) {
            }
        });
    }

    private static String jsStr(String s) {
        return JSONObject.quote(s == null ? "" : s);
    }

    private void toast(final String m) {
        main.post(() -> Toast.makeText(MainActivity.this, m, Toast.LENGTH_SHORT).show());
    }

    @Override
    public void onBackPressed() {
        js("window.__onBack ? window.__onBack() : Native.exitApp()");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
        if (pendingSharedUrl != null) {
            js("window.__onSharedUrl && window.__onSharedUrl(" + jsStr(pendingSharedUrl) + ")");
            pendingSharedUrl = null;
        }
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        if (Intent.ACTION_SEND.equals(intent.getAction())) {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (text != null) {
                int i = text.indexOf("http");
                if (i >= 0) {
                    String url = text.substring(i).split("\\s+")[0];
                    pendingSharedUrl = url;
                }
            }
        }
    }

    private void maybeRequestNotifPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF_PERM);
        }
    }

    // ---------------------------------------------------------------- photos

    private Intent buildPickerIntent(WebChromeClient.FileChooserParams params) {
        Intent content = new Intent(Intent.ACTION_GET_CONTENT);
        content.addCategory(Intent.CATEGORY_OPENABLE);
        content.setType("image/*");

        Intent chooser = new Intent(Intent.ACTION_CHOOSER);
        chooser.putExtra(Intent.EXTRA_INTENT, content);
        chooser.putExtra(Intent.EXTRA_TITLE, "Add a photo");

        ArrayList<Intent> extras = new ArrayList<>();
        Intent cam = buildCameraIntent();
        if (cam != null) extras.add(cam);
        if (!extras.isEmpty()) {
            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, extras.toArray(new Intent[0]));
        }
        return chooser;
    }

    private Intent buildCameraIntent() {
        try {
            File dir = new File(getCacheDir(), "captures");
            if (!dir.exists() && !dir.mkdirs()) return null;
            File f = new File(dir, "shot_" + System.currentTimeMillis() + ".jpg");
            cameraOutputUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", f);
            Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            cam.putExtra(MediaStore.EXTRA_OUTPUT, cameraOutputUri);
            cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            if (cam.resolveActivity(getPackageManager()) == null) return null;
            return cam;
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQ_FILE_CHOOSER) {
            Uri[] result = null;
            if (resultCode == RESULT_OK) {
                if (data != null && data.getData() != null) {
                    result = new Uri[]{data.getData()};
                } else if (cameraOutputUri != null) {
                    result = new Uri[]{cameraOutputUri};
                }
            }
            if (filePathCallback != null) filePathCallback.onReceiveValue(result);
            filePathCallback = null;
            cameraOutputUri = null;
            return;
        }

        if (requestCode == REQ_IMPORT_DOC) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                final Uri uri = data.getData();
                io.execute(() -> {
                    try (InputStream in = getContentResolver().openInputStream(uri)) {
                        StringBuilder sb = new StringBuilder();
                        BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
                        String line;
                        while ((line = r.readLine()) != null) sb.append(line).append('\n');
                        js("window.__onImport && window.__onImport(" + jsStr(sb.toString()) + ")");
                    } catch (Exception e) {
                        toast("Could not read that file");
                    }
                });
            }
        }
    }

    // ---------------------------------------------------------------- bridge

    public class Bridge {

        @JavascriptInterface
        public void exitApp() {
            main.post(MainActivity.this::finish);
        }

        @JavascriptInterface
        public void toastMsg(String m) {
            toast(m);
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            Notifs.vibrate(MainActivity.this, ms);
        }

        @JavascriptInterface
        public void keepAwake(final boolean on) {
            main.post(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        /** Fetches a page server-side (no CORS restrictions) and hands the HTML back to JS. */
        @JavascriptInterface
        public void fetchUrl(final String url, final String reqId) {
            io.execute(() -> {
                JSONObject out = new JSONObject();
                HttpURLConnection c = null;
                try {
                    URL u = new URL(url);
                    String proto = u.getProtocol();
                    if (!"http".equals(proto) && !"https".equals(proto)) throw new IOException("bad scheme");
                    c = (HttpURLConnection) u.openConnection();
                    c.setInstanceFollowRedirects(true);
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(20000);
                    c.setRequestProperty("User-Agent",
                            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                                    + "(KHTML, like Gecko) Chrome/124.0 Safari/537.36");
                    c.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
                    c.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
                    int code = c.getResponseCode();
                    InputStream in = (code >= 400) ? c.getErrorStream() : c.getInputStream();
                    if ("gzip".equalsIgnoreCase(c.getContentEncoding())) {
                        in = new java.util.zip.GZIPInputStream(in);
                    }
                    StringBuilder sb = new StringBuilder();
                    BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
                    char[] buf = new char[8192];
                    int n;
                    int total = 0;
                    while ((n = r.read(buf)) > 0 && total < 4_000_000) {
                        sb.append(buf, 0, n);
                        total += n;
                    }
                    r.close();
                    out.put("ok", code < 400);
                    out.put("status", code);
                    out.put("finalUrl", c.getURL().toString());
                    out.put("html", sb.toString());
                } catch (Exception e) {
                    try {
                        out.put("ok", false);
                        out.put("status", 0);
                        out.put("error", String.valueOf(e.getMessage()));
                    } catch (Exception ignored) {
                    }
                } finally {
                    if (c != null) c.disconnect();
                }
                js("window.__onFetch && window.__onFetch(" + jsStr(reqId) + "," + jsStr(out.toString()) + ")");
            });
        }

        /** Downloads an image and hands it back as a data: URL so recipes stay readable offline. */
        @JavascriptInterface
        public void fetchImage(final String url, final String reqId) {
            io.execute(() -> {
                String dataUrl = "";
                HttpURLConnection c = null;
                try {
                    URL u = new URL(url);
                    c = (HttpURLConnection) u.openConnection();
                    c.setInstanceFollowRedirects(true);
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(20000);
                    c.setRequestProperty("User-Agent", "Mozilla/5.0 (Android) Butterleaf/1.0");
                    InputStream in = c.getInputStream();
                    java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
                    byte[] buf = new byte[16384];
                    int n, total = 0;
                    while ((n = in.read(buf)) > 0 && total < 6_000_000) {
                        bos.write(buf, 0, n);
                        total += n;
                    }
                    in.close();
                    String type = c.getContentType();
                    if (type == null || !type.startsWith("image/")) type = "image/jpeg";
                    if (type.contains(";")) type = type.substring(0, type.indexOf(';')).trim();
                    dataUrl = "data:" + type + ";base64,"
                            + android.util.Base64.encodeToString(bos.toByteArray(), android.util.Base64.NO_WRAP);
                } catch (Exception ignored) {
                } finally {
                    if (c != null) c.disconnect();
                }
                js("window.__onImage && window.__onImage(" + jsStr(reqId) + "," + jsStr(dataUrl) + ")");
            });
        }

        @JavascriptInterface
        public void scheduleAlarm(String id, double fireAtMillis, String label) {
            AlarmScheduler.schedule(MainActivity.this, id, (long) fireAtMillis, label);
        }

        @JavascriptInterface
        public void cancelAlarm(String id) {
            AlarmScheduler.cancel(MainActivity.this, id);
        }

        @JavascriptInterface
        public boolean canScheduleExact() {
            return AlarmScheduler.canScheduleExact(MainActivity.this);
        }

        @JavascriptInterface
        public void openExactAlarmSettings() {
            AlarmScheduler.openSettings(MainActivity.this);
        }

        @JavascriptInterface
        public void exportBackup(final String json) {
            io.execute(() -> {
                try {
                    File dir = new File(getFilesDir(), "exports");
                    if (!dir.exists()) dir.mkdirs();
                    File f = new File(dir, "butterleaf-backup.json");
                    OutputStreamWriter w = new OutputStreamWriter(new FileOutputStream(f), StandardCharsets.UTF_8);
                    w.write(json);
                    w.close();
                    Uri uri = FileProvider.getUriForFile(MainActivity.this,
                            getPackageName() + ".fileprovider", f);
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("application/json");
                    send.putExtra(Intent.EXTRA_STREAM, uri);
                    send.putExtra(Intent.EXTRA_SUBJECT, "Butterleaf recipe backup");
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    main.post(() -> startActivity(Intent.createChooser(send, "Save your recipe backup")));
                } catch (Exception e) {
                    toast("Backup failed: " + e.getMessage());
                }
            });
        }

        @JavascriptInterface
        public void importBackup() {
            main.post(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain"});
                try {
                    startActivityForResult(i, REQ_IMPORT_DOC);
                } catch (ActivityNotFoundException e) {
                    toast("No file picker available");
                }
            });
        }

        @JavascriptInterface
        public String platform() {
            return "android";
        }
    }
}
