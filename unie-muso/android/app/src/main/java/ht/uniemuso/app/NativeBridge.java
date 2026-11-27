package ht.uniemuso.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * Pont « UnieNative » exposé à la page :
 * données dans la mémoire de l'application + copie visible dans Documents/UNIE-MUSO,
 * partage WhatsApp, impression, notifications et alarmes de réunion.
 */
public class NativeBridge {
    static final String FOLDER = "UNIE-MUSO";
    static final String DATA_NAME = "donnees-uniemuso.unimiso";
    private final MainActivity act;
    private final WebView web;

    NativeBridge(MainActivity act, WebView web) { this.act = act; this.web = web; }

    @JavascriptInterface public String getPlatform() { return "android"; }

    /** Enregistrement à chaque modification : fichier interne + Documents/UNIE-MUSO. */
    @JavascriptInterface public String saveData(String json) {
        try {
            File f = new File(act.getFilesDir(), DATA_NAME);
            File tmp = new File(act.getFilesDir(), DATA_NAME + ".tmp");
            try (FileOutputStream o = new FileOutputStream(tmp)) { o.write(json.getBytes(StandardCharsets.UTF_8)); }
            if (!tmp.renameTo(f)) { Files.write(f.toPath(), json.getBytes(StandardCharsets.UTF_8)); tmp.delete(); }
            writeDocuments("", DATA_NAME, json);
            return f.getAbsolutePath();
        } catch (Exception e) { return "ERR:" + e.getMessage(); }
    }

