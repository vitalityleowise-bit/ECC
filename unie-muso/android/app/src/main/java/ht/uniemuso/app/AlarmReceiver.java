package ht.uniemuso.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/** Affiche les rappels de réunion et les reprogramme après un redémarrage du téléphone. */
public class AlarmReceiver extends BroadcastReceiver {
    private static final int MAX = 12;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            scheduleAll(ctx, ctx.getSharedPreferences("alarmes", Context.MODE_PRIVATE).getString("list", "[]"));
            return;
        }
        show(ctx, intent.getIntExtra("id", 1), intent.getStringExtra("title"), intent.getStringExtra("body"));
    }

    static int scheduleAll(Context ctx, String json) {
        AlarmManager am = NativeBridge.alarms(ctx);
        for (int i = 0; i < MAX; i++) am.cancel(NativeBridge.alarmIntent(ctx, i, "", ""));
        JSONArray list = NativeBridge.parse(json);
        int n = 0;
        for (int i = 0; i < list.length() && i < MAX; i++) {
            JSONObject a = list.optJSONObject(i);
            if (a == null) continue;
            long at = a.optLong("at");
            if (at <= System.currentTimeMillis()) continue;
            PendingIntent pi = NativeBridge.alarmIntent(ctx, i, a.optString("title", "UNIE-MUSO"), a.optString("body", ""));
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            n++;
        }
        return n;
    }

    static void show(Context ctx, int id, String title, String body) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, MainActivity.CHANNEL) : new Notification.Builder(ctx);
        b.setSmallIcon(R.drawable.ic_notif).setContentTitle(title == null ? "UNIE-MUSO" : title).setContentText(body == null ? "" : body)
                .setStyle(new Notification.BigTextStyle().bigText(body == null ? "" : body))
                .setColor(0xFF1A3A6B).setAutoCancel(true).setContentIntent(pi);
        try { nm.notify(id, b.build()); } catch (SecurityException ignored) { /* notifications refusées */ }
    }
}
