package app.butterleaf;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Keeps a small native mirror of the timers the web layer owns, so alarms still
 * ring when the app is closed and can be restored after a reboot.
 */
public class AlarmScheduler {

    private static final String PREFS = "butterleaf_alarms";
    private static final String KEY = "pending";

    public static void schedule(Context ctx, String id, long fireAt, String label) {
        // An empty id would arm an alarm nothing can ever cancel.
        if (id == null || id.trim().isEmpty()) return;
        remember(ctx, id, fireAt, label);
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        if (am == null) return;
        PendingIntent pi = pendingIntent(ctx, id, label, fireAt);
        try {
            AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(fireAt, showIntent(ctx));
            am.setAlarmClock(info, pi);
        } catch (SecurityException e) {
            try {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, pi);
            } catch (SecurityException e2) {
                am.set(AlarmManager.RTC_WAKEUP, fireAt, pi);
            }
        }
    }

    public static void cancel(Context ctx, String id) {
        forget(ctx, id);
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        if (am == null) return;
        am.cancel(pendingIntent(ctx, id, "", 0));
    }

    public static void rescheduleAll(Context ctx) {
        JSONArray arr = load(ctx);
        long now = System.currentTimeMillis();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o == null) continue;
            long at = o.optLong("at");
            if (at > now) schedule(ctx, o.optString("id"), at, o.optString("label"));
        }
    }

    public static boolean canScheduleExact(Context ctx) {
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        if (am == null) return false;
        if (Build.VERSION.SDK_INT >= 31) return am.canScheduleExactAlarms();
        return true;
    }

    public static void openSettings(Context ctx) {
        if (Build.VERSION.SDK_INT < 31) return;
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Exception ignored) {
        }
    }

    // ------------------------------------------------------------- internals

    private static PendingIntent pendingIntent(Context ctx, String id, String label, long fireAt) {
        Intent i = new Intent(ctx, AlarmReceiver.class);
        i.setAction("app.butterleaf.RING");
        i.setData(Uri.parse("butterleaf://timer/" + id));
        i.putExtra("id", id);
        i.putExtra("label", label);
        i.putExtra("at", fireAt);
        return PendingIntent.getBroadcast(ctx, id.hashCode(), i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent showIntent(Context ctx) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, 0, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONArray load(Context ctx) {
        try {
            return new JSONArray(prefs(ctx).getString(KEY, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static void save(Context ctx, JSONArray arr) {
        prefs(ctx).edit().putString(KEY, arr.toString()).apply();
    }

    private static void remember(Context ctx, String id, long at, String label) {
        JSONArray in = load(ctx);
        JSONArray out = new JSONArray();
        long now = System.currentTimeMillis();
        for (int i = 0; i < in.length(); i++) {
            JSONObject o = in.optJSONObject(i);
            if (o == null) continue;
            if (id.equals(o.optString("id"))) continue;
            if (o.optLong("at") <= now) continue;
            out.put(o);
        }
        try {
            JSONObject o = new JSONObject();
            o.put("id", id);
            o.put("at", at);
            o.put("label", label);
            out.put(o);
        } catch (Exception ignored) {
        }
        save(ctx, out);
    }

    static void forget(Context ctx, String id) {
        JSONArray in = load(ctx);
        JSONArray out = new JSONArray();
        for (int i = 0; i < in.length(); i++) {
            JSONObject o = in.optJSONObject(i);
            if (o == null) continue;
            if (id.equals(o.optString("id"))) continue;
            out.put(o);
        }
        save(ctx, out);
    }
}
