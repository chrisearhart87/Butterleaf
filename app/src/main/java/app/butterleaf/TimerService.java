package app.butterleaf;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Keeps one ongoing notification per timer so the countdown is readable from
 * the shade without opening the app. The system ticks the countdown itself via
 * the chronometer, so nothing has to wake up every second.
 */
public class TimerService extends Service {

    public static final String ACTION_SYNC = "app.butterleaf.SYNC_TIMERS";
    public static final String ACTION_STOP_ONE = "app.butterleaf.STOP_TIMER";
    public static final String EXTRA_TIMERS = "timers";
    public static final String EXTRA_ID = "id";

    private static final String PREFS = "butterleaf_timers";
    private static final String KEY_CANCELLED = "cancelled";
    private static final int FG_ID = 90210;

    private final Set<Integer> shown = new HashSet<>();
    private boolean foreground = false;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    public static void sync(Context ctx, String timersJson) {
        Intent i = new Intent(ctx, TimerService.class);
        i.setAction(ACTION_SYNC);
        i.putExtra(EXTRA_TIMERS, timersJson);
        try {
            ctx.startForegroundService(i);
        } catch (Exception e) {
            try {
                ctx.startService(i);
            } catch (Exception ignored) {
            }
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notifs.ensureChannel(this);
        Notifs.ensureRunningChannel(this);

        String action = intent == null ? null : intent.getAction();

        if (ACTION_STOP_ONE.equals(action)) {
            String id = intent.getStringExtra(EXTRA_ID);
            if (id != null) {
                AlarmScheduler.cancel(this, id);
                rememberCancelled(this, id);
                NotificationManager nm = getSystemService(NotificationManager.class);
                if (nm != null) nm.cancel(id.hashCode());
                shown.remove(id.hashCode());
            }
            if (shown.isEmpty()) stopEverything();
            return START_STICKY;
        }

        List<Timer> timers = parse(intent == null ? null : intent.getStringExtra(EXTRA_TIMERS));
        if (timers.isEmpty()) {
            stopEverything();
            return START_NOT_STICKY;
        }
        post(timers);
        return START_STICKY;
    }

    /* ------------------------------------------------------------ posting */

    private void post(List<Timer> timers) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;

        Set<Integer> keep = new HashSet<>();
        boolean first = true;

        for (Timer t : timers) {
            int nid = t.id.hashCode();
            keep.add(nid);
            Notification n = build(t);
            if (first && !foreground) {
                startInForeground(nid, n);
                first = false;
            } else {
                nm.notify(nid, n);
                if (first) first = false;
            }
            shown.add(nid);
        }

        for (Integer old : new ArrayList<>(shown)) {
            if (!keep.contains(old)) {
                nm.cancel(old);
                shown.remove(old);
            }
        }
    }

    private void startInForeground(int nid, Notification n) {
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(nid, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else if (Build.VERSION.SDK_INT >= 29) {
                startForeground(nid, n, 0);
            } else {
                startForeground(nid, n);
            }
            foreground = true;
        } catch (Exception e) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.notify(nid, n);
        }
    }

    private Notification build(Timer t) {
        Intent open = new Intent(this, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.setData(Uri.parse("butterleaf://open/timers"));
        open.putExtra("route", "#/timers");
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(this, 1, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent stop = new Intent(this, TimerService.class);
        stop.setAction(ACTION_STOP_ONE);
        stop.putExtra(EXTRA_ID, t.id);
        PendingIntent stopPi = PendingIntent.getService(this, ("s" + t.id).hashCode(), stop,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = new Notification.Builder(this, Notifs.CHANNEL_RUNNING)
                .setSmallIcon(R.drawable.ic_timer)
                .setContentTitle(t.label)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setCategory(Notification.CATEGORY_PROGRESS)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setContentIntent(openPi)
                .addAction(new Notification.Action.Builder(
                        android.graphics.drawable.Icon.createWithResource(this, R.drawable.ic_timer),
                        "Stop", stopPi).build());

        if (t.paused) {
            b.setContentText("Paused · " + fmt(t.leftSec) + " left");
        } else {
            // The system counts this down on its own — no per-second wakeups.
            b.setWhen(t.endAt)
                    .setShowWhen(true)
                    .setUsesChronometer(true)
                    .setChronometerCountDown(true)
                    .setContentText("Ends " + timeOfDay(t.endAt));
        }
        return b.build();
    }

    private static String fmt(long seconds) {
        long s = Math.max(0, seconds);
        long h = s / 3600, m = (s % 3600) / 60, sec = s % 60;
        if (h > 0) return String.format(java.util.Locale.US, "%d:%02d:%02d", h, m, sec);
        return String.format(java.util.Locale.US, "%d:%02d", m, sec);
    }

    private String timeOfDay(long millis) {
        java.text.DateFormat f = android.text.format.DateFormat.getTimeFormat(this);
        return f.format(new java.util.Date(millis));
    }

    private void stopEverything() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) {
            for (Integer id : shown) nm.cancel(id);
        }
        shown.clear();
        foreground = false;
        try {
            if (Build.VERSION.SDK_INT >= 24) stopForeground(Service.STOP_FOREGROUND_REMOVE);
            else stopForeground(true);
        } catch (Exception ignored) {
        }
        stopSelf();
    }

    @Override
    public void onDestroy() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) {
            for (Integer id : shown) nm.cancel(id);
        }
        shown.clear();
        super.onDestroy();
    }

    /* ------------------------------------------------------------- model */

    private static class Timer {
        String id;
        String label;
        long endAt;
        long leftSec;
        boolean paused;
    }

    private static List<Timer> parse(String json) {
        List<Timer> out = new ArrayList<>();
        if (json == null) return out;
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null) continue;
                Timer t = new Timer();
                t.id = o.optString("id");
                t.label = o.optString("label", "Bake timer");
                if (t.label.trim().isEmpty()) t.label = "Bake timer";
                t.endAt = o.optLong("endAt");
                t.leftSec = o.optLong("leftSec");
                t.paused = o.optBoolean("paused", false);
                if (t.id != null && !t.id.isEmpty()) out.add(t);
            }
        } catch (Exception ignored) {
        }
        return out;
    }

    /* ------------------------- timers the user stopped from the shade ---- */

    static void rememberCancelled(Context ctx, String id) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Set<String> set = new HashSet<>(p.getStringSet(KEY_CANCELLED, new HashSet<String>()));
        set.add(id);
        p.edit().putStringSet(KEY_CANCELLED, set).apply();
    }

    static String takeCancelled(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Set<String> set = p.getStringSet(KEY_CANCELLED, new HashSet<String>());
        JSONArray arr = new JSONArray();
        for (String s : set) arr.put(s);
        p.edit().remove(KEY_CANCELLED).apply();
        return arr.toString();
    }
}
