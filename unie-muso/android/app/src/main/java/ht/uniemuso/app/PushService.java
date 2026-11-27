package ht.uniemuso.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.util.Log;

import org.json.JSONObject;

/**
 * Service permanent (icône discrète « UNIE-MUSO actif ») : vérifie les boîtes de notification
 * environ toutes les 90 secondes (10 minutes la nuit), même application fermée,
 * sans serveur payant. La logique est dans PushCore.
 */
public class PushService extends Service {
    static final String PREFS = "push";
    static final String CHANNEL_SERVICE = "uniemuso-service";
    private static final int ONGOING_ID = 4242;
    private HandlerThread thread;
    private Handler handler;
    private volatile PushCore core;
    private final Runnable loop = new Runnable() {
        @Override public void run() {
            long next = core == null ? PushCore.ERROR_DELAY : core.tick();
            if (handler != null) handler.postDelayed(this, next);
        }
    };

    static boolean configured(Context ctx) {
        return !ctx.getSharedPreferences(PREFS, MODE_PRIVATE).getString("conf", "").isEmpty();
    }

    static void start(Context ctx) {
        if (!configured(ctx)) return;
        Intent i = new Intent(ctx, PushService.class);
        try {
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i); else ctx.startService(i);
        } catch (Exception e) { Log.w("UNIE-MUSO", "service non démarré : " + e); }
    }

    @Override public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_SERVICE, "Service de notifications", NotificationManager.IMPORTANCE_MIN);
            ch.setDescription("Reste actif pour recevoir annonces et messages, application fermée");
            ch.setShowBadge(false);
            getSystemService(NotificationManager.class).createNotificationChannel(ch);
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL_SERVICE) : new Notification.Builder(this);
        Notification n = b.setSmallIcon(R.drawable.ic_notif).setContentTitle("UNIE-MUSO actif")
                .setContentText("Annonces et messages reçus même application fermée").setColor(0xFF1A3A6B)
                .setOngoing(true).setContentIntent(pi).build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(ONGOING_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(ONGOING_ID, n);

        final SharedPreferences sp = getSharedPreferences(PREFS, MODE_PRIVATE);
        String conf = sp.getString("conf", "");
        if (conf.isEmpty()) { stopSelf(); return START_NOT_STICKY; }
        try {
            final Context ctx = this;
            core = new PushCore(new JSONObject(conf), new PushCore.Host() {
                public void show(String t, String body) { AlarmReceiver.show(ctx, (int) (System.nanoTime() % 1000000) + 1000, t, body); }
                public boolean appVisible() { return MainActivity.visible; }
                public String load(String k) { return sp.getString("s_" + k, ""); }
                public void save(String k, String v) { sp.edit().putString("s_" + k, v).apply(); }
                public void log(String m) { Log.i("UNIE-MUSO", m); }
            });
        } catch (Exception e) { stopSelf(); return START_NOT_STICKY; }
        if (thread == null) { thread = new HandlerThread("uniemuso-push"); thread.start(); handler = new Handler(thread.getLooper()); }
        handler.removeCallbacks(loop);
        handler.postDelayed(loop, 3000);
        return START_STICKY;
    }

    @Override public void onDestroy() {
        if (handler != null) handler.removeCallbacks(loop);
        if (thread != null) thread.quitSafely();
        handler = null; thread = null;
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
