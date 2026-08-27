package app.butterleaf;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Puts every running timer in the notification shade with a live countdown.
 *
 * These are plain ongoing notifications — no foreground service. The system
 * ticks the countdown itself and the notification outlives the app process,
 * which is all we need: the ring is scheduled separately through AlarmManager.
 */
public class TimerNotifications {

    private static final String PREFS = "butterleaf_timers";
    private static final String KEY_CANCELLED = "cancelled";
    private static final String KEY_SHOWN = "shown";

    /** Replaces the shade contents with exactly the timers passed in. */
    public static void sync(Context ctx, String timersJson) {
        try {
            Notifs.ensureRunningChannel(ctx);
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm == null) return;

            List<Timer> timers = parse(timersJson);
            Set<String> keep = new HashSet<>();

            for (Timer t : timers) {
                keep.add(t.id);
                nm.notify(t.id.hashCode(), build(ctx, t));
            }

            SharedPreferences p = prefs(ctx);
            Set<String> was = new HashSet<>(p.getStringSet(KEY_SHOWN, new HashSet<String>()));
            for (String old : was) {
                if (!keep.contains(old)) nm.cancel(old.hashCode());
            }
            p.edit().putStringSet(KEY_SHOWN, keep).apply();
        } catch (Exception ignored) {
            // the shade is a convenience — never let it take the app down
        }
    }

    /** Called when the user taps Stop on a notification. */
    public static void stopOne(Context ctx, String id) {
        if (id == null || id.isEmpty()) return;
        try {
            AlarmScheduler.cancel(ctx, id);
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm != null) nm.cancel(id.hashCode());

            SharedPreferences p = prefs(ctx);
            Set<String> cancelled = new HashSet<>(p.getStringSet(KEY_CANCELLED, new HashSet<String>()));
            cancelled.add(id);
            Set<String> shown = new HashSet<>(p.getStringSet(KEY_SHOWN, new HashSet<String>()));
            shown.remove(id);
            p.edit().putStringSet(KEY_CANCELLED, cancelled).putStringSet(KEY_SHOWN, shown).apply();
        } catch (Exception ignored) {
        }
    }

    /**
     * Records that a timer is finished with, without cancelling any alarm.
     * The web layer picks these up and clears the timer from its own list.
     */
    public static void markCancelled(Context ctx, String id) {
        if (id == null || id.isEmpty()) return;
        try {
            SharedPreferences p = prefs(ctx);
            Set<String> cancelled = new HashSet<>(p.getStringSet(KEY_CANCELLED, new HashSet<String>()));
            cancelled.add(id);
            p.edit().putStringSet(KEY_CANCELLED, cancelled).apply();
        } catch (Exception ignored) {
        }
    }

    /** Ids stopped from the shade since the app last looked, then forgets them. */
    public static String takeCancelled(Context ctx) {
        JSONArray arr = new JSONArray();
        try {
            SharedPreferences p = prefs(ctx);
            for (String s : p.getStringSet(KEY_CANCELLED, new HashSet<String>())) arr.put(s);
            p.edit().remove(KEY_CANCELLED).apply();
        } catch (Exception ignored) {
        }
        return arr.toString();
    }

    /** Clears one timer's notification once it has rung. */
    public static void clearOne(Context ctx, String id) {
        try {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm != null) nm.cancel(id.hashCode());
            SharedPreferences p = prefs(ctx);
            Set<String> shown = new HashSet<>(p.getStringSet(KEY_SHOWN, new HashSet<String>()));
            shown.remove(id);
            p.edit().putStringSet(KEY_SHOWN, shown).apply();
        } catch (Exception ignored) {
        }
    }

    /* --------------------------------------------------------- building */

    private static Notification build(Context ctx, Timer t) {
        Intent open = new Intent(ctx, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.setData(Uri.parse("butterleaf://open/timers"));
        open.putExtra("route", "#/timers");
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(ctx, 1, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent stop = new Intent(ctx, TimerActionReceiver.class);
        stop.setAction(TimerActionReceiver.ACTION_STOP);
        stop.setData(Uri.parse("butterleaf://stop/" + t.id));
        stop.putExtra("id", t.id);
        PendingIntent stopPi = PendingIntent.getBroadcast(ctx, ("s" + t.id).hashCode(), stop,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = new Notification.Builder(ctx, Notifs.CHANNEL_RUNNING)
                .setSmallIcon(R.drawable.ic_timer)
                .setContentTitle(t.label)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setCategory(Notification.CATEGORY_PROGRESS)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setContentIntent(openPi)
                .addAction(new Notification.Action.Builder(
                        android.graphics.drawable.Icon.createWithResource(ctx, R.drawable.ic_timer),
                        "Stop", stopPi).build());

        if (t.paused) {
            b.setContentText("Paused · " + fmt(t.leftSec) + " left");
        } else {
            // the system counts this down on its own — no per-second wakeups
            b.setWhen(t.endAt)
                    .setShowWhen(true)
                    .setUsesChronometer(true)
                    .setChronometerCountDown(true)
                    .setContentText("Ends " + timeOfDay(ctx, t.endAt));
        }
        return b.build();
    }

    private static String fmt(long seconds) {
        long s = Math.max(0, seconds);
        long h = s / 3600, m = (s % 3600) / 60, sec = s % 60;
        if (h > 0) return String.format(java.util.Locale.US, "%d:%02d:%02d", h, m, sec);
        return String.format(java.util.Locale.US, "%d:%02d", m, sec);
    }

    private static String timeOfDay(Context ctx, long millis) {
        try {
            return android.text.format.DateFormat.getTimeFormat(ctx)
                    .format(new java.util.Date(millis));
        } catch (Exception e) {
            return "";
        }
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /* ------------------------------------------------------------ model */

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
}
