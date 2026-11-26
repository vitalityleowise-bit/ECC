package ht.uniemuso.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Parcelable;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** Fenêtre unique : l'application HTML UNIE-MUSO dans une WebView, avec le pont natif « UnieNative ». */
public class MainActivity extends Activity {
    static final String CHANNEL = "uniemuso-rappels";
    private static final int REQ_FILE = 41;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private boolean pageReady = false;
    String pendingImport = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createChannel();
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        web.addJavascriptInterface(new NativeBridge(this, web), "UnieNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView v, String url) { pageReady = true; }
            @Override public boolean shouldOverrideUrlLoading(WebView v, String url) {
                if (url.startsWith("http")) { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); return true; }
                return false;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                String[] types = params.getAcceptTypes();
                boolean images = types != null && types.length > 0 && types[0].startsWith("image");
                i.setType(images ? "image/*" : "*/*");
                try { startActivityForResult(Intent.createChooser(i, "Choisir un fichier"), REQ_FILE); }
                catch (Exception e) { fileCallback = null; return false; }
                return true;
            }
        });
        handleIntent(getIntent());
        web.loadUrl("file:///android_asset/UNIE-MUSO.html");
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7);
        }
        if (Build.VERSION.SDK_INT <= 28 && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, 8);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    /** Fichier .unimiso / .json ouvert ou partagé vers l'application → import automatique. */
    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) uri = intent.getData();
        else if (Intent.ACTION_SEND.equals(intent.getAction())) {
            Parcelable p = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (p instanceof Uri) uri = (Uri) p;
            else if (intent.getStringExtra(Intent.EXTRA_TEXT) != null) deliver(intent.getStringExtra(Intent.EXTRA_TEXT));
        }
        if (uri == null) return;
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384]; int n;
            while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); if (out.size() > 40 * 1024 * 1024) throw new Exception("Fichier trop volumineux"); }
            deliver(new String(out.toByteArray(), StandardCharsets.UTF_8));
        } catch (Exception e) {
            Toast.makeText(this, "Lecture du fichier impossible : " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void deliver(String text) {
        if (text == null || text.trim().isEmpty()) return;
        if (pageReady) web.evaluateJavascript("window.onUnieImport && window.onUnieImport(" + JSONObject.quote(text) + ")", null);
        else pendingImport = text;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE && fileCallback != null) {
            Uri[] res = (resultCode == RESULT_OK && data != null && data.getData() != null) ? new Uri[]{data.getData()} : null;
            fileCallback.onReceiveValue(res);
            fileCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(function(){var m=document.getElementById('modal');if(m){m.remove();return 'modal'}" +
                "var a=document.querySelector('.app.menu-open');if(a){a.classList.remove('menu-open');return 'menu'}return ''})()", r -> {
            if (r == null || r.equals("\"\"")) moveTaskToBack(true);
        });
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Rappels UNIE-MUSO", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Réunions et échéances de prêt");
            getSystemService(NotificationManager.class).createNotificationChannel(ch);
        }
    }
}