    @JavascriptInterface public String loadData() {
        try {
            File f = new File(act.getFilesDir(), DATA_NAME);
            return f.exists() ? new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8) : "";
        } catch (Exception e) { return ""; }
    }

    /** Écrit un fichier dans Documents/UNIE-MUSO (sous-dossier possible : « sauvegardes/… »). */
    @JavascriptInterface public String saveFile(String name, String text) {
        try {
            String sub = ""; String file = name;
            int i = name.lastIndexOf('/');
            if (i > 0) { sub = name.substring(0, i).replaceAll("[^A-Za-z0-9_-]", ""); file = name.substring(i + 1); }
            file = file.replaceAll("[^A-Za-z0-9._-]", "_");
            return writeDocuments(sub, file, text);
        } catch (Exception e) { return "ERR:" + e.getMessage(); }
    }

    @JavascriptInterface public String dataFolder() { return "Documents/" + FOLDER + " (téléphone)"; }

    /** Partage du fichier .unimiso (WhatsApp, Bluetooth, e-mail…). */
    @JavascriptInterface public void shareFile(String name, String text) {
        try {
            File dir = new File(act.getCacheDir(), "partage");
            dir.mkdirs();
            File f = new File(dir, name.replaceAll("[^A-Za-z0-9._-]", "_"));
            Files.write(f.toPath(), text.getBytes(StandardCharsets.UTF_8));
            Uri uri = FileProvider.getUriForFile(act, "ht.uniemuso.app.files", f);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("application/octet-stream");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_TEXT, "Sauvegarde UNIE-MUSO : touchez le fichier pour l'ouvrir dans l'application.");
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            act.runOnUiThread(() -> act.startActivity(Intent.createChooser(send, "Partager la sauvegarde")));
            saveFile("partage/" + name, text);
        } catch (Exception e) { toastJs("Partage impossible : " + e.getMessage()); }
    }

    @JavascriptInterface public String getPendingImport() {
        String p = act.pendingImport; act.pendingImport = ""; return p;
    }

    /** Service de notifications (application fermée) : configuration envoyée après la connexion en ligne. */
    @JavascriptInterface public void startPush(String json) {
        android.content.SharedPreferences sp = act.getSharedPreferences(PushService.PREFS, Context.MODE_PRIVATE);
        String old = sp.getString("conf", "");
        android.content.SharedPreferences.Editor e = sp.edit().putString("conf", json);
        if (!old.equals(json)) for (String k : sp.getAll().keySet()) if (k.startsWith("s_")) e.remove(k); // autre compte : repères remis à zéro
        e.apply();
        act.runOnUiThread(() -> PushService.start(act));
    }

    @JavascriptInterface public void stopPush() {
        act.getSharedPreferences(PushService.PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        act.stopService(new Intent(act, PushService.class));
    }

    @JavascriptInterface public boolean pushActive() { return PushService.configured(act); }

    @JavascriptInterface public void notify(String title, String body) {
        AlarmReceiver.show(act, (int) (System.currentTimeMillis() % 100000), title, body);
    }

    /** Programme les rappels de réunion, même application fermée (reprogrammés au redémarrage). */
    @JavascriptInterface public int scheduleAlarms(String json) {
        try {
            act.getSharedPreferences("alarmes", Context.MODE_PRIVATE).edit().putString("list", json).apply();
            return AlarmReceiver.scheduleAll(act, json);
        } catch (Exception e) { return 0; }
    }

    /** Impression (ou enregistrement en PDF) de la page ou d'un document HTML. */
    @JavascriptInterface public void print() {
        act.runOnUiThread(() -> {
            PrintManager pm = (PrintManager) act.getSystemService(Context.PRINT_SERVICE);
            pm.print("UNIE-MUSO", web.createPrintDocumentAdapter("UNIE-MUSO"), new PrintAttributes.Builder().build());
        });
    }

    @JavascriptInterface public void printHtml(String title, String html) {
        act.runOnUiThread(() -> {
            WebView w = new WebView(act);
            w.setWebViewClient(new WebViewClient() {
                @Override public void onPageFinished(WebView v, String url) {
                    PrintManager pm = (PrintManager) act.getSystemService(Context.PRINT_SERVICE);
                    pm.print(title, v.createPrintDocumentAdapter(title), new PrintAttributes.Builder().build());
                }
            });
            w.loadDataWithBaseURL("file:///android_asset/", html, "text/html", "utf-8", null);
        });
    }

    private void toastJs(String msg) {
        act.runOnUiThread(() -> web.evaluateJavascript("toast(" + JSONObject.quote(msg) + ",'err')", null));
    }

    /** Android 10+ : MediaStore (Documents/UNIE-MUSO) ; avant : accès direct au dossier Documents. */
    private String writeDocuments(String sub, String name, String text) throws Exception {
        String rel = Environment.DIRECTORY_DOCUMENTS + "/" + FOLDER + (sub.isEmpty() ? "" : "/" + sub);
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        if (Build.VERSION.SDK_INT >= 29) {
            ContentResolver cr = act.getContentResolver();
            Uri col = MediaStore.Files.getContentUri("external");
            Uri target = null;
            try (Cursor c = cr.query(col, new String[]{MediaStore.MediaColumns._ID},
                    MediaStore.MediaColumns.RELATIVE_PATH + "=? AND " + MediaStore.MediaColumns.DISPLAY_NAME + "=?",
                    new String[]{rel + "/", name}, null)) {
                if (c != null && c.moveToFirst()) target = Uri.withAppendedPath(col, String.valueOf(c.getLong(0)));
            }
            if (target == null) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(MediaStore.MediaColumns.MIME_TYPE, "application/octet-stream");
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, rel);
                target = cr.insert(col, v);
            }
            if (target == null) throw new Exception("Dossier Documents indisponible");
            try (OutputStream o = cr.openOutputStream(target, "wt")) { o.write(bytes); }
            return rel + "/" + name;
        }
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), FOLDER + (sub.isEmpty() ? "" : "/" + sub));
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("Impossible de créer " + dir);
        File f = new File(dir, name);
        Files.write(f.toPath(), bytes);
        return f.getAbsolutePath();
    }

    static JSONArray parse(String json) {
        try { return new JSONArray(json == null ? "[]" : json); } catch (Exception e) { return new JSONArray(); }
    }

    static PendingIntent alarmIntent(Context ctx, int i, String title, String body) {
        Intent it = new Intent(ctx, AlarmReceiver.class);
        it.putExtra("title", title); it.putExtra("body", body); it.putExtra("id", i);
        return PendingIntent.getBroadcast(ctx, 1000 + i, it, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static AlarmManager alarms(Context ctx) { return (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE); }
}
